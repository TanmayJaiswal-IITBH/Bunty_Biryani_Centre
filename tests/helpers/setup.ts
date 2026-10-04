import { afterAll, beforeEach } from 'vitest';
import { prisma, resetDb } from './db';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
