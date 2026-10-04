import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { publicMenuSchema } from '../../src/shared/schemas/menu';
import type { PublicMenu } from '../../src/shared/api-types';
import { makeApp } from '../helpers/app';
import { prisma } from '../helpers/db';
import { createMenuItem } from '../helpers/factories';

// 2026-10-04 18:30 IST
const NOW = '2026-10-04T13:00:00.000Z';

async function getMenu(now: string = NOW) {
  const { app } = makeApp({ now });
  const res = await request(app).get('/api/menu');
  expect(res.status).toBe(200);
  return res.body as PublicMenu;
}

describe('GET /api/menu', () => {
  it('lists only active + available items', async () => {
    await createMenuItem({ name: 'A' });
    await createMenuItem({ name: 'B', isAvailable: false });
    await createMenuItem({ name: 'C', isActive: false });
    const menu = await getMenu();
    expect(menu.items.map((i) => i.name)).toEqual(['A']);
    expect(menu.businessDate).toBe('2026-10-04');
  });

  it("derives maxQty / onlyLeft from today's stock", async () => {
    await createMenuItem({ name: 'Eight', stock: 8, sortOrder: 0 });
    await createMenuItem({ name: 'Three', stock: 3, sortOrder: 1 });
    await createMenuItem({ name: 'Twenty', stock: 20, sortOrder: 2 });
    const { items } = await getMenu();
    const by = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(by.Eight).toMatchObject({ soldOut: false, maxQty: 8, onlyLeft: null });
    expect(by.Three).toMatchObject({ soldOut: false, maxQty: 3, onlyLeft: 3 });
    expect(by.Twenty).toMatchObject({ soldOut: false, maxQty: 10, onlyLeft: null });
  });

  it('stock from another day is sold out', async () => {
    await createMenuItem({ name: 'Yesterday', stock: 8, stockDate: '2026-10-03', sortOrder: 0 });
    await createMenuItem({ name: 'Never', stock: 8, stockDate: null, sortOrder: 1 });
    const { items } = await getMenu();
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item).toMatchObject({ soldOut: true, maxQty: 0, onlyLeft: null });
    }
  });

  it('zero stock today is sold out', async () => {
    await createMenuItem({ name: 'Gone', stock: 0 });
    const { items } = await getMenu();
    expect(items[0]).toMatchObject({ soldOut: true, maxQty: 0, onlyLeft: null });
  });

  it('orders orderable items, then sold-out items', async () => {
    await createMenuItem({ name: 'Raita', sortOrder: 2 });
    await createMenuItem({ name: 'Egg', sortOrder: 1, stock: 0 });
    await createMenuItem({ name: 'Paneer', sortOrder: 1 });
    await createMenuItem({ name: 'Chicken', sortOrder: 1 });
    await createMenuItem({ name: 'Veg', sortOrder: 0, stockDate: null });
    const { items } = await getMenu();
    expect(items.map((i) => i.name)).toEqual(['Chicken', 'Paneer', 'Raita', 'Veg', 'Egg']);
  });

  it('breaks sortOrder+name ties by id', async () => {
    const first = await createMenuItem({ name: 'Chai' });
    const second = await createMenuItem({ name: 'Chai' });
    const { items } = await getMenu();
    expect(items.map((i) => i.id)).toEqual([first.id, second.id]);
  });

  it('reports ordersPaused', async () => {
    expect((await getMenu()).ordersPaused).toBe(false);
    await prisma.deliverySettings.update({ where: { id: 1 }, data: { ordersPaused: true } });
    expect((await getMenu()).ordersPaused).toBe(true);
  });

  it('uses the IST business date after midnight', async () => {
    await createMenuItem({ name: 'Stocked for the 4th', stockDate: '2026-10-04' });
    const menu = await getMenu('2026-10-04T18:45:00.000Z'); // 00:15 IST on the 5th
    expect(menu.businessDate).toBe('2026-10-05');
    expect(menu.items[0]).toMatchObject({ soldOut: true, maxQty: 0, onlyLeft: null });
  });

  it('returns exactly the public fields', async () => {
    await createMenuItem({
      name: 'Dum Biryani',
      description: 'Slow cooked',
      imageUrl: 'https://example.com/biryani.jpg',
    });
    const { app } = makeApp({ now: NOW });
    const res = await request(app).get('/api/menu');
    expect(() => publicMenuSchema.parse(res.body)).not.toThrow();
    const item = (res.body as PublicMenu).items[0]!;
    expect(Object.keys(item).sort()).toEqual([
      'description',
      'id',
      'imageUrl',
      'maxQty',
      'name',
      'onlyLeft',
      'price',
      'soldOut',
    ]);
    expect(item.description).toBe('Slow cooked');
    expect(item.imageUrl).toBe('https://example.com/biryani.jpg');
  });

  it('sends Cache-Control: no-store', async () => {
    const { app } = makeApp({ now: NOW });
    const res = await request(app).get('/api/menu');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
