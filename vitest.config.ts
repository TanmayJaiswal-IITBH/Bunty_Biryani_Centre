import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { resolveTestEnv } from './tests/helpers/test-env.ts';

const alias = { '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          // One shared database, so files run one after another.
          fileParallelism: false,
          env: resolveTestEnv(),
          globalSetup: ['tests/helpers/global-setup.ts'],
          setupFiles: ['tests/helpers/setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
