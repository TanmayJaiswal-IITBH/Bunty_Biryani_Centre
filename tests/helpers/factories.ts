import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/server/db';
import { toDbDate } from '../../src/server/lib/db-date';
import { hashPassword } from '../../src/server/services/auth.service';
import { TEST_TODAY } from './clock';
import { prisma } from './db';

export const ADMIN_USERNAME = 'bunty';
export const ADMIN_PASSWORD = 'correct-horse-battery';

export async function createAdmin(
  username: string = ADMIN_USERNAME,
  password: string = ADMIN_PASSWORD,
  client: PrismaClient = prisma,
) {
  return client.admin.create({ data: { username, passwordHash: await hashPassword(password) } });
}

export function createLocation(
  data: { name?: string; isActive?: boolean; sortOrder?: number } = {},
) {
  return prisma.deliveryLocation.create({
    data: {
      name: data.name ?? 'MSH',
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export function createSlot(data: {
  locationId: number;
  deliveryTime?: string;
  cutoffTime?: string;
  isActive?: boolean;
}) {
  return prisma.deliverySlot.create({
    data: {
      locationId: data.locationId,
      deliveryTime: data.deliveryTime ?? '20:00',
      cutoffTime: data.cutoffTime ?? '19:30',
      isActive: data.isActive ?? true,
    },
  });
}

/** Stock fields are consistent (nothing sold), so the inventory invariant holds. */
export function createMenuItem(
  data: {
    name?: string;
    price?: number;
    stock?: number;
    stockDate?: string | null;
    isAvailable?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    description?: string | null;
    imageUrl?: string | null;
  } = {},
) {
  const stock = data.stock ?? 10;
  const stockDate = data.stockDate === undefined ? TEST_TODAY : data.stockDate;
  return prisma.menuItem.create({
    data: {
      name: data.name ?? 'Chicken Biryani',
      price: data.price ?? 150,
      isAvailable: data.isAvailable ?? true,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      dailyStock: stock,
      stockRemaining: stock,
      stockDate: stockDate ? toDbDate(stockDate) : null,
    },
  });
}

type OrderOverrides = Partial<Parameters<typeof prisma.order.create>[0]['data']>;

/** A valid BATCH order row (food ₹300, no fee) with any column overridden. */
export function createOrderRow(
  base: { locationId: number; slotId: number },
  overrides: OrderOverrides = {},
) {
  return prisma.order.create({
    data: {
      clientRequestId: randomUUID(),
      customerName: 'Rahul Verma',
      customerPhone: '9876543210',
      deliveryMode: 'BATCH',
      deliveryDate: toDbDate(TEST_TODAY),
      locationId: base.locationId,
      locationName: 'MSH',
      slotId: base.slotId,
      slotDeliveryTime: '20:00',
      foodSubtotal: 300,
      deliveryFee: 0,
      total: 300,
      ...overrides,
    } as Parameters<typeof prisma.order.create>[0]['data'],
  });
}
