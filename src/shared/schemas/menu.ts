import { z } from 'zod';
import { LOW_STOCK_THRESHOLD, MAX_QTY_PER_ITEM } from '../limits.js';

/**
 * One orderable item on `GET /api/menu` (Batch 1 §8.4). Strict so a leaked key such as
 * `stockRemaining` or `dailyStock` fails the parse instead of reaching customers.
 */
export const publicMenuItemSchema = z.strictObject({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  /** Integer rupees (Rule 1). */
  price: z.number().int().min(0),
  imageUrl: z.string().nullable(),
  soldOut: z.boolean(),
  /** 0 when sold out, otherwise min(stockRemaining, MAX_QTY_PER_ITEM). */
  maxQty: z.number().int().min(0).max(MAX_QTY_PER_ITEM),
  /** Set only when in stock and at or below LOW_STOCK_THRESHOLD. */
  onlyLeft: z.number().int().min(1).max(LOW_STOCK_THRESHOLD).nullable(),
});

export const publicMenuSchema = z.strictObject({
  /** IST business date, `YYYY-MM-DD`. */
  businessDate: z.iso.date(),
  ordersPaused: z.boolean(),
  items: z.array(publicMenuItemSchema),
});
