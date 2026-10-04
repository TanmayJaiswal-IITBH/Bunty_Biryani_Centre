import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { toDbDate } from '../../src/server/lib/db-date';
import { TEST_TODAY } from '../helpers/clock';
import { prisma } from '../helpers/db';
import { createLocation, createMenuItem, createOrderRow, createSlot } from '../helpers/factories';

/** Postgres check violations come back as Prisma errors carrying SQLSTATE 23514 and the name. */
async function expectCheckViolation(attempt: Promise<unknown>, constraint: string) {
  const err = (await attempt.then(
    () => null,
    (e: unknown) => e,
  )) as { message?: string; meta?: unknown } | null;
  expect(err, `expected ${constraint} to be violated`).not.toBeNull();
  const text = `${err?.message ?? ''} ${JSON.stringify(err?.meta ?? {})}`;
  expect(text).toContain('23514');
  expect(text).toContain(constraint);
}

async function fixtures() {
  const location = await createLocation();
  const slot = await createSlot({ locationId: location.id });
  return { base: { locationId: location.id, slotId: slot.id } };
}

describe('menu_items checks', () => {
  it('rejects negative stock_remaining', async () => {
    await expectCheckViolation(
      prisma.$executeRaw`INSERT INTO menu_items (name, price, daily_stock, stock_remaining, updated_at) VALUES ('x', 10, 5, -1, now())`,
      'menu_items_stock_nonneg',
    );
  });

  it('rejects stock_remaining above daily_stock', async () => {
    await expectCheckViolation(
      prisma.menuItem.create({ data: { name: 'x', price: 10, dailyStock: 5, stockRemaining: 6 } }),
      'menu_items_stock_le_daily',
    );
  });

  it('rejects a price of 0', async () => {
    await expectCheckViolation(
      prisma.menuItem.create({ data: { name: 'x', price: 0 } }),
      'menu_items_price_positive',
    );
  });

  it('rejects an oversell through a conditional-free decrement', async () => {
    const item = await createMenuItem({ stock: 1 });
    await expectCheckViolation(
      prisma.$executeRaw`UPDATE menu_items SET stock_remaining = stock_remaining - 2 WHERE id = ${item.id}`,
      'menu_items_stock_nonneg',
    );
  });
});

describe('delivery_slots checks', () => {
  it.each([
    ['cutoff equal to delivery', '20:00', '20:00', 'delivery_slots_cutoff_first'],
    ['cutoff after delivery', '20:00', '20:30', 'delivery_slots_cutoff_first'],
    ['a delivery time without zero padding', '8:00', '07:30', 'delivery_slots_delivery_fmt'],
    ['an impossible cutoff time', '20:00', '19:75', 'delivery_slots_cutoff_fmt'],
  ])('rejects %s', async (_label, deliveryTime, cutoffTime, constraint) => {
    const location = await createLocation();
    await expectCheckViolation(
      prisma.deliverySlot.create({ data: { locationId: location.id, deliveryTime, cutoffTime } }),
      constraint,
    );
  });
});

describe('delivery_settings checks', () => {
  it('allows only the one seeded row', async () => {
    await expectCheckViolation(
      prisma.$executeRaw`INSERT INTO delivery_settings (id, updated_at) VALUES (2, now())`,
      'delivery_settings_singleton',
    );
    expect(await prisma.deliverySettings.count()).toBe(1);
  });

  it('starts with the documented defaults', async () => {
    const s = await prisma.deliverySettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(s).toMatchObject({
      ordersPaused: false,
      expressEnabled: true,
      expressFee: 30,
      batchFee: 0,
      expressEtaMinMinutes: 30,
      expressEtaMaxMinutes: 40,
      expressOpensAt: '11:00',
      expressClosesAt: '23:00',
      contactPhone: null,
    });
  });

  it('rejects an ETA where min is above max', async () => {
    await expectCheckViolation(
      prisma.deliverySettings.update({ where: { id: 1 }, data: { expressEtaMinMinutes: 50 } }),
      'delivery_settings_eta',
    );
  });
});

describe('orders checks', () => {
  it('rejects a batch order without a slot', async () => {
    const { base } = await fixtures();
    await expectCheckViolation(
      createOrderRow(base, { slotId: null, slotDeliveryTime: null }),
      'orders_mode_fields',
    );
  });

  it('rejects an express order that carries a slot', async () => {
    const { base } = await fixtures();
    await expectCheckViolation(
      createOrderRow(base, {
        deliveryMode: 'EXPRESS',
        expressEtaMinMinutes: 30,
        expressEtaMaxMinutes: 40,
        deliveryFee: 30,
        total: 330,
      }),
      'orders_mode_fields',
    );
  });

  it('accepts a well-formed express order', async () => {
    const { base } = await fixtures();
    const order = await createOrderRow(base, {
      deliveryMode: 'EXPRESS',
      slotId: null,
      slotDeliveryTime: null,
      expressEtaMinMinutes: 30,
      expressEtaMaxMinutes: 40,
      deliveryFee: 30,
      total: 330,
    });
    expect(order.deliveryMode).toBe('EXPRESS');
  });

  it('rejects a total that is not food + fee', async () => {
    const { base } = await fixtures();
    await expectCheckViolation(createOrderRow(base, { total: 299 }), 'orders_total');
  });

  it('rejects a cancelled order with cash collected', async () => {
    const { base } = await fixtures();
    await expectCheckViolation(
      createOrderRow(base, { status: 'CANCELLED', paymentStatus: 'COLLECTED' }),
      'orders_cancel_unpaid',
    );
  });

  it('rejects a phone number that is not a 10-digit Indian mobile', async () => {
    const { base } = await fixtures();
    await expectCheckViolation(
      createOrderRow(base, { customerPhone: '1234567890' }),
      'orders_phone_fmt',
    );
  });

  it('rejects a zero food subtotal', async () => {
    const { base } = await fixtures();
    await expectCheckViolation(
      createOrderRow(base, { foodSubtotal: 0, total: 0 }),
      'orders_amounts',
    );
  });

  it('refuses a duplicate clientRequestId', async () => {
    const { base } = await fixtures();
    const clientRequestId = randomUUID();
    await createOrderRow(base, { clientRequestId });
    await expect(createOrderRow(base, { clientRequestId })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});

describe('order_items checks', () => {
  it('rejects a line_total that is not unit price × quantity', async () => {
    const { base } = await fixtures();
    const order = await createOrderRow(base);
    const item = await createMenuItem();
    await expectCheckViolation(
      prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: item.id,
          itemName: 'Chicken Biryani',
          unitPrice: 150,
          quantity: 2,
          lineTotal: 299,
        },
      }),
      'order_items_line_total',
    );
  });

  it('rejects a quantity of 0', async () => {
    const { base } = await fixtures();
    const order = await createOrderRow(base);
    const item = await createMenuItem();
    await expectCheckViolation(
      prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: item.id,
          itemName: 'x',
          unitPrice: 150,
          quantity: 0,
          lineTotal: 0,
        },
      }),
      'order_items_qty',
    );
  });
});

describe('referential rules', () => {
  it('never lets a location with orders be deleted (nothing is hard-deleted)', async () => {
    const { base } = await fixtures();
    await createOrderRow(base);
    await expect(
      prisma.deliveryLocation.delete({ where: { id: base.locationId } }),
    ).rejects.toBeTruthy();
  });
});

describe('order numbers', () => {
  it('start at BB1001 and count up', async () => {
    const { base } = await fixtures();
    const first = await createOrderRow(base);
    const second = await createOrderRow(base);
    expect(first.orderNumber).toBe('BB1001');
    expect(second.orderNumber).toBe('BB1002');
    expect(toDbDate(TEST_TODAY).getTime()).toBe(first.deliveryDate.getTime());
  });
});
