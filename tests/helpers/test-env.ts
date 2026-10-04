// Works out which database the tests use and refuses to touch anything that isn't a test
// database. Plain Node only: vitest.config.ts imports this before any test code runs.
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

function readEnvFile(file: string): Record<string, string> {
  return existsSync(file) ? (parseEnv(readFileSync(file, 'utf8')) as Record<string, string>) : {};
}

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/**
 * Environment for the test process (Batch 2 §12.1).
 * Test URL = DATABASE_URL_TEST from the environment, else from .env, else DATABASE_URL in
 * .env.test. Two guards: it must differ from the development DATABASE_URL in .env, and its
 * database name must contain "test" (the one that protects a production URL in the shell).
 */
export function resolveTestEnv(): Record<string, string> {
  const dotenv = readEnvFile('.env');
  const testFile = readEnvFile('.env.test');

  const testUrl =
    process.env.DATABASE_URL_TEST ?? dotenv.DATABASE_URL_TEST ?? testFile.DATABASE_URL;
  if (!testUrl) throw new Error('No test database URL: set DATABASE_URL_TEST or fix .env.test.');

  if (dotenv.DATABASE_URL && dotenv.DATABASE_URL === testUrl) {
    throw new Error('Refusing to run tests: the test database URL equals DATABASE_URL in .env.');
  }
  const name = databaseName(testUrl);
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to run tests: "${name}" doesn't look like a test database (its name must contain "test").`,
    );
  }

  return { ...testFile, NODE_ENV: 'test', DATABASE_URL: testUrl };
}
