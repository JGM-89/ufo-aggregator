/**
 * AARO scraper — v1 reads a manually-extracted fixture sourced from the
 * frontend's AARO_ITEMS literal (see scripts/extract-aaro.ts). Live scraping
 * of aaro.mil/Resources/Imagery is a v2 task: the HTML structure is
 * JS-rendered and unstable, and the fixture covers the canonical set.
 *
 * To refresh: edit AARO_ITEMS in index.html and run
 *   npx ts-node scripts/extract-aaro.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { UAPRecordSchema, type UAPRecord } from '../schema';
import { makeLogger } from '../utils/logger';

const log = makeLogger('aaro');
const FIXTURE = path.join('data', 'cache', 'aaro_manual.json');

export async function scrape(): Promise<UAPRecord[]> {
  try {
    const raw = await fs.readFile(FIXTURE, 'utf8');
    const records = JSON.parse(raw) as unknown[];
    const valid: UAPRecord[] = [];
    for (const r of records) {
      const parsed = UAPRecordSchema.safeParse(r);
      if (parsed.success) valid.push(parsed.data);
      else log.warn('skipping invalid fixture record', parsed.error.issues);
    }
    log.info(`loaded ${valid.length} records from fixture`);
    return valid;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      log.warn(`fixture not found at ${FIXTURE}. Run: npx ts-node scripts/extract-aaro.ts`);
      return [];
    }
    throw err;
  }
}
