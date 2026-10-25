// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Script Freshness Test
//
// Verifies that packages/redis/src/scripts/generated.ts is strictly in sync
// with the Lua sources under packages/redis/src/lua.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Lua script freshness', () => {
  it('generated.ts matches the concatenated Lua sources', () => {
    const root = resolve(__dirname, '../..');
    // Run build-lua with --check
    expect(() => {
      execSync('npx tsx scripts/build-lua.ts --check', {
        cwd: root,
        stdio: 'pipe',
      });
    }).not.toThrow();
  }, 20_000);
});
