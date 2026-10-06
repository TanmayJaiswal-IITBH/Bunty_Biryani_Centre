import type { DeliveryOptions, DeliverySlotOption } from '@shared/api-types.js';
import type { DeliveryMode } from '@shared/enums.js';
import { minutesBetween } from '@shared/time.js';

// Pure rules for the delivery choice (Batch 4 §5.3-§5.4, §6). The page keeps the customer's raw
// `Selection`; whether it is still valid is derived from the latest options, never cleared.

export interface Selection {
  deliveryMode: DeliveryMode | null;
  slotId: number | null;
  locationId: number | null;
}

export const NO_SELECTION: Selection = { deliveryMode: null, slotId: null, locationId: null };

/** At or under this many minutes to cutoff, the slot hint becomes a countdown. */
export const CUTOFF_WARNING_MINUTES = 30;

export function isBatchOpen(options: DeliveryOptions): boolean {
  return options.batch.slots.some((slot) => slot.isOpen);
}

/**
 * Express can be chosen: the server says it is available AND there is somewhere to deliver
 * (Batch 1 E2). The API can report `available` with no active locations.
 */
export function isExpressOpen(options: DeliveryOptions): boolean {
  return options.express.available && options.express.locations.length > 0;
}

/**
 * The initial choice: the remembered mode if it is possible today, else the only possible mode,
 * else none. The remembered location applies even when the remembered mode is not possible.
 */
export function defaultSelection(
  remembered: { deliveryMode: DeliveryMode; locationId: number } | null,
  options: DeliveryOptions,
): Selection {
  const possible = {
    BATCH: isBatchOpen(options),
    EXPRESS: isExpressOpen(options),
  };
  let mode: DeliveryMode | null = null;
  if (remembered && possible[remembered.deliveryMode]) {
    mode = remembered.deliveryMode;
  } else if (possible.BATCH !== possible.EXPRESS) {
    mode = possible.BATCH ? 'BATCH' : 'EXPRESS';
  }

  if (mode === 'BATCH') {
    // The slot list is already sorted, so the first match is the earliest.
    const slot = options.batch.slots.find(
      (s) => s.isOpen && s.locationId === remembered?.locationId,
    );
    return {
      deliveryMode: 'BATCH',
      slotId: slot?.id ?? null,
      locationId: slot?.locationId ?? null,
    };
  }
  if (mode === 'EXPRESS') {
    const known =
      remembered && options.express.locations.some((l) => l.id === remembered.locationId);
    return {
      deliveryMode: 'EXPRESS',
      slotId: null,
      locationId: known ? remembered.locationId : null,
    };
  }
  return NO_SELECTION;
}

export type SelectionNotice =
  { kind: 'slotJustClosed'; slot: DeliverySlotOption } | { kind: 'expressUnavailable' };

export interface ResolvedSelection {
  mode: DeliveryMode | null;
  slot: DeliverySlotOption | null;
  location: { id: number; name: string } | null;
  notices: SelectionNotice[];
}

/** What the raw selection means against the latest options. Invalid parts read as "not selected". */
export function resolveSelection(
  selection: Selection,
  options: DeliveryOptions,
): ResolvedSelection {
  if (selection.deliveryMode === 'EXPRESS') {
    if (!isExpressOpen(options)) {
      return { mode: null, slot: null, location: null, notices: [{ kind: 'expressUnavailable' }] };
    }
    const location = options.express.locations.find((l) => l.id === selection.locationId) ?? null;
    return { mode: 'EXPRESS', slot: null, location, notices: [] };
  }
  if (selection.deliveryMode === 'BATCH') {
    const found = options.batch.slots.find((s) => s.id === selection.slotId);
    if (!found) return { mode: 'BATCH', slot: null, location: null, notices: [] };
    if (!found.isOpen) {
      return {
        mode: 'BATCH',
        slot: null,
        location: null,
        notices: [{ kind: 'slotJustClosed', slot: found }],
      };
    }
    return {
      mode: 'BATCH',
      slot: found,
      location: { id: found.locationId, name: found.locationName },
      notices: [],
    };
  }
  return { mode: null, slot: null, location: null, notices: [] };
}

/** Switching method keeps the location (it helps preselect) and drops the slot. */
export function chooseMethod(selection: Selection, mode: DeliveryMode): Selection {
  return { deliveryMode: mode, slotId: null, locationId: selection.locationId };
}

export type CutoffHint =
  { kind: 'orderBy'; cutoffTime: string } | { kind: 'closingSoon'; minutes: number };

/**
 * `serverTime` is the server's time of day at fetch; `elapsedMinutes` is the time since the fetch.
 * Minutes left are clamped to at least 1: the next refresh closes the slot officially.
 */
export function cutoffHint(
  cutoffTime: string,
  serverTime: string,
  elapsedMinutes: number,
): CutoffHint {
  const left = minutesBetween(serverTime, cutoffTime) - elapsedMinutes;
  if (left <= CUTOFF_WARNING_MINUTES) return { kind: 'closingSoon', minutes: Math.max(1, left) };
  return { kind: 'orderBy', cutoffTime };
}
