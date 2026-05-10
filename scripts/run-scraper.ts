/**
 * Run a single scraper by name and pretty-print its output (for debugging).
 *   npx ts-node scripts/run-scraper.ts <source-id>
 * Sources: pursue_r01, aaro, geipan, uk_na, brazil_af, canada_nrc
 */
import { UAPRecordSchema } from '../src/schema';

const SCRAPERS: Record<string, () => Promise<unknown[]>> = {
  pursue_r01: () => import('../src/scrapers/pursue_r01').then((m) => m.scrape()),
  aaro: () => import('../src/scrapers/aaro').then((m) => m.scrape()),
  geipan: () => import('../src/scrapers/geipan').then((m) => m.scrape()),
  uk_na: () => import('../src/scrapers/uk_national_archives').then((m) => m.scrape()),
  brazil_af: () => import('../src/scrapers/brazil_af').then((m) => m.scrape()),
  canada_nrc: () => import('../src/scrapers/canada_nrc').then((m) => m.scrape()),
};

async function main() {
  const name = process.argv[2];
  if (!name || !SCRAPERS[name]) {
    console.error(`Usage: npx ts-node scripts/run-scraper.ts <${Object.keys(SCRAPERS).join('|')}>`);
    process.exit(1);
  }
  const records = await SCRAPERS[name]();
  let validCount = 0;
  let invalidCount = 0;
  for (const r of records) {
    if (UAPRecordSchema.safeParse(r).success) validCount++;
    else invalidCount++;
  }
  console.log(JSON.stringify(records, null, 2));
  console.error(`\n[${name}] total: ${records.length}  valid: ${validCount}  invalid: ${invalidCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
