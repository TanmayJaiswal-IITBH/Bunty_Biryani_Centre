import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHECKOUT_DRAFT_KEY,
  parseDraft,
  parseRemembered,
  serializeDraft,
  type CheckoutDraft,
} from '../../src/client/features/customer/checkout/checkout-storage';
import {
  NO_SELECTION,
  chooseMethod,
  cutoffHint,
  defaultSelection,
  isExpressOpen,
  resolveSelection,
} from '../../src/client/features/customer/checkout/selection';
import { enterTarget } from '../../src/client/features/customer/checkout/DetailsSection';
import { deliverySummaryText } from '../../src/client/features/customer/menu/delivery-summary';
import { readStorage, removeStorage, writeStorage } from '../../src/client/lib/storage';
import { closedSlot, opts } from '../helpers/delivery-fixtures';

const expressOff = { available: false, unavailableReason: 'DISABLED' } as const;

describe('defaultSelection', () => {
  it('S1 preselects nothing when both modes are open and nothing is remembered', () => {
    expect(defaultSelection(null, opts())).toEqual(NO_SELECTION);
  });

  it('S2 preselects the only possible mode', () => {
    const batchGone = opts({ slots: { 1: closedSlot(), 2: closedSlot() } });
    expect(defaultSelection(null, batchGone)).toEqual({
      deliveryMode: 'EXPRESS',
      slotId: null,
      locationId: null,
    });
    expect(defaultSelection(null, opts({ express: expressOff }))).toEqual({
      deliveryMode: 'BATCH',
      slotId: null,
      locationId: null,
    });
  });

  it('S3 applies the remembered mode and location', () => {
    expect(defaultSelection({ deliveryMode: 'BATCH', locationId: 2 }, opts())).toEqual({
      deliveryMode: 'BATCH',
      slotId: 2,
      locationId: 2,
    });
    expect(defaultSelection({ deliveryMode: 'EXPRESS', locationId: 1 }, opts())).toEqual({
      deliveryMode: 'EXPRESS',
      slotId: null,
      locationId: 1,
    });
  });

  it('S4 falls back to batch when the remembered mode is impossible today', () => {
    expect(
      defaultSelection({ deliveryMode: 'EXPRESS', locationId: 2 }, opts({ express: expressOff })),
    ).toEqual({ deliveryMode: 'BATCH', slotId: 2, locationId: 2 });
    expect(
      defaultSelection({ deliveryMode: 'EXPRESS', locationId: 9 }, opts({ express: expressOff })),
    ).toEqual({ deliveryMode: 'BATCH', slotId: null, locationId: null });
  });

  it('S4 a remembered batch location with no open slot preselects the mode only', () => {
    expect(
      defaultSelection(
        { deliveryMode: 'BATCH', locationId: 1 },
        opts({ slots: { 1: closedSlot() } }),
      ),
    ).toEqual({ deliveryMode: 'BATCH', slotId: null, locationId: null });
  });
});

describe('isExpressOpen (F3)', () => {
  it('needs both an available flag and at least one active location', () => {
    expect(isExpressOpen(opts())).toBe(true);
    expect(isExpressOpen(opts({ express: expressOff }))).toBe(false);
    expect(isExpressOpen(opts({ express: { locations: [] } }))).toBe(false);
  });

  it('defaultSelection treats express with no locations as impossible', () => {
    const allClosed = opts({
      slots: { 1: closedSlot(), 2: closedSlot() },
      express: { locations: [] },
    });
    expect(defaultSelection(null, allClosed)).toEqual(NO_SELECTION);
    expect(defaultSelection({ deliveryMode: 'EXPRESS', locationId: 1 }, allClosed)).toEqual(
      NO_SELECTION,
    );
  });

  it('resolveSelection reads a chosen Express as unavailable when it has no locations', () => {
    const resolved = resolveSelection(
      { deliveryMode: 'EXPRESS', slotId: null, locationId: 1 },
      opts({ express: { locations: [] } }),
    );
    expect(resolved).toEqual({
      mode: null,
      slot: null,
      location: null,
      notices: [{ kind: 'expressUnavailable' }],
    });
  });
});

describe('enterTarget (F1)', () => {
  it('moves Name to Mobile number to Room / address, which blurs (null)', () => {
    expect(enterTarget('customerName')).toBe('customerPhone');
    expect(enterTarget('customerPhone')).toBe('addressDetail');
    expect(enterTarget('addressDetail')).toBeNull();
  });
});

describe('resolveSelection', () => {
  it('S5 a slot that closed is unselected with a notice', () => {
    const options = opts({ slots: { 1: closedSlot() } });
    const resolved = resolveSelection({ deliveryMode: 'BATCH', slotId: 1, locationId: 1 }, options);
    expect(resolved.slot).toBeNull();
    expect(resolved.notices).toEqual([{ kind: 'slotJustClosed', slot: options.batch.slots[0] }]);
  });

  it('S5 a vanished slot is unselected silently', () => {
    const resolved = resolveSelection({ deliveryMode: 'BATCH', slotId: 99, locationId: 1 }, opts());
    expect(resolved).toMatchObject({ mode: 'BATCH', slot: null, notices: [] });
  });

  it('S5 an open slot resolves with its location', () => {
    const resolved = resolveSelection({ deliveryMode: 'BATCH', slotId: 2, locationId: 1 }, opts());
    expect(resolved.slot?.id).toBe(2);
    expect(resolved.location).toEqual({ id: 2, name: 'Kanhar' });
  });

  it('S5 unavailable express clears the mode with a notice', () => {
    const resolved = resolveSelection(
      { deliveryMode: 'EXPRESS', slotId: null, locationId: 1 },
      opts({ express: expressOff }),
    );
    expect(resolved.mode).toBeNull();
    expect(resolved.notices).toEqual([{ kind: 'expressUnavailable' }]);
  });

  it('S5 an unknown express location is unselected silently', () => {
    const resolved = resolveSelection(
      { deliveryMode: 'EXPRESS', slotId: null, locationId: 9 },
      opts(),
    );
    expect(resolved).toMatchObject({ mode: 'EXPRESS', location: null, notices: [] });
  });

  it('S5 a known express location resolves', () => {
    const resolved = resolveSelection(
      { deliveryMode: 'EXPRESS', slotId: null, locationId: 2 },
      opts(),
    );
    expect(resolved.location).toEqual({ id: 2, name: 'Kanhar' });
  });
});

describe('cutoffHint', () => {
  it('S6 switches to a countdown at exactly 30 minutes left', () => {
    expect(cutoffHint('19:30', '19:00', 0)).toEqual({ kind: 'closingSoon', minutes: 30 });
    expect(cutoffHint('19:30', '18:59', 0)).toEqual({ kind: 'orderBy', cutoffTime: '19:30' });
  });

  it('S6 never shows fewer than 1 minute', () => {
    expect(cutoffHint('19:30', '19:29', 2)).toEqual({ kind: 'closingSoon', minutes: 1 });
  });

  it('S6 subtracts the time elapsed since the fetch', () => {
    expect(cutoffHint('19:30', '19:10', 5)).toEqual({ kind: 'closingSoon', minutes: 15 });
  });
});

describe('chooseMethod', () => {
  it('S7 keeps the location and clears the slot', () => {
    expect(chooseMethod({ deliveryMode: 'BATCH', slotId: 1, locationId: 1 }, 'EXPRESS')).toEqual({
      deliveryMode: 'EXPRESS',
      slotId: null,
      locationId: 1,
    });
  });
});

describe('checkout storage', () => {
  const draft: CheckoutDraft = {
    selection: { deliveryMode: 'BATCH', slotId: 1, locationId: 1 },
    details: { customerName: 'Rahul', customerPhone: '98765 43210', addressDetail: 'B block' },
  };
  const flat = {
    deliveryMode: 'BATCH',
    slotId: 1,
    locationId: 1,
    customerName: 'Rahul',
    customerPhone: '98765 43210',
    addressDetail: 'B block',
  };

  it('St1 round-trips a draft and reads null as no draft', () => {
    expect(parseDraft(serializeDraft(draft))).toEqual(draft);
    expect(parseDraft(null)).toBeNull();
    expect(CHECKOUT_DRAFT_KEY).toBe('bbc.checkout.v1');
  });

  it('St1 stores the flat spec section 7 shape', () => {
    expect(JSON.parse(serializeDraft(draft))).toEqual(flat);
  });

  it('St2 ignores corrupt or hand-edited drafts', () => {
    const bad = [
      '{bad',
      JSON.stringify({ ...flat, deliveryMode: 'TRUCK' }),
      JSON.stringify({ ...flat, slotId: '1' }),
      JSON.stringify({ ...flat, customerName: 'x'.repeat(10_000) }),
      JSON.stringify({ ...flat, extra: true }),
    ];
    for (const raw of bad) expect(parseDraft(raw)).toBeNull();
  });

  it('St3 parses a remembered customer and normalises the phone', () => {
    const remembered = {
      customerName: 'Rahul Verma',
      customerPhone: '+91 98765 43210',
      addressDetail: null,
      deliveryMode: 'EXPRESS',
      locationId: 2,
    };
    expect(parseRemembered(JSON.stringify(remembered))).toEqual({
      ...remembered,
      customerPhone: '9876543210',
    });
  });

  it('St3 rejects a bad phone, a missing location and corrupt text', () => {
    const ok = {
      customerName: 'Rahul Verma',
      customerPhone: '9876543210',
      addressDetail: null,
      deliveryMode: 'BATCH',
      locationId: 1,
    };
    expect(parseRemembered(JSON.stringify({ ...ok, customerPhone: '12345' }))).toBeNull();
    expect(parseRemembered(JSON.stringify({ ...ok, locationId: undefined }))).toBeNull();
    expect(parseRemembered('{bad')).toBeNull();
    expect(parseRemembered(null)).toBeNull();
  });
});

describe('storage areas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fake(): Storage {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    } as unknown as Storage;
  }

  it('St4 the session area is separate from local and removeStorage deletes', () => {
    const local = fake();
    const session = fake();
    vi.stubGlobal('window', { localStorage: local, sessionStorage: session });
    writeStorage('k', 'v', 'session');
    expect(session.getItem('k')).toBe('v');
    expect(local.getItem('k')).toBeNull();
    expect(readStorage('k', 'session')).toBe('v');
    expect(readStorage('k')).toBeNull();
    removeStorage('k', 'session');
    expect(session.getItem('k')).toBeNull();
  });

  it('St4 with no window every call is a no-op', () => {
    expect(readStorage('k', 'session')).toBeNull();
    expect(() => {
      writeStorage('k', 'v', 'session');
      removeStorage('k', 'session');
    }).not.toThrow();
  });
});

describe('deliverySummaryText', () => {
  it('T1 lists open slots and the express offer', () => {
    expect(deliverySummaryText(opts())).toBe(
      'Batch: MSH 8:00 PM · Kanhar 8:45 PM — Express approx. 30–40 min (+₹30)',
    );
  });

  it('T2 lists open slots only, says when none are open, omits unavailable express', () => {
    expect(deliverySummaryText(opts({ slots: { 1: closedSlot() } }))).toBe(
      'Batch: Kanhar 8:45 PM — Express approx. 30–40 min (+₹30)',
    );
    expect(deliverySummaryText(opts({ slots: { 1: closedSlot(), 2: closedSlot() } }))).toBe(
      'Batch: closed for today — Express approx. 30–40 min (+₹30)',
    );
    expect(deliverySummaryText(opts({ express: expressOff }))).toBe(
      'Batch: MSH 8:00 PM · Kanhar 8:45 PM',
    );
    // F3: "available" with no active locations is not an offer.
    expect(deliverySummaryText(opts({ express: { locations: [] } }))).toBe(
      'Batch: MSH 8:00 PM · Kanhar 8:45 PM',
    );
  });
});
