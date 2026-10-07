import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/core',
      'packages/redis',
      'packages/express',
      'packages/fastify',
      'packages/testkit',
      'apps/site',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/*.bench.ts', '**/headers.ts', '**/index.ts', '**/smoke.test.ts'],
      thresholds: {
        'packages/core/src/**': {
          lines: 95,
          branches: 90,
          functions: 95,
          statements: 95,
        },
      },
    },
  },
});
