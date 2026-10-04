// Creates the one vendor login (Batch 1 §9.1). Phase 1 has exactly one admin.
import { ZodError } from 'zod';
import { loadDatabaseUrl } from '../src/server/config.js';
import { createPrisma } from '../src/server/db.js';
import { AppError } from '../src/server/lib/app-error.js';
import { createAdmin } from '../src/server/services/auth.service.js';
import { ask, askHidden } from './lib/prompt.js';

const prisma = createPrisma(loadDatabaseUrl(process.env));

try {
  if ((await prisma.admin.count()) > 0) {
    console.error('An admin already exists. Use admin:reset-password.');
    process.exitCode = 1;
  } else {
    const username = (await ask('Username: ')).trim().toLowerCase();
    const password = await askHidden('Password (at least 10 characters): ');
    const repeat = await askHidden('Repeat password: ');
    if (password !== repeat) {
      console.error('The passwords did not match. Nothing was created.');
      process.exitCode = 1;
    } else {
      const admin = await createAdmin(prisma, username, password);
      console.log(`Admin ${admin.username} created.`);
    }
  }
} catch (err) {
  if (err instanceof ZodError) {
    for (const issue of err.issues) console.error(`${issue.path.join('.')}: ${issue.message}`);
  } else {
    console.error(err instanceof AppError || err instanceof Error ? err.message : String(err));
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
