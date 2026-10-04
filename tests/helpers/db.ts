import { createPrisma } from '../../src/server/db';
import type { PrismaClient } from '../../src/server/db';

/** One client per test file (Vitest isolates modules per file). */
export const prisma: PrismaClient = createPrisma(process.env.DATABASE_URL as string);

/** Empties the data tables and puts sequences and the settings row back to their defaults. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE order_items, orders, menu_items, delivery_slots, delivery_locations, admins RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`ALTER SEQUENCE order_number_seq RESTART WITH 1001`;
  await prisma.$executeRaw`DELETE FROM delivery_settings`;
  await prisma.$executeRaw`INSERT INTO delivery_settings (id, updated_at) VALUES (1, now())`;
}
