import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AppError } from '../../src/server/lib/app-error';
import {
  createAdmin as createAdminViaService,
  resetPassword,
} from '../../src/server/services/auth.service';
import { APP_ORIGIN, makeApp } from '../helpers/app';
import { ADMIN_PASSWORD, ADMIN_USERNAME, createAdmin } from '../helpers/factories';
import { prisma } from '../helpers/db';
import { loginCookie } from '../helpers/http';

const login = (
  app: Parameters<typeof request>[0],
  body: object = { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
) => request(app).post('/api/admin/login').set('Origin', APP_ORIGIN).send(body);

beforeEach(async () => {
  await createAdmin();
});

describe('POST /api/admin/login', () => {
  it('logs in and sets a hardened session cookie', async () => {
    const { app } = makeApp();
    const res = await login(app);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: ADMIN_USERNAME });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('bbc_admin=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=1209600');
    expect(cookie).not.toContain('Secure');
  });

  it('marks the cookie Secure with the production config', async () => {
    const { app } = makeApp({ config: { env: 'production', isProduction: true } });
    const res = await login(app);
    expect(String(res.headers['set-cookie'])).toContain('Secure');
  });

  it('accepts a username in any case with surrounding spaces', async () => {
    const { app } = makeApp();
    const res = await login(app, { username: '  BUNTY ', password: ADMIN_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('answers wrong password and unknown username with a byte-identical 401', async () => {
    const { app } = makeApp();
    const wrongPassword = await login(app, {
      username: ADMIN_USERNAME,
      password: 'not-the-password',
    });
    const unknownUser = await login(app, { username: 'nobody', password: 'not-the-password' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body.error.message).toBe('Wrong username or password.');
    expect(unknownUser.text).toBe(wrongPassword.text);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a login without an Origin header', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('rejects a login from a foreign Origin', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/admin/login')
      .set('Origin', 'https://evil.example')
      .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
  });
});

describe('login rate limit', () => {
  it('blocks the fourth failed attempt when the limit is 3, with Retry-After', async () => {
    const { app } = makeApp({ limits: { login: { windowMs: 60_000, max: 3 } } });
    const bad = { username: ADMIN_USERNAME, password: 'wrong-password' };
    for (let i = 0; i < 3; i++) expect((await login(app, bad)).status).toBe(401);
    const blocked = await login(app, bad);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it("doesn't use up the allowance on successful logins", async () => {
    const { app } = makeApp({ limits: { login: { windowMs: 60_000, max: 3 } } });
    for (let i = 0; i < 6; i++) expect((await login(app)).status).toBe(200);
    const bad = await login(app, { username: ADMIN_USERNAME, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });
});

describe('GET /api/admin/me', () => {
  it('is 401 without a cookie', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/admin/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('is 200 with a valid session', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    const res = await request(app).get('/api/admin/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: ADMIN_USERNAME });
  });

  it('is 401 when the signature is tampered with, and clears the cookie', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    const [name, jwt] = cookie.split('=') as [string, string];
    const parts = jwt.split('.');
    const sig = parts[2] as string;
    const flipped = sig.slice(0, 10) + (sig[10] === 'A' ? 'B' : 'A') + sig.slice(11);
    const res = await request(app)
      .get('/api/admin/me')
      .set('Cookie', `${name}=${parts[0]}.${parts[1]}.${flipped}`);
    expect(res.status).toBe(401);
    expect(String(res.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('is 401 after the 14-day session has expired', async () => {
    const { app, clock } = makeApp();
    const cookie = await loginCookie(app);
    clock.advance(13 * 24 * 60 * 60 * 1000);
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(200);
    clock.advance(2 * 24 * 60 * 60 * 1000);
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('is 401 after the password is reset (every device is logged out)', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    await resetPassword(prisma, ADMIN_USERNAME, 'a-brand-new-password');
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(401);
    const fresh = await login(app, { username: ADMIN_USERNAME, password: 'a-brand-new-password' });
    expect(fresh.status).toBe(200);
  });

  it('is 401 when the admin row no longer exists', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    await prisma.admin.deleteMany();
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(401);
  });
});

describe('POST /api/admin/logout', () => {
  it('is 204 with a clearing Set-Cookie', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    const res = await request(app)
      .post('/api/admin/logout')
      .set('Origin', APP_ORIGIN)
      .set('Cookie', cookie);
    expect(res.status).toBe(204);
    const cleared = String(res.headers['set-cookie']);
    expect(cleared).toContain('bbc_admin=;');
    expect(cleared).toContain('Max-Age=0');
  });

  it('needs a session, then the Origin check', async () => {
    const { app } = makeApp();
    expect((await request(app).post('/api/admin/logout')).status).toBe(401);
    const cookie = await loginCookie(app);
    const res = await request(app).post('/api/admin/logout').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('keeps the old token valid until a password reset (documented limitation)', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    await request(app).post('/api/admin/logout').set('Origin', APP_ORIGIN).set('Cookie', cookie);
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(200);
  });
});

describe('auth.service', () => {
  it('creates only one admin', async () => {
    await expect(
      createAdminViaService(prisma, 'second', 'another-long-password'),
    ).rejects.toBeInstanceOf(AppError);
    expect(await prisma.admin.count()).toBe(1);
  });

  it('stores an argon2id hash and refuses a short password', async () => {
    await prisma.admin.deleteMany();
    await expect(createAdminViaService(prisma, 'bunty', 'short')).rejects.toBeInstanceOf(ZodError);
    expect(await prisma.admin.count()).toBe(0);
    await createAdminViaService(prisma, 'bunty', 'a-long-enough-password');
    const stored = await prisma.admin.findUniqueOrThrow({ where: { username: 'bunty' } });
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(stored.passwordHash).not.toContain('a-long-enough-password');
  });

  it('refuses to reset the password of an unknown admin', async () => {
    await expect(resetPassword(prisma, 'ghost', 'a-long-enough-password')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
