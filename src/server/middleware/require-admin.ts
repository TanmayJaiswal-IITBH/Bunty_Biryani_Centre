import type { RequestHandler } from 'express';
import type { Clock } from '../../shared/time.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../lib/app-error.js';
import { SESSION_COOKIE, adminForToken, clearSessionCookie } from '../services/auth.service.js';

interface Deps {
  prisma: PrismaClient;
  clock: Clock;
  jwtSecret: string;
  isProduction: boolean;
}

/** Every /api/admin/* route except login sits behind this (Batch 1 §9.1). Any failure is 401. */
export function requireAdmin({ prisma, clock, jwtSecret, isProduction }: Deps): RequestHandler {
  return async (req, res, next) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    try {
      if (!token) throw new AppError('UNAUTHENTICATED', 'Please log in.');
      req.admin = await adminForToken(prisma, token, { secret: jwtSecret, clock });
      next();
    } catch (err) {
      if (token) clearSessionCookie(res, isProduction);
      next(err instanceof AppError ? err : new AppError('UNAUTHENTICATED', 'Please log in.'));
    }
  };
}
