import fs from 'fs/promises';
import path from 'path';
import {
  UAPRecordSchema,
  type UAPRecord,
  type AggregateOutput,
  SCHEMA_VERSION,
  type SourceId,
} from './schema';
import { makeLogger } from './utils/logger';
import { deduplicateByUrl, countBy } from './utils/normalize';

import * as pursue from './scrapers/pursue_r01';
import * as aaro from './scrapers/aaro';
import * as geipan from './scrapers/geipan';
import * as ukNa from './scrapers/uk_national_archives';
import * as brazil from './scrapers/brazil_af';
import * as canada from './scrapers/canada_nrc';
import {
  scrapeChileCEFAA,
  scrapePeruDIFAA,
  scrapeUruguayCRIDOVNI,
  scrapeAustraliaRAAF,
  scrapeNZRNZAF,
} from './scrapers/future';

const log = makeLogger('aggregate');

interface Runner {
  id: SourceId;
  run: () => Promise<UAPRecord[]>;
}

const RUNNERS: Runner[] = [
  { id: 'pursue_r01', run: pursue.scrape },
  { id: 'aaro', run: aaro.scrape },
  { id: 'geipan', run: geipan.scrape },
  { id: 'uk_na', run: ukNa.scrape },
  { id: 'brazil_af', run: brazil.scrape },
  { id: 'canada_nrc', run: canada.scrape },
  { id: 'chile_cefaa', run: scrapeChileCEFAA },
  { id: 'peru_difaa', run: scrapePeruDIFAA },
  { id: 'uruguay_cridovni', run: scrapeUruguayCRIDOVNI },
  { id: 'australia_raaf', run: scrapeAustraliaRAAF },
  { id: 'nz_rnzaf', run: scrapeNZRNZAF },
];

async function runOne(r: Runner): Promise<{ id: SourceId; records: UAPRecord[]; lastScraped: string | null }> {
  const start = Date.now();
  try {
    const raw = await r.run();
    const valid: UAPRecord[] = [];
    for (const rec of raw) {
      const parsed = UAPRecordSchema.safeParse(rec);
      if (parsed.success) valid.push(parsed.data);
      else log.warn(`[${r.id}] rejected invalid record: ${rec?.title ?? '?'}`, parsed.error.issues);
    }
    log.info(`[${r.id}] ${valid.length} valid records in ${Date.now() - start}ms`);
    return { id: r.id, records: valid, lastScraped: new Date().toISOString() };
  } catch (err) {
    log.error(`[${r.id}] failed`, err);
    return { id: r.id, records: [], lastScraped: null };
  }
}

export async function aggregate(): Promise<AggregateOutput> {
  log.info(`starting aggregation across ${RUNNERS.length} sources`);
  const results = await Promise.all(RUNNERS.map(runOne));

  const allRecords = results.flatMap((r) => r.records);
  const deduped = deduplicateByUrl(allRecords);
  log.info(`${allRecords.length} → ${deduped.length} after dedup by url`);

  const lastScraped: Record<string, string | null> = {};
  for (const r of results) lastScraped[r.id] = r.lastScraped;

  const output: AggregateOutput = {
    meta: {
      generated: new Date().toISOString(),
      _schemaVersion: SCHEMA_VERSION,
      totalRecords: deduped.length,
      bySource: countBy(deduped, (r) => r._source),
      byType: countBy(deduped, (r) => r._type),
      lastScraped,
    },
    records: deduped,
  };

  const outPath = path.join('data', 'data.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  log.info(`wrote ${deduped.length} records to ${outPath}`);
  return output;
}

if (require.main === module) {
  aggregate().catch((err) => {
    log.error('aggregation failed', err);
    process.exit(1);
  });
}
