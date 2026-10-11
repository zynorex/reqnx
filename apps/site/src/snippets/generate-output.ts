import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeQuickstart } from './quickstart.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, 'quickstart.output.json');

async function main() {
  const decisions = await executeQuickstart();
  const formatted = JSON.stringify(decisions, null, 2);
  writeFileSync(outputPath, formatted + '\n', 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Generated ${outputPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
