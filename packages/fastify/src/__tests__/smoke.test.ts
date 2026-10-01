import { describe, it, expect } from 'vitest';

describe('@reqnx/fastify smoke tests', () => {
  it('module loads without error', async () => {
    const mod = await import('../index.js');
    expect(mod).toBeDefined();
  });
});
