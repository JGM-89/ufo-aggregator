/**
 * UK National Archives — STUB.
 *
 * v2 plan:
 *  1. Fetch https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/ufos/
 *  2. Extract the 11 batch download links (each a single pdf/zip).
 *  3. Optionally enrich from https://discovery.nationalarchives.gov.uk/details/r/C11931
 *     for per-batch date ranges and DEFE file references.
 *  4. One UAPRecord per batch (do NOT unzip individual reports — too large).
 *  5. Country: 'GB', agency: 'UK Ministry of Defence'.
 */
import type { UAPRecord } from '../schema';
import { makeLogger } from '../utils/logger';

const log = makeLogger('uk_na');

export async function scrape(): Promise<UAPRecord[]> {
  log.info('stub — no records yet (see TODO in src/scrapers/uk_national_archives.ts)');
  return [];
}
