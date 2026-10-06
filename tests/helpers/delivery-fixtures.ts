import type {
  DeliveryOptions,
  DeliverySlotOption,
  ExpressOptions,
} from '../../src/shared/api-types';

/** Override shape: top-level fields, `batchFee`, `slots` keyed by slot id (merged into that slot), `express` (merged). */
export interface DeliveryOptionsOverride {
  serverTime?: string;
  ordersPaused?: boolean;
  contactPhone?: string | null;
  batchFee?: number;
  slots?: Record<number, Partial<DeliverySlotOption>>;
  express?: Partial<ExpressOptions>;
}

/** A slot override that closes it, e.g. `opts({ slots: { 1: closedSlot() } })`. */
export function closedSlot(
  closedReason: 'CUTOFF_PASSED' | 'CLOSED_TODAY' = 'CUTOFF_PASSED',
): Partial<DeliverySlotOption> {
  return { isOpen: false, closedReason };
}

/** The Batch 1 §8.4 delivery-options example (19:10, both slots open, express available). */
export function opts(over: DeliveryOptionsOverride = {}): DeliveryOptions {
  const slots: DeliverySlotOption[] = [
    {
      id: 1,
      locationId: 1,
      locationName: 'MSH',
      deliveryTime: '20:00',
      cutoffTime: '19:30',
      isOpen: true,
      closedReason: null,
    },
    {
      id: 2,
      locationId: 2,
      locationName: 'Kanhar',
      deliveryTime: '20:45',
      cutoffTime: '20:15',
      isOpen: true,
      closedReason: null,
    },
  ].map((slot) => ({ ...slot, ...over.slots?.[slot.id] }));
  return {
    businessDate: '2026-10-04',
    serverTime: over.serverTime ?? '19:10',
    ordersPaused: over.ordersPaused ?? false,
    contactPhone: over.contactPhone ?? null,
    batch: { fee: over.batchFee ?? 0, slots },
    express: {
      available: true,
      unavailableReason: null,
      fee: 30,
      etaMinMinutes: 30,
      etaMaxMinutes: 40,
      etaText: '30–40 minutes',
      opensAt: '11:00',
      closesAt: '23:00',
      locations: [
        { id: 1, name: 'MSH' },
        { id: 2, name: 'Kanhar' },
      ],
      ...over.express,
    },
  };
}
