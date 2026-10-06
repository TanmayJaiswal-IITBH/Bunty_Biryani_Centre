import type { DeliveryOptions } from '@shared/api-types.js';
import { computeTotals } from '@shared/pricing.js';
import {
  createOrderSchema,
  customerDetailsSchema,
  type CreateOrderOutput,
} from '@shared/schemas/order.js';
import { copy } from '../../../copy';
import type { CartView } from '../cart/cart-reducer';
import { isExpressOpen, type Selection } from './selection';

const text = copy.customer.checkout;

export interface DetailsForm {
  customerName: string;
  customerPhone: string;
  addressDetail: string;
}

export type OrderField =
  | 'items'
  | 'deliveryMode'
  | 'slotId'
  | 'locationId'
  | 'customerName'
  | 'customerPhone'
  | 'addressDetail';

/** Page order: submit focuses the first field with an error. */
export const FIELD_ORDER: readonly OrderField[] = [
  'items',
  'deliveryMode',
  'slotId',
  'locationId',
  'customerName',
  'customerPhone',
  'addressDetail',
];

export type FieldErrors = Partial<Record<OrderField, string>>;

export type BuildResult =
  { ok: true; request: CreateOrderOutput } | { ok: false; errors: FieldErrors };

function isOrderField(key: PropertyKey | undefined): key is OrderField {
  return FIELD_ORDER.some((field) => field === key);
}

/** First issue per field wins. An issue on an unknown path lands on `deliveryMode` rather than vanishing. */
function addIssues(
  errors: FieldErrors,
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): void {
  for (const issue of issues) {
    const key = issue.path[0];
    const field: OrderField = isOrderField(key) ? key : 'deliveryMode';
    errors[field] ??= issue.message;
  }
}

/**
 * Checks the delivery choice and the details together, so one tap shows every error, then builds
 * the exact `createOrderSchema` request (Batch 4 §9). Nothing is sent in Batch 4.
 */
export function buildOrderRequest(args: {
  cartView: CartView;
  selection: Selection;
  details: DetailsForm;
  options: DeliveryOptions;
  clientRequestId: string;
}): BuildResult {
  const { cartView, selection, details, options, clientRequestId } = args;
  const errors: FieldErrors = {};

  let slotId: number | null = null;
  let locationId: number | null = null;
  let fee = 0;

  if (selection.deliveryMode === null) {
    errors.deliveryMode = text.needMethod;
  } else if (selection.deliveryMode === 'BATCH') {
    const slot = options.batch.slots.find((s) => s.id === selection.slotId);
    if (!slot) {
      errors.slotId = text.needSlot;
    } else if (!slot.isOpen) {
      errors.slotId = text.slotClosed;
    } else {
      slotId = slot.id;
      // The slot decides the location; a stale selection can't contradict it.
      locationId = slot.locationId;
    }
    fee = options.batch.fee;
  } else {
    if (!isExpressOpen(options)) {
      errors.deliveryMode = text.expressUnavailable;
    } else if (!options.express.locations.some((l) => l.id === selection.locationId)) {
      errors.locationId = text.needLocation;
    } else {
      locationId = selection.locationId;
    }
    fee = options.express.fee;
  }

  const parsedDetails = customerDetailsSchema.safeParse(details);
  if (!parsedDetails.success) addIssues(errors, parsedDetails.error.issues);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const expectedTotal = computeTotals(
    cartView.lines.map((line) => ({ unitPrice: line.price, quantity: line.quantity })),
    fee,
  ).total;
  const common = {
    clientRequestId,
    customerName: details.customerName,
    customerPhone: details.customerPhone,
    addressDetail: details.addressDetail,
    items: cartView.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
    expectedTotal,
  };
  const parsed = createOrderSchema.safeParse(
    selection.deliveryMode === 'BATCH'
      ? { ...common, deliveryMode: 'BATCH', locationId, slotId }
      : { ...common, deliveryMode: 'EXPRESS', locationId },
  );
  if (parsed.success) return { ok: true, request: parsed.data };
  addIssues(errors, parsed.error.issues);
  return { ok: false, errors };
}
