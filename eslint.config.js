import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const sharedBans = [
  {
    group: ['**/server/**', '**/client/**'],
    message: 'src/shared must not import server or client code.',
  },
  {
    group: ['node:*', 'express', '@prisma/*', 'react', 'react-dom'],
    message: 'src/shared must stay pure (no Node, DOM or framework APIs).',
  },
];

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', 'src/server/generated', 'playwright-report']),
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // supertest responses are untyped JSON; asserting on them is the point of these tests.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    files: ['src/client/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: sharedBans }] },
  },
  {
    files: ['src/client/features/customer/**/*.{ts,tsx}', 'src/client/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/admin/**', '**/features/admin'],
              message: 'Customer code must never import from features/admin.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/server/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/**', '@prisma/*'],
              message: 'Routes call services; they do not use the Prisma client directly.',
            },
          ],
        },
      ],
    },
  },
]);
