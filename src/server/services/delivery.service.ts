import type { DeliveryOptions, DeliverySlotOption } from '../../shared/api-types.js';
import type { ExpressUnavailableReason, SlotClosedReason } from '../../shared/enums.js';
import { compareHHmm, etaText, type IstNow } from '../../shared/time.js';
import type { PrismaClient } from '../db.js';
import { fromDbDate } from '../lib/db-date.js';

/**
 * Slot and express availability (Batch 1 §6.5–6.6, B3, B4, E1, E3). These functions are pure and
 * take plain inputs, so `GET /api/delivery-options` and Batch 5's `createOrder` apply exactly the
 * same rules. Neither reads `ordersPaused`: the pause is reported and enforced separately.
 */

/** The business date and time of day, as `nowIST` produces them. */
export type Today = Pick<IstNow, 'date' | 'time'>;

export interface LocationInput {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

/** `closedOn` is a `YYYY-MM-DD` string; `toSlotInput` converts a Prisma row. */
export interface SlotInput {
  id: number;
  locationId: number;
  deliveryTime: string;
  cutoffTime: string;
  isActive: boolean;
  closedOn: string | null;
}

/** A Prisma `DeliverySettings` row satisfies this. */
export interface SettingsInput {
  ordersPaused: boolean;
  expressEnabled: boolean;
  expressFee: number;
  expressEtaMinMinutes: number;
  expressEtaMaxMinutes: number;
  expressOpensAt: string;
  expressClosesAt: string;
  batchFee: number;
  contactPhone: string | null;
}

export interface SlotStatus {
  isOpen: boolean;
  closedReason: SlotClosedReason | null;
}

export interface ExpressStatus {
  available: boolean;
  unavailableReason: ExpressUnavailableReason | null;
}

/** Check order matters: inactive, then closed for today, then past the cutoff. */
export function slotStatus(slot: SlotInput, location: LocationInput, today: Today): SlotStatus {
  if (!slot.isActive || !location.isActive) return { isOpen: false, closedReason: 'INACTIVE' };
  if (slot.closedOn === today.date) return { isOpen: false, closedReason: 'CLOSED_TODAY' };
  if (compareHHmm(today.time, slot.cutoffTime) >= 0) {
    return { isOpen: false, closedReason: 'CUTOFF_PASSED' };
  }
  return { isOpen: true, closedReason: null };
}

/** Open from `expressOpensAt` up to, but not including, `expressClosesAt`. */
export function expressStatus(
  s: Pick<SettingsInput, 'expressEnabled' | 'expressOpensAt' | 'expressClosesAt'>,
  today: Today,
): ExpressStatus {
  if (!s.expressEnabled) return { available: false, unavailableReason: 'DISABLED' };
  if (
    compareHHmm(today.time, s.expressOpensAt) < 0 ||
    compareHHmm(today.time, s.expressClosesAt) >= 0
  ) {
    return { available: false, unavailableReason: 'OUTSIDE_HOURS' };
  }
  return { available: true, unavailableReason: null };
}

/** Slots sort by delivery time, then location order, then id (Batch 4 decision 2). */
function compareSlots(
  a: SlotInput & { location: LocationInput },
  b: SlotInput & { location: LocationInput },
): number {
  return (
    compareHHmm(a.deliveryTime, b.deliveryTime) ||
    a.location.sortOrder - b.location.sortOrder ||
    a.id - b.id
  );
}

export function computeDeliveryOptions(input: {
  settings: SettingsInput;
  slots: Array<SlotInput & { location: LocationInput }>;
  locations: LocationInput[];
  today: Today;
}): DeliveryOptions {
  const { settings, today } = input;

  const slots: DeliverySlotOption[] = [];
  for (const slot of [...input.slots].sort(compareSlots)) {
    const { isOpen, closedReason } = slotStatus(slot, slot.location, today);
    if (closedReason === 'INACTIVE') continue;
    slots.push({
      id: slot.id,
      locationId: slot.locationId,
      locationName: slot.location.name,
      deliveryTime: slot.deliveryTime,
      cutoffTime: slot.cutoffTime,
      isOpen,
      closedReason,
    });
  }

  const express = expressStatus(settings, today);
  const locations = input.locations
    .filter((location) => location.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((location) => ({ id: location.id, name: location.name }));

  return {
    businessDate: today.date,
    serverTime: today.time,
    ordersPaused: settings.ordersPaused,
    contactPhone: settings.contactPhone,
    batch: { fee: settings.batchFee, slots },
    express: {
      available: express.available,
      unavailableReason: express.unavailableReason,
      fee: settings.expressFee,
      etaMinMinutes: settings.expressEtaMinMinutes,
      etaMaxMinutes: settings.expressEtaMaxMinutes,
      etaText: etaText(settings.expressEtaMinMinutes, settings.expressEtaMaxMinutes),
      opensAt: settings.expressOpensAt,
      closesAt: settings.expressClosesAt,
      locations,
    },
  };
}

/** Converts a Prisma slot row to the rules' input at the boundary (Batch 1 T5). */
export function toSlotInput<T extends { closedOn: Date | null }>(
  row: T,
): Omit<T, 'closedOn'> & { closedOn: string | null } {
  return { ...row, closedOn: row.closedOn === null ? null : fromDbDate(row.closedOn) };
}

/** What checkout shows (Batch 4 §3). Read-only. */
export async function getDeliveryOptions(
  prisma: PrismaClient,
  today: IstNow,
): Promise<DeliveryOptions> {
  const [settings, locations, slotRows] = await Promise.all([
    prisma.deliverySettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.deliveryLocation.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.deliverySlot.findMany({ where: { isActive: true }, include: { location: true } }),
  ]);

  return computeDeliveryOptions({
    settings,
    locations,
    slots: slotRows.map(toSlotInput),
    today,
  });
}
