/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'fastify',
    include: ['src/**/*.test.ts'],
  },
});
