/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'express',
    include: ['src/**/*.test.ts'],
  },
});
