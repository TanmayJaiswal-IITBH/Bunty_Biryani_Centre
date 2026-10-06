import { describe, expect, it } from 'vitest';
import { deliveryOptionsSchema } from '../../src/shared/schemas/delivery';
import {
  addressDetailSchema,
  createOrderSchema,
  customerNameSchema,
  customerPhoneSchema,
} from '../../src/shared/schemas/order';

const UUID = '6f1c2a7e-4b8d-4c1e-9a3f-2d5e8b7c9a10';

// The POST /api/orders example from Batch 1 §8.4.
const batchBody = {
  clientRequestId: UUID,
  customerName: 'Rahul Verma',
  customerPhone: '+91 98765 43210',
  addressDetail: 'Room 214, B block',
  deliveryMode: 'BATCH',
  locationId: 1,
  slotId: 1,
  items: [
    { menuItemId: 3, quantity: 2 },
    { menuItemId: 7, quantity: 1 },
  ],
  expectedTotal: 320,
};

const expressBody = {
  clientRequestId: UUID,
  customerName: 'Rahul Verma',
  customerPhone: '9876543210',
  addressDetail: null,
  deliveryMode: 'EXPRESS',
  locationId: 2,
  items: [{ menuItemId: 3, quantity: 2 }],
  expectedTotal: 350,
};

const msg = (
  schema: { safeParse: (v: unknown) => { error?: { issues: { message: string }[] } } },
  v: unknown,
) => schema.safeParse(v).error?.issues[0]?.message;

describe('createOrderSchema', () => {
  it('13.2-1 parses a batch order and normalises the phone', () => {
    const r = createOrderSchema.safeParse(batchBody);
    expect(r.success).toBe(true);
    expect(r.data?.customerPhone).toBe('9876543210');
    expect(r.data?.deliveryMode).toBe('BATCH');
  });

  it('13.2-1 parses an express order without a slotId', () => {
    const r = createOrderSchema.safeParse(expressBody);
    expect(r.success).toBe(true);
    expect(r.data?.addressDetail).toBeNull();
  });

  it('13.2-2 rejects express with a slotId, batch without one, and unknown keys', () => {
    expect(createOrderSchema.safeParse({ ...expressBody, slotId: 1 }).success).toBe(false);
    const noSlot: Record<string, unknown> = { ...batchBody };
    delete noSlot.slotId;
    expect(createOrderSchema.safeParse(noSlot).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...batchBody, foo: 1 }).success).toBe(false);
  });

  it('13.2-3 rejects bad item lists and quantities', () => {
    const line = { menuItemId: 3, quantity: 1 };
    const withItems = (items: unknown) => createOrderSchema.safeParse({ ...batchBody, items });
    expect(withItems([]).success).toBe(false);
    expect(
      withItems(Array.from({ length: 11 }, (_, i) => ({ menuItemId: i + 1, quantity: 1 }))).success,
    ).toBe(false);
    expect(
      withItems(Array.from({ length: 10 }, (_, i) => ({ menuItemId: i + 1, quantity: 1 }))).success,
    ).toBe(true);
    expect(withItems([{ ...line, quantity: 0 }]).success).toBe(false);
    expect(withItems([{ ...line, quantity: 11 }]).success).toBe(false);
    expect(withItems([{ ...line, quantity: 10 }]).success).toBe(true);
    expect(withItems([{ ...line, quantity: 1.5 }]).success).toBe(false);
  });

  it('13.2-7 rejects a non-UUID clientRequestId and a negative expectedTotal', () => {
    expect(createOrderSchema.safeParse({ ...batchBody, clientRequestId: 'abc' }).success).toBe(
      false,
    );
    expect(createOrderSchema.safeParse({ ...batchBody, expectedTotal: -1 }).success).toBe(false);
  });
});

describe('customerNameSchema', () => {
  it('13.2-4 trims and collapses the name', () => {
    expect(customerNameSchema.parse('  Rahul   Verma ')).toBe('Rahul Verma');
  });
  it('13.2-4 rejects a one-letter name', () => {
    expect(msg(customerNameSchema, 'A')).toBe('Enter your name');
  });
  it('13.2-4 rejects a 61-character name', () => {
    expect(msg(customerNameSchema, 'x'.repeat(61))).toBe('Name is too long');
    expect(customerNameSchema.safeParse('x'.repeat(60)).success).toBe(true);
  });
});

describe('addressDetailSchema', () => {
  it('13.2-5 turns empty, blank and missing into null', () => {
    expect(addressDetailSchema.parse('')).toBeNull();
    expect(addressDetailSchema.parse('   ')).toBeNull();
    expect(addressDetailSchema.parse(undefined)).toBeNull();
  });
  it('13.2-5 rejects 121 characters', () => {
    expect(msg(addressDetailSchema, 'x'.repeat(121))).toBe('Keep it under 120 characters');
    expect(addressDetailSchema.parse('x'.repeat(120))).toBe('x'.repeat(120));
  });
});

describe('customerPhoneSchema', () => {
  it('13.2-6 normalises a formatted number', () => {
    expect(customerPhoneSchema.parse('+91 98765-43210')).toBe('9876543210');
  });
  it('13.2-6 rejects a short number', () => {
    expect(msg(customerPhoneSchema, '12345')).toBe('Enter a 10-digit mobile number');
  });
});

// The GET /api/delivery-options example from Batch 1 §8.4.
const deliveryOptions = {
  businessDate: '2026-10-04',
  serverTime: '19:10',
  ordersPaused: false,
  contactPhone: '9876543210',
  batch: {
    fee: 0,
    slots: [
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
        isOpen: false,
        closedReason: 'CUTOFF_PASSED',
      },
    ],
  },
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
  },
};

describe('deliveryOptionsSchema', () => {
  it('parses the Batch 1 §8.4 example', () => {
    expect(deliveryOptionsSchema.safeParse(deliveryOptions).success).toBe(true);
  });

  it('accepts a null contactPhone and an unavailable express', () => {
    const r = deliveryOptionsSchema.safeParse({
      ...deliveryOptions,
      contactPhone: null,
      express: { ...deliveryOptions.express, available: false, unavailableReason: 'OUTSIDE_HOURS' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects a leaked key on a slot (closedOn)', () => {
    const [first, second] = deliveryOptions.batch.slots;
    const leaked = {
      ...deliveryOptions,
      batch: { ...deliveryOptions.batch, slots: [{ ...first, closedOn: null }, second] },
    };
    expect(deliveryOptionsSchema.safeParse(leaked).success).toBe(false);
  });

  it('rejects INACTIVE as a slot closedReason and bad HH:mm times', () => {
    const [first] = deliveryOptions.batch.slots;
    const withSlot = (slot: unknown) =>
      deliveryOptionsSchema.safeParse({ ...deliveryOptions, batch: { fee: 0, slots: [slot] } })
        .success;
    expect(withSlot({ ...first, isOpen: false, closedReason: 'INACTIVE' })).toBe(false);
    expect(withSlot({ ...first, deliveryTime: '8:00' })).toBe(false);
  });

  it('rejects a malformed contactPhone', () => {
    expect(
      deliveryOptionsSchema.safeParse({ ...deliveryOptions, contactPhone: '12345' }).success,
    ).toBe(false);
  });
});
