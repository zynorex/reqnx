import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeQuickstart } from '../src/snippets/quickstart';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, '../src/snippets/quickstart.output.json');

describe('Quickstart Snippet Output Freshness', () => {
  it('ensures quickstart.output.json matches execution output of quickstart.ts', async () => {
    const rawFixture = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(rawFixture);

    const actual = await executeQuickstart();

    expect(actual).toEqual(expected);
  });
});
