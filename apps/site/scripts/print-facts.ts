import { computeFacts } from '../src/facts.js';

const facts = computeFacts();
// eslint-disable-next-line no-console
console.log('\n--- Verified REQNX Build-time Facts ---\n');
for (const f of facts) {
  // eslint-disable-next-line no-console
  console.log(`• [${f.id}] ${f.label}: ${f.value}`);
  // eslint-disable-next-line no-console
  console.log(`  Source: ${f.sourceFile}`);
  // eslint-disable-next-line no-console
  console.log(`  Detail: ${f.detail}\n`);
}
