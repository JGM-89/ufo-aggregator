/**
 * Brazil FAB (SIOANI) — STUB.
 *
 * NOTE: The spec's URL fab.mil.br/noticias/mostra/35165/ is likely stale.
 * SIOANI archives are actually held at Arquivo Nacional, not the FAB website.
 *
 * v2 plan:
 *  1. Investigate https://www.arquivonacional.gov.br/ for "SIOANI" or "OVNI"
 *  2. Cross-check https://sian.an.gov.br/ catalogue search
 *  3. The famous 1977 "Operação Prato" (Operation Saucer) files are the
 *     highest-value items — start there.
 *  4. Country: 'BR'. Keep officialBlurb in Portuguese; English in blurb.
 */
import type { UAPRecord } from '../schema';
import { makeLogger } from '../utils/logger';

const log = makeLogger('brazil_af');

export async function scrape(): Promise<UAPRecord[]> {
  log.info('stub — no records yet (see TODO in src/scrapers/brazil_af.ts)');
  return [];
}
