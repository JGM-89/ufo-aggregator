/**
 * GEIPAN (CNES / France) — STUB.
 *
 * v2 plan:
 *  1. Open https://cnes-geipan.fr/fr/recherche in browser DevTools, find the
 *     XHR that returns case JSON. If found, hit it directly.
 *  2. If no JSON endpoint, paginate /fr/recherche?page=N with cheerio.
 *  3. For ~50 D-class (genuine UAP) cases, fetch the detail page and parse
 *     witness count, radar, date (DD/MM/YYYY → ISO), location.
 *  4. Throttle to 1 concurrent request + 500ms sleep — French gov infra.
 *  5. Map GEIPAN class: A/B→resolved, C→analysis, D→unresolved.
 */
import type { UAPRecord } from '../schema';
import { makeLogger } from '../utils/logger';

const log = makeLogger('geipan');

export async function scrape(): Promise<UAPRecord[]> {
  log.info('stub — no records yet (see TODO in src/scrapers/geipan.ts)');
  return [];
}
