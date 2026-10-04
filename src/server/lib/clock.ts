import type { Clock } from '../../shared/time.js';

export type { Clock };

/**
 * The only source of "now" for business decisions. With an override (tests / e2e only), time
 * starts at the override instant and still moves forward.
 */
export function createClock(override?: string): Clock {
  if (!override) return { now: () => new Date() };
  const base = new Date(override).getTime();
  const startedAt = Date.now();
  return { now: () => new Date(base + (Date.now() - startedAt)) };
}
