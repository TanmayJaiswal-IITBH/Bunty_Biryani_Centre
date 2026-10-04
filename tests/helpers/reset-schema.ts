import { execSync } from 'node:child_process';
import { createPrisma } from '../../src/server/db';

/**
 * Drops everything in the guarded test database and re-applies the migrations. Used by the
 * integration global setup and reusable by the e2e setup (Batch 7). Callers must have run the
 * database through resolveTestEnv() first.
 */
export async function resetSchema(databaseUrl: string): Promise<void> {
  const prisma = createPrisma(databaseUrl);
  try {
    await prisma.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
    await prisma.$executeRaw`CREATE SCHEMA public`;
  } finally {
    await prisma.$disconnect();
  }
  // The Prisma CLI reads DATABASE_URL (prisma.config.ts), so pass the test database to it.
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
