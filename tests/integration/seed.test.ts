import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { seedInitial } from '../../prisma/seed-initial';
import { prisma } from '../helpers/db';
import { createMenuItem } from '../helpers/factories';

const quiet = () => {};

describe('seed-initial', () => {
  it('creates MSH and Kanhar with their slots, exactly once', async () => {
    const first = await seedInitial(prisma, quiet);
    expect(first.created).toHaveLength(4);
    const second = await seedInitial(prisma, quiet);
    expect(second.created).toHaveLength(0);
    expect(second.skipped).toHaveLength(4);

    expect(await prisma.deliveryLocation.count()).toBe(2);
    expect(await prisma.deliverySlot.count()).toBe(2);
    const slots = await prisma.deliverySlot.findMany({
      include: { location: true },
      orderBy: { deliveryTime: 'asc' },
    });
    expect(slots.map((s) => [s.location.name, s.deliveryTime, s.cutoffTime, s.isActive])).toEqual([
      ['MSH', '20:00', '19:30', true],
      ['Kanhar', '20:45', '20:15', true],
    ]);
  });

  it('never changes a row the vendor has edited', async () => {
    await seedInitial(prisma, quiet);
    await prisma.deliverySlot.updateMany({
      where: { deliveryTime: '20:00' },
      data: { isActive: false },
    });
    await prisma.deliveryLocation.updateMany({
      where: { name: 'Kanhar' },
      data: { isActive: false },
    });
    await seedInitial(prisma, quiet);
    expect(
      (await prisma.deliverySlot.findFirstOrThrow({ where: { deliveryTime: '20:00' } })).isActive,
    ).toBe(false);
    expect(
      (await prisma.deliveryLocation.findUniqueOrThrow({ where: { name: 'Kanhar' } })).isActive,
    ).toBe(false);
  });
});

describe('seed-dev', () => {
  it('exits non-zero in production without touching any data', async () => {
    await createMenuItem({ name: 'Keep me' });
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed-dev.ts'], {
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('refuses to run');
    expect(await prisma.menuItem.count()).toBe(1);
    expect(await prisma.deliveryLocation.count()).toBe(0);
  });

  it('stocks the sample menu for today when it does run', async () => {
    const out = execFileSync(process.execPath, ['--import', 'tsx', 'prisma/seed-dev.ts'], {
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf8',
    });
    expect(out).toContain('sample menu items');
    const items = await prisma.menuItem.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(items).toHaveLength(6);
    const stocked = items.filter((i) => i.isAvailable);
    expect(stocked).toHaveLength(5);
    for (const i of stocked) {
      expect(i.dailyStock).toBe(i.stockRemaining);
      expect(i.stockDate).not.toBeNull();
    }
    expect(items.at(-1)).toMatchObject({
      name: 'Gulab Jamun',
      isAvailable: false,
      stockDate: null,
    });
  });
});
