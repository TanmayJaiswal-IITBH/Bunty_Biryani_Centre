import type { RequestHandler } from 'express';
import type { HealthResponse } from '../../shared/api-types.js';
import { pingDatabase, type PrismaClient } from '../db.js';

/** `SELECT 1` with a 2 s timeout. Used by the platform health check and the uptime monitor. */
export function healthHandler(prisma: PrismaClient): RequestHandler {
  return async (_req, res) => {
    const ok = await pingDatabase(prisma, 2000);
    const body: HealthResponse = { status: ok ? 'ok' : 'error' };
    res.status(ok ? 200 : 503).json(body);
  };
}
