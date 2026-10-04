// Development data: sample menu stocked for today, plus the initial locations and slots.
// Never runs in production. Wipes orders, order items and menu items first.
import { loadDatabaseUrl } from '../src/server/config.js';
import { createPrisma, type PrismaClient } from '../src/server/db.js';
import { createClock } from '../src/server/lib/clock.js';
import { toDbDate } from '../src/server/lib/db-date.js';
import { nowIST, type Clock } from '../src/shared/time.js';
import { seedInitial } from './seed-initial.js';

// Placeholder prices (Batch 1 Q9). The real menu is entered by the vendor in the admin.
const SAMPLE_ITEMS = [
  { name: 'Chicken Biryani', description: 'Full plate with raita', price: 150, stock: 30 },
  { name: 'Paneer Biryani', description: null, price: 130, stock: 20 },
  { name: 'Egg Biryani', description: null, price: 120, stock: 20 },
  { name: 'Veg Biryani', description: null, price: 110, stock: 15 },
  { name: 'Raita', description: null, price: 20, stock: 40 },
  { name: 'Gulab Jamun', description: null, price: 30, stock: null }, // disabled
] as const;

export async function seedDev(prisma: PrismaClient, clock: Clock = createClock()): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-dev refuses to run when NODE_ENV=production.');
  }
  const today = toDbDate(nowIST(clock).date);

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany();
    await tx.order.deleteMany();
    await tx.menuItem.deleteMany();
    await tx.$executeRaw`ALTER SEQUENCE order_number_seq RESTART WITH 1001`;
  });

  await seedInitial(prisma);

  for (const [sortOrder, item] of SAMPLE_ITEMS.entries()) {
    // This is the one place outside inventory.service.ts allowed to write stock fields
    // directly; Batch 5 rewrites it to use setTodayStock (Batch 2 §5.2).
    await prisma.menuItem.create({
      data: {
        name: item.name,
        description: item.description,
        price: item.price,
        sortOrder,
        isAvailable: item.stock !== null,
        ...(item.stock !== null
          ? { dailyStock: item.stock, stockRemaining: item.stock, stockDate: today }
          : {}),
      },
    });
  }
  console.log(`created  ${SAMPLE_ITEMS.length} sample menu items (stocked for today)`);
}

if (import.meta.main) {
  // Check before connecting to anything.
  if (process.env.NODE_ENV === 'production') {
    console.error('seed-dev refuses to run when NODE_ENV=production.');
    process.exit(1);
  }
  const prisma = createPrisma(loadDatabaseUrl(process.env));
  try {
    await seedDev(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
