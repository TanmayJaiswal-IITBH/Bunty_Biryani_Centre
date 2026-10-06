import type { RequestHandler } from 'express';
import { nowIST, type Clock } from '../../shared/time.js';
import type { PrismaClient } from '../db.js';
import { getDeliveryOptions } from '../services/delivery.service.js';

/** `GET /api/delivery-options`: batch slots and express availability (Batch 4 §3). Public, read-only. */
export function deliveryOptionsHandler(prisma: PrismaClient, clock: Clock): RequestHandler {
  return async (_req, res) => {
    res.json(await getDeliveryOptions(prisma, nowIST(clock)));
  };
}
