import { afterEach, describe, expect, it } from 'vitest';
import {
  addMinutesIST,
  compareHHmm,
  etaText,
  formatBusinessDate,
  formatTime12h,
  formatWindow,
  isValidHHmm,
  nowIST,
} from '../../src/shared/time';

const at = (iso: string) => nowIST({ now: () => new Date(iso) });

describe('nowIST', () => {
  it('is 23:59 on the same IST date one second before the IST midnight', () => {
    const n = at('2026-10-04T18:29:59Z');
    expect([n.date, n.time]).toEqual(['2026-10-04', '23:59']);
  });

  it('rolls to the next IST date at 18:30 UTC', () => {
    const n = at('2026-10-04T18:30:00Z');
    expect([n.date, n.time]).toEqual(['2026-10-05', '00:00']);
  });

  it('never produces 24:00', () => {
    expect(at('2026-10-04T18:30:00Z').time).toBe('00:00');
  });

  describe('with a non-IST process time zone', () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it('still returns IST', () => {
      process.env.TZ = 'America/New_York';
      const a = at('2026-10-04T18:29:59Z');
      const b = at('2026-10-04T18:30:00Z');
      expect([a.date, a.time]).toEqual(['2026-10-04', '23:59']);
      expect([b.date, b.time]).toEqual(['2026-10-05', '00:00']);
    });
  });
});

describe('formatTime12h', () => {
  it.each([
    ['00:05', '12:05 AM'],
    ['12:00', '12:00 PM'],
    ['20:00', '8:00 PM'],
    ['07:30', '7:30 AM'],
  ])('%s → %s', (input, expected) => {
    expect(formatTime12h(input)).toBe(expected);
  });
});

describe('formatWindow', () => {
  it('shares the meridiem when both ends match', () => {
    expect(formatWindow('19:40', '19:50')).toBe('7:40–7:50 PM');
  });
  it('shows both meridiems across noon', () => {
    expect(formatWindow('11:50', '12:00')).toBe('11:50 AM–12:00 PM');
  });
});

describe('small helpers', () => {
  it('etaText uses an en dash', () => {
    expect(etaText(30, 40)).toBe('30–40 minutes');
  });
  it('validates HH:mm strictly', () => {
    expect(isValidHHmm('07:30')).toBe(true);
    expect(isValidHHmm('7:30')).toBe(false);
    expect(isValidHHmm('24:00')).toBe(false);
    expect(isValidHHmm('12:60')).toBe(false);
  });
  it('compares zero-padded times as strings', () => {
    expect(compareHHmm('09:00', '10:00')).toBe(-1);
    expect(compareHHmm('19:30', '19:30')).toBe(0);
    expect(compareHHmm('20:00', '19:59')).toBe(1);
  });
  it('adds minutes in IST, across midnight', () => {
    expect(addMinutesIST(new Date('2026-10-04T13:40:00Z'), 30)).toBe('19:40'); // 19:10 IST + 30
    expect(addMinutesIST(new Date('2026-10-04T18:20:00Z'), 20)).toBe('00:10');
  });
  it('formats a business date without depending on the locale', () => {
    expect(formatBusinessDate('2026-10-04')).toBe('Sun, 4 Oct');
    expect(formatBusinessDate('2026-01-01')).toBe('Thu, 1 Jan');
  });
});
