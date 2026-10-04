// Sets a new vendor password and logs out every device (bumps tokenVersion; Batch 1 D9).
import { ZodError } from 'zod';
import { loadDatabaseUrl } from '../src/server/config.js';
import { createPrisma } from '../src/server/db.js';
import { resetPassword } from '../src/server/services/auth.service.js';
import { ask, askHidden } from './lib/prompt.js';

const prisma = createPrisma(loadDatabaseUrl(process.env));

try {
  const username = (await ask('Username: ')).trim().toLowerCase();
  const password = await askHidden('New password (at least 10 characters): ');
  const repeat = await askHidden('Repeat new password: ');
  if (password !== repeat) {
    console.error('The passwords did not match. Nothing was changed.');
    process.exitCode = 1;
  } else {
    await resetPassword(prisma, username, password);
    console.log(`Password for ${username} updated. All devices were logged out.`);
  }
} catch (err) {
  if (err instanceof ZodError) {
    for (const issue of err.issues) console.error(`${issue.path.join('.')}: ${issue.message}`);
  } else {
    console.error(err instanceof Error ? err.message : String(err));
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
