import type { RequestHandler } from 'express';
import { nowIST, type Clock } from '../../shared/time.js';
import type { PrismaClient } from '../db.js';
import { getPublicMenu } from '../services/menu.service.js';

/** `GET /api/menu`: today's orderable menu (Batch 3 §3). Public, read-only. */
export function menuHandler(prisma: PrismaClient, clock: Clock): RequestHandler {
  return async (_req, res) => {
    res.json(await getPublicMenu(prisma, nowIST(clock)));
  };
}
