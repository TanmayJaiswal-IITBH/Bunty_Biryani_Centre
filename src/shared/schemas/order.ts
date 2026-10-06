import { z } from 'zod';
import {
  ADDRESS_MAX,
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_ITEM,
  NAME_MAX,
  NAME_MIN,
} from '../limits.js';
import { normalizeIndianMobile } from '../phone.js';

// Messages are customer-facing copy (Batch 4 §4).

const id = z.number().int().positive();

export const customerNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(NAME_MIN, 'Enter your name').max(NAME_MAX, 'Name is too long'));

export const customerPhoneSchema = z.string().transform((s, ctx) => {
  const n = normalizeIndianMobile(s);
  if (!n) {
    ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number' });
    return z.NEVER;
  }
  return n;
});

export const addressDetailSchema = z
  .string()
  .nullish()
  .transform((s) => (s ?? '').trim() || null)
  .pipe(z.string().max(ADDRESS_MAX, 'Keep it under 120 characters').nullable());

export const orderLineSchema = z.object({
  menuItemId: id,
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

const base = {
  clientRequestId: z.uuid(),
  customerName: customerNameSchema,
  customerPhone: customerPhoneSchema,
  addressDetail: addressDetailSchema,
  items: z.array(orderLineSchema).min(1).max(MAX_LINES_PER_ORDER),
  expectedTotal: z.number().int().nonnegative(),
};

export const createOrderSchema = z.discriminatedUnion('deliveryMode', [
  z.strictObject({ ...base, deliveryMode: z.literal('BATCH'), locationId: id, slotId: id }),
  z.strictObject({ ...base, deliveryMode: z.literal('EXPRESS'), locationId: id }),
]);

export const customerDetailsSchema = z.object({
  customerName: customerNameSchema,
  customerPhone: customerPhoneSchema,
  addressDetail: addressDetailSchema,
});

/** Form state uses the input types; the parsed output is what gets sent and what the server works with. */
export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderOutput = z.output<typeof createOrderSchema>;
export type CustomerDetailsInput = z.input<typeof customerDetailsSchema>;
