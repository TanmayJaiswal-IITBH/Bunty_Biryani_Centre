import { describe, expect, it } from 'vitest';
import type { PublicMenu } from '../../src/shared/api-types';
import { cartView } from '../../src/client/features/customer/cart/cart-reducer';
import {
  FIELD_ORDER,
  buildOrderRequest,
  type DetailsForm,
} from '../../src/client/features/customer/checkout/build-order-request';
import type { Selection } from '../../src/client/features/customer/checkout/selection';
import { closedSlot, opts } from '../helpers/delivery-fixtures';

const UUID = '6f1c2a7e-4b8d-4c1e-9a3f-2d5e8b7c9a10';

function menu(price = 150): PublicMenu {
  return {
    businessDate: '2026-10-04',
    ordersPaused: false,
    items: [
      {
        id: 3,
        name: 'Chicken Biryani',
        description: null,
        price,
        imageUrl: null,
        soldOut: false,
        maxQty: 10,
        onlyLeft: null,
      },
    ],
  };
}
const cart = {
  businessDate: '2026-10-04',
  lines: [{ menuItemId: 3, quantity: 2, name: 'Chicken Biryani' }],
};
const view = cartView(menu(), cart);
const details: DetailsForm = {
  customerName: 'Rahul Verma',
  customerPhone: '98765 43210',
  addressDetail: '',
};
const none: Selection = { deliveryMode: null, slotId: null, locationId: null };

function build(
  selection: Selection,
  over: { details?: DetailsForm; options?: ReturnType<typeof opts>; cartView?: typeof view } = {},
) {
  return buildOrderRequest({
    cartView: over.cartView ?? view,
    selection,
    details: over.details ?? details,
    options: over.options ?? opts(),
    clientRequestId: UUID,
  });
}

describe('buildOrderRequest', () => {
  it('13.3-1 a batch request takes its location from the slot, not from a stale selection', () => {
    const result = build({ deliveryMode: 'BATCH', slotId: 1, locationId: 2 });
    expect(result).toEqual({
      ok: true,
      request: {
        clientRequestId: UUID,
        customerName: 'Rahul Verma',
        customerPhone: '9876543210',
        addressDetail: null,
        deliveryMode: 'BATCH',
        locationId: 1,
        slotId: 1,
        items: [{ menuItemId: 3, quantity: 2 }],
        expectedTotal: 300,
      },
    });
  });

  it('13.3-2 an express request adds the fee and has no slotId key', () => {
    const result = build({ deliveryMode: 'EXPRESS', slotId: null, locationId: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.expectedTotal).toBe(330);
    expect(result.request.locationId).toBe(2);
    expect('slotId' in result.request).toBe(false);
  });

  it('13.3-3 a missing method, slot or location names exactly that field', () => {
    expect(build(none)).toEqual({
      ok: false,
      errors: { deliveryMode: 'Choose a delivery method' },
    });
    expect(build({ deliveryMode: 'BATCH', slotId: null, locationId: null })).toEqual({
      ok: false,
      errors: { slotId: 'Choose a delivery slot' },
    });
    expect(build({ deliveryMode: 'EXPRESS', slotId: null, locationId: null })).toEqual({
      ok: false,
      errors: { locationId: 'Choose where to deliver' },
    });
  });

  it('13.3-4 a closed slot or unavailable express is an error', () => {
    expect(
      build(
        { deliveryMode: 'BATCH', slotId: 1, locationId: 1 },
        { options: opts({ slots: { 1: closedSlot() } }) },
      ),
    ).toEqual({ ok: false, errors: { slotId: 'Orders for this delivery slot are closed.' } });
    expect(
      build(
        { deliveryMode: 'EXPRESS', slotId: null, locationId: 1 },
        { options: opts({ express: { available: false, unavailableReason: 'DISABLED' } }) },
      ),
    ).toEqual({
      ok: false,
      errors: { deliveryMode: 'Express delivery is currently unavailable.' },
    });
  });

  it('F3 express "available" with no active locations is unavailable, not needLocation', () => {
    expect(
      build(
        { deliveryMode: 'EXPRESS', slotId: null, locationId: 1 },
        { options: opts({ express: { locations: [] } }) },
      ),
    ).toEqual({
      ok: false,
      errors: { deliveryMode: 'Express delivery is currently unavailable.' },
    });
  });

  it('13.3-4 an unknown express location is needLocation', () => {
    expect(build({ deliveryMode: 'EXPRESS', slotId: null, locationId: 9 })).toEqual({
      ok: false,
      errors: { locationId: 'Choose where to deliver' },
    });
  });

  it('B5 delivery and detail errors arrive together; a vanished slot is needSlot', () => {
    expect(
      build(none, { details: { customerName: 'A', customerPhone: '12345', addressDetail: '' } }),
    ).toEqual({
      ok: false,
      errors: {
        deliveryMode: 'Choose a delivery method',
        customerName: 'Enter your name',
        customerPhone: 'Enter a 10-digit mobile number',
      },
    });
    expect(build({ deliveryMode: 'BATCH', slotId: 99, locationId: 1 })).toEqual({
      ok: false,
      errors: { slotId: 'Choose a delivery slot' },
    });
  });

  it('B6 the total uses the latest menu price', () => {
    const repriced = cartView(menu(160), cart);
    const result = build(
      { deliveryMode: 'BATCH', slotId: 1, locationId: 1 },
      { cartView: repriced },
    );
    expect(result.ok && result.request.expectedTotal).toBe(320);
  });

  it('B7 FIELD_ORDER is the focus order', () => {
    expect(FIELD_ORDER).toEqual([
      'items',
      'deliveryMode',
      'slotId',
      'locationId',
      'customerName',
      'customerPhone',
      'addressDetail',
    ]);
  });

  it('B8 an empty cart reports items (schema issue mapped defensively)', () => {
    const result = build(
      { deliveryMode: 'BATCH', slotId: 1, locationId: 1 },
      { cartView: cartView(menu(), { businessDate: '2026-10-04', lines: [] }) },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['items']);
  });
});
