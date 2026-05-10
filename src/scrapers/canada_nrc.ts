/**
 * Canada NRC — STUB.
 *
 * NOTE: The spec's bac-lac.gc.ca .aspx URLs may 404 after Canada.ca migration.
 *
 * v2 plan:
 *  1. Start from https://library-archives.canada.ca/eng/collection/research-help/
 *     and search "UFO" / "National Research Council" / "Project Magnet"
 *  2. The ~9,000 NRC sighting reports (1947-1994) live across multiple finding
 *     aids — there is no single scrapable index. Likely needs a curated list.
 *  3. Country: 'CA', agency: 'National Research Council of Canada'.
 */
import type { UAPRecord } from '../schema';
import { makeLogger } from '../utils/logger';

const log = makeLogger('canada_nrc');

export async function scrape(): Promise<UAPRecord[]> {
  log.info('stub — no records yet (see TODO in src/scrapers/canada_nrc.ts)');
  return [];
}
