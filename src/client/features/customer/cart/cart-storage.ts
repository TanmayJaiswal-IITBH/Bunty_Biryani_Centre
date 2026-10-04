import { MAX_LINES_PER_ORDER, MAX_QTY_PER_ITEM } from '@shared/limits.js';
import { z } from 'zod';
import { EMPTY_CART, type CartState } from './cart-reducer.js';

export const CART_STORAGE_KEY = 'bbc.cart.v1';

const storedLineSchema = z.strictObject({
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
  name: z.string().max(60),
});

const storedCartSchema = z
  .strictObject({
    businessDate: z.iso.date().nullable(),
    lines: z.array(storedLineSchema).max(MAX_LINES_PER_ORDER),
  })
  .refine((c) => new Set(c.lines.map((l) => l.menuItemId)).size === c.lines.length, {
    message: 'duplicate menu item ids',
  })
  .refine((c) => c.lines.length === 0 || c.businessDate !== null, {
    message: 'a cart with lines needs a business date',
  });

/** Reads what localStorage held. Never throws: anything unreadable or invalid is an empty cart. */
export function parseStoredCart(raw: string | null): CartState {
  if (raw === null) return EMPTY_CART;
  try {
    const parsed = storedCartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

/** Only the date and the lines are persisted; notices never are. */
export function serializeCart(cart: CartState): string {
  return JSON.stringify({ businessDate: cart.businessDate, lines: cart.lines });
}
