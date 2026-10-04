import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 doesn't read .env itself. A value already in the environment always wins, so the
// test harness can point the CLI at its own database and production uses platform variables.
if (!process.env.DATABASE_URL && existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
