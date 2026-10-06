export const DELIVERY_MODES = ['BATCH', 'EXPRESS'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const ORDER_STATUSES = ['ORDER_RECEIVED', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'COLLECTED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Phase 1 is COD only; an enum so Phase 2 can add ONLINE. */
export const PAYMENT_METHODS = ['COD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Why a delivery slot is closed. `GET /api/delivery-options` reports only the first two (Batch 1 B4). */
export const SLOT_CLOSED_REASONS = ['CUTOFF_PASSED', 'CLOSED_TODAY', 'INACTIVE'] as const;
export type SlotClosedReason = (typeof SLOT_CLOSED_REASONS)[number];

export const EXPRESS_UNAVAILABLE_REASONS = ['DISABLED', 'OUTSIDE_HOURS'] as const;
export type ExpressUnavailableReason = (typeof EXPRESS_UNAVAILABLE_REASONS)[number];
