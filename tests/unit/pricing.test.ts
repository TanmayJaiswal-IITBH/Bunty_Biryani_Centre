import { describe, expect, it } from 'vitest';
import { computeTotals } from '../../src/shared/pricing';

const lines = [
  { unitPrice: 150, quantity: 2 },
  { unitPrice: 130, quantity: 1 },
];

describe('computeTotals', () => {
  it('sums food with no delivery fee by default', () => {
    expect(computeTotals(lines)).toEqual({ foodSubtotal: 430, deliveryFee: 0, total: 430 });
  });

  it('adds the delivery fee to the total', () => {
    expect(computeTotals(lines, 30)).toEqual({ foodSubtotal: 430, deliveryFee: 30, total: 460 });
  });

  it('returns zeros for an empty cart', () => {
    expect(computeTotals([])).toEqual({ foodSubtotal: 0, deliveryFee: 0, total: 0 });
  });

  it('rejects non-integer money and negative quantities (Rule 1)', () => {
    expect(() => computeTotals([{ unitPrice: 150.5, quantity: 1 }])).toThrow(RangeError);
    expect(() => computeTotals([{ unitPrice: 150, quantity: -1 }])).toThrow(RangeError);
    expect(() => computeTotals(lines, 2.5)).toThrow(RangeError);
  });
});
