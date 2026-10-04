import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClock } from '../../src/server/lib/clock';
import { fromDbDate, toDbDate } from '../../src/server/lib/db-date';
import { formatINR } from '../../src/shared/money';
import { formatPhone, normalizeIndianMobile } from '../../src/shared/phone';

describe('formatINR', () => {
  it.each([
    [0, '₹0'],
    [330, '₹330'],
    [1340, '₹1,340'],
    [100000, '₹1,00,000'],
  ])('%i → %s', (n, expected) => {
    expect(formatINR(n)).toBe(expected);
  });
});

describe('normalizeIndianMobile', () => {
  it.each(['9876543210', '98765 43210', '+91 98765-43210', '919876543210', '09876543210'])(
    'accepts %s',
    (input) => {
      expect(normalizeIndianMobile(input)).toBe('9876543210');
    },
  );

  it.each(['5876543210', '987654321', '98765432101', 'abc', '', '+91 12345'])(
    'rejects %s',
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );

  it('formats for display', () => {
    expect(formatPhone('9876543210')).toBe('98765 43210');
  });
});

describe('createClock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('without an override follows the real clock', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(createClock().now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('with an override starts there and keeps moving forward', () => {
    vi.setSystemTime(new Date('2030-06-06T06:06:06Z'));
    const clock = createClock('2026-10-04T13:40:00Z');
    expect(clock.now().toISOString()).toBe('2026-10-04T13:40:00.000Z');
    vi.advanceTimersByTime(90_000);
    expect(clock.now().toISOString()).toBe('2026-10-04T13:41:30.000Z');
  });
});

describe('db dates', () => {
  it('round-trips a business date through UTC midnight', () => {
    expect(toDbDate('2026-10-04').toISOString()).toBe('2026-10-04T00:00:00.000Z');
    expect(fromDbDate(toDbDate('2026-10-04'))).toBe('2026-10-04');
  });
});
