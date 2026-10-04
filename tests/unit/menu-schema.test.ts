import { describe, expect, it } from 'vitest';
import { publicMenuSchema } from '../../src/shared/schemas/menu';

// The GET /api/menu example from Batch 1 §8.4.
const body = {
  businessDate: '2026-10-04',
  ordersPaused: false,
  items: [
    {
      id: 3,
      name: 'Chicken Biryani',
      description: 'Full plate with raita',
      price: 150,
      imageUrl: null,
      soldOut: false,
      maxQty: 10,
      onlyLeft: null,
    },
    {
      id: 5,
      name: 'Mutton Biryani',
      description: null,
      price: 220,
      imageUrl: 'https://example.com/mutton.jpg',
      soldOut: false,
      maxQty: 3,
      onlyLeft: 3,
    },
  ],
};

describe('publicMenuSchema', () => {
  it('parses the §8.4 example body', () => {
    expect(publicMenuSchema.safeParse(body).success).toBe(true);
  });

  it('rejects leaked keys such as stockRemaining', () => {
    const leaked = { ...body, items: [{ ...body.items[0], stockRemaining: 5 }] };
    expect(publicMenuSchema.safeParse(leaked).success).toBe(false);
  });

  it('rejects a business date that is not YYYY-MM-DD', () => {
    expect(publicMenuSchema.safeParse({ ...body, businessDate: '4 Oct' }).success).toBe(false);
  });
});
