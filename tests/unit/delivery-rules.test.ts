import { describe, expect, it } from 'vitest';
import {
  computeDeliveryOptions,
  expressStatus,
  slotStatus,
  toSlotInput,
  type LocationInput,
  type SettingsInput,
  type SlotInput,
} from '../../src/server/services/delivery.service';

const MSH: LocationInput = { id: 1, name: 'MSH', isActive: true, sortOrder: 0 };
const KANHAR: LocationInput = { id: 2, name: 'Kanhar', isActive: true, sortOrder: 1 };

const SLOT_MSH: SlotInput = {
  id: 1,
  locationId: 1,
  deliveryTime: '20:00',
  cutoffTime: '19:30',
  isActive: true,
  closedOn: null,
};
const SLOT_KANHAR: SlotInput = {
  id: 2,
  locationId: 2,
  deliveryTime: '20:45',
  cutoffTime: '20:15',
  isActive: true,
  closedOn: null,
};

const SETTINGS: SettingsInput = {
  ordersPaused: false,
  expressEnabled: true,
  expressFee: 30,
  expressEtaMinMinutes: 30,
  expressEtaMaxMinutes: 40,
  expressOpensAt: '11:00',
  expressClosesAt: '23:00',
  batchFee: 0,
  contactPhone: null,
};

const at = (time: string) => ({ date: '2026-10-04', time });

function options(
  over: {
    settings?: Partial<SettingsInput>;
    slots?: Array<SlotInput & { location: LocationInput }>;
    locations?: LocationInput[];
    time?: string;
  } = {},
) {
  return computeDeliveryOptions({
    settings: { ...SETTINGS, ...over.settings },
    slots: over.slots ?? [
      { ...SLOT_MSH, location: MSH },
      { ...SLOT_KANHAR, location: KANHAR },
    ],
    locations: over.locations ?? [MSH, KANHAR],
    today: at(over.time ?? '19:10'),
  });
}

describe('slotStatus', () => {
  it('13.1-1 is open one minute before the cutoff and closed from the cutoff on', () => {
    expect(slotStatus(SLOT_MSH, MSH, at('19:29'))).toEqual({ isOpen: true, closedReason: null });
    expect(slotStatus(SLOT_MSH, MSH, at('19:30'))).toEqual({
      isOpen: false,
      closedReason: 'CUTOFF_PASSED',
    });
    expect(slotStatus(SLOT_MSH, MSH, at('19:31'))).toEqual({
      isOpen: false,
      closedReason: 'CUTOFF_PASSED',
    });
  });

  it('13.1-2 is closed on the day it is closed for, open when closed for another day', () => {
    expect(slotStatus({ ...SLOT_MSH, closedOn: '2026-10-04' }, MSH, at('10:00'))).toEqual({
      isOpen: false,
      closedReason: 'CLOSED_TODAY',
    });
    expect(slotStatus({ ...SLOT_MSH, closedOn: '2026-10-03' }, MSH, at('10:00'))).toEqual({
      isOpen: true,
      closedReason: null,
    });
  });

  it('13.1-2 reports CLOSED_TODAY, not CUTOFF_PASSED, when both apply', () => {
    expect(slotStatus({ ...SLOT_MSH, closedOn: '2026-10-04' }, MSH, at('21:00'))).toEqual({
      isOpen: false,
      closedReason: 'CLOSED_TODAY',
    });
  });

  it('13.1-3 reports INACTIVE for an inactive slot or an inactive location, before any other reason', () => {
    const inactiveSlot = { ...SLOT_MSH, isActive: false, closedOn: '2026-10-04' };
    expect(slotStatus(inactiveSlot, MSH, at('21:00'))).toEqual({
      isOpen: false,
      closedReason: 'INACTIVE',
    });
    expect(slotStatus(SLOT_MSH, { ...MSH, isActive: false }, at('10:00'))).toEqual({
      isOpen: false,
      closedReason: 'INACTIVE',
    });
  });
});

describe('expressStatus', () => {
  it('13.1-4 is available from the opening minute to one minute before closing', () => {
    expect(expressStatus(SETTINGS, at('10:59'))).toEqual({
      available: false,
      unavailableReason: 'OUTSIDE_HOURS',
    });
    expect(expressStatus(SETTINGS, at('11:00'))).toEqual({
      available: true,
      unavailableReason: null,
    });
    expect(expressStatus(SETTINGS, at('22:59'))).toEqual({
      available: true,
      unavailableReason: null,
    });
    expect(expressStatus(SETTINGS, at('23:00'))).toEqual({
      available: false,
      unavailableReason: 'OUTSIDE_HOURS',
    });
  });

  it('13.1-4 reports DISABLED when switched off, even inside the hours', () => {
    expect(expressStatus({ ...SETTINGS, expressEnabled: false }, at('15:00'))).toEqual({
      available: false,
      unavailableReason: 'DISABLED',
    });
  });
});

describe('computeDeliveryOptions', () => {
  it('13.1-3 leaves inactive slots out of the batch slots', () => {
    const result = options({
      slots: [
        { ...SLOT_MSH, isActive: false, location: MSH },
        { ...SLOT_KANHAR, location: KANHAR },
      ],
    });
    expect(result.batch.slots.map((s) => s.id)).toEqual([2]);
  });

  it('13.1-3 leaves out an active slot at an inactive location', () => {
    const inactiveKanhar = { ...KANHAR, isActive: false };
    const result = options({
      slots: [
        { ...SLOT_MSH, location: MSH },
        { ...SLOT_KANHAR, location: inactiveKanhar },
      ],
      locations: [MSH],
    });
    expect(result.batch.slots.map((s) => s.id)).toEqual([1]);
  });

  it('13.1-3 lists only active locations for express', () => {
    const result = options({ locations: [MSH, { ...KANHAR, isActive: false }] });
    expect(result.express.locations).toEqual([{ id: 1, name: 'MSH' }]);
  });

  it('13.1-5 reports paused orders without changing the batch or express options', () => {
    const open = options();
    const paused = options({ settings: { ordersPaused: true } });
    expect(open.ordersPaused).toBe(false);
    expect(paused.ordersPaused).toBe(true);
    expect(paused.batch).toEqual(open.batch);
    expect(paused.express).toEqual(open.express);
  });

  it('13.1-6 builds the ETA text with an en dash and reflects the configured fees', () => {
    const result = options();
    expect(result.express.etaText).toBe('30–40 minutes');
    expect(result.express.etaMinMinutes).toBe(30);
    expect(result.express.etaMaxMinutes).toBe(40);

    const priced = options({ settings: { batchFee: 10, expressFee: 45 } });
    expect(priced.batch.fee).toBe(10);
    expect(priced.express.fee).toBe(45);
  });

  it('13.1-7 sorts slots by time, then location order, then id', () => {
    const msh2045 = { ...SLOT_MSH, id: 3, deliveryTime: '20:45', location: MSH };
    const kanhar2000 = { ...SLOT_KANHAR, id: 4, deliveryTime: '20:00', location: KANHAR };
    const msh2000 = { ...SLOT_MSH, id: 5, location: MSH };
    const result = options({ slots: [kanhar2000, msh2045, msh2000] });
    expect(result.batch.slots.map((s) => [s.locationName, s.deliveryTime])).toEqual([
      ['MSH', '20:00'],
      ['Kanhar', '20:00'],
      ['MSH', '20:45'],
    ]);
  });

  it('13.1-7 falls back to the slot id for the same time and the same location order', () => {
    const later = { ...SLOT_MSH, id: 9, location: MSH };
    const earlier = { ...SLOT_MSH, id: 7, location: { ...KANHAR, sortOrder: 0 } };
    const result = options({ slots: [later, earlier] });
    expect(result.batch.slots.map((s) => s.id)).toEqual([7, 9]);
  });

  it('13.1-7 orders express locations by sortOrder, then id', () => {
    const a = { id: 5, name: 'A', isActive: true, sortOrder: 1 };
    const b = { id: 4, name: 'B', isActive: true, sortOrder: 1 };
    const c = { id: 9, name: 'C', isActive: true, sortOrder: 0 };
    const result = options({ locations: [a, b, c] });
    expect(result.express.locations.map((l) => l.id)).toEqual([9, 4, 5]);
  });

  it('maps fields one by one, so no internal column reaches the response', () => {
    const result = options({
      slots: [{ ...SLOT_MSH, closedOn: '2026-10-04', location: MSH }],
    });
    expect(result.batch.slots).toEqual([
      {
        id: 1,
        locationId: 1,
        locationName: 'MSH',
        deliveryTime: '20:00',
        cutoffTime: '19:30',
        isOpen: false,
        closedReason: 'CLOSED_TODAY',
      },
    ]);
    expect(result.express).toEqual({
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
    });
  });

  it('returns the business date, server time and contact phone', () => {
    const result = options({ settings: { contactPhone: '9876543210' }, time: '19:10' });
    expect(result.businessDate).toBe('2026-10-04');
    expect(result.serverTime).toBe('19:10');
    expect(result.contactPhone).toBe('9876543210');
  });
});

describe('toSlotInput', () => {
  it('converts closedOn to a YYYY-MM-DD string and keeps every other field', () => {
    const row = { id: 1, deliveryTime: '20:00', closedOn: new Date('2026-10-04T00:00:00.000Z') };
    expect(toSlotInput(row)).toEqual({ id: 1, deliveryTime: '20:00', closedOn: '2026-10-04' });
  });

  it('keeps a null closedOn', () => {
    expect(toSlotInput({ id: 1, closedOn: null })).toEqual({ id: 1, closedOn: null });
  });
});
