export const DELIVERY_MODES = ['BATCH', 'EXPRESS'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const ORDER_STATUSES = ['ORDER_RECEIVED', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'COLLECTED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Phase 1 is COD only; an enum so Phase 2 can add ONLINE. */
export const PAYMENT_METHODS = ['COD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
