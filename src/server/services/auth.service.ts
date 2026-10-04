import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import type { Response } from 'express';
import { adminCredentialsSchema } from '../../shared/schemas/auth.js';
import { SESSION_SECONDS } from '../../shared/limits.js';
import type { Clock } from '../../shared/time.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../lib/app-error.js';

export const SESSION_COOKIE = 'bbc_admin';

export interface AuthedAdmin {
  id: number;
  username: string;
  tokenVersion: number;
}

export interface TokenDeps {
  secret: string;
  clock: Clock;
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Verified against when the username is unknown, so the response time doesn't reveal which
// usernames exist (Batch 1 §9.1). Same parameters as a real hash; computed once.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

const invalidCredentials = () => new AppError('INVALID_CREDENTIALS', 'Wrong username or password.');

export async function createAdmin(
  prisma: PrismaClient,
  username: string,
  password: string,
): Promise<{ id: number; username: string }> {
  const creds = adminCredentialsSchema.parse({ username, password });
  if ((await prisma.admin.count()) > 0) {
    throw new AppError('DUPLICATE', 'An admin already exists. Use admin:reset-password.', {
      field: 'username',
    });
  }
  const admin = await prisma.admin.create({
    data: { username: creds.username, passwordHash: await hashPassword(creds.password) },
  });
  return { id: admin.id, username: admin.username };
}

/** Sets a new password and bumps tokenVersion, which logs out every device. */
export async function resetPassword(
  prisma: PrismaClient,
  username: string,
  password: string,
): Promise<void> {
  const creds = adminCredentialsSchema.parse({ username, password });
  const admin = await prisma.admin.findUnique({ where: { username: creds.username } });
  if (!admin) throw new AppError('NOT_FOUND', `No admin named "${creds.username}".`);
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(creds.password), tokenVersion: { increment: 1 } },
  });
}

export async function login(
  prisma: PrismaClient,
  username: string,
  password: string,
): Promise<AuthedAdmin> {
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) {
    await argon2.verify(await getDummyHash(), password);
    throw invalidCredentials();
  }
  if (!(await argon2.verify(admin.passwordHash, password))) throw invalidCredentials();
  return { id: admin.id, username: admin.username, tokenVersion: admin.tokenVersion };
}

const keyOf = (secret: string) => new TextEncoder().encode(secret);

export function issueToken(admin: AuthedAdmin, { secret, clock }: TokenDeps): Promise<string> {
  const iat = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT({ tv: admin.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(admin.id))
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_SECONDS)
    .sign(keyOf(secret));
}

/** Returns the admin id and token version, or throws UNAUTHENTICATED for any problem. */
export async function verifyToken(
  token: string,
  { secret, clock }: TokenDeps,
): Promise<{ adminId: number; tokenVersion: number }> {
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), {
      algorithms: ['HS256'],
      currentDate: clock.now(),
      clockTolerance: 5,
    });
    const adminId = Number(payload.sub);
    const tv = payload.tv;
    if (!Number.isInteger(adminId) || typeof tv !== 'number') throw new Error('bad claims');
    return { adminId, tokenVersion: tv };
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Please log in.');
  }
}

/** Loads the admin for a verified token and checks the token version. */
export async function adminForToken(
  prisma: PrismaClient,
  token: string,
  deps: TokenDeps,
): Promise<{ id: number; username: string }> {
  const { adminId, tokenVersion } = await verifyToken(token, deps);
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || admin.tokenVersion !== tokenVersion) {
    throw new AppError('UNAUTHENTICATED', 'Please log in.');
  }
  return { id: admin.id, username: admin.username };
}

const cookieBase = (isProduction: boolean) =>
  ({ httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' }) as const;

export function setSessionCookie(res: Response, token: string, isProduction: boolean): void {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieBase(isProduction),
    maxAge: SESSION_SECONDS * 1000,
  });
}

/** Max-Age=0 with the same attributes, so every browser drops the cookie. */
export function clearSessionCookie(res: Response, isProduction: boolean): void {
  res.cookie(SESSION_COOKIE, '', { ...cookieBase(isProduction), maxAge: 0 });
}
