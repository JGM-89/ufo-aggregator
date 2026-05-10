/**
 * One-time extractor: parses the AARO_ITEMS JS literal in index.html and
 * writes data/cache/aaro_manual.json conforming to the UAPRecord schema.
 *
 * Re-run this whenever AARO_ITEMS in index.html is updated upstream.
 */
import fs from 'fs/promises';
import path from 'path';
import { UAPRecordSchema, type UAPRecord } from '../src/schema';
import { makeId, normalizeDate } from '../src/utils/normalize';

interface RawAaro {
  title: string;
  agency: string;
  incidentDate?: string | null;
  incidentLocation?: string | null;
  resolution?: 'resolved' | 'unresolved' | 'analysis' | null;
  blurb?: string | null;
  videoMp4?: string | null;
  dvidUrl?: string | null;
  caseUrl?: string | null;
}

async function main() {
  const html = await fs.readFile(path.join(process.cwd(), 'index.html'), 'utf8');

  // Slice out the AARO_ITEMS array literal
  const start = html.indexOf('const AARO_ITEMS = [');
  if (start < 0) throw new Error('AARO_ITEMS not found in index.html');
  const arrStart = html.indexOf('[', start);
  const arrEnd = html.indexOf('];', arrStart);
  if (arrEnd < 0) throw new Error('Could not find end of AARO_ITEMS');
  const arrText = html.slice(arrStart, arrEnd + 1);

  // The literal uses unquoted keys (JS), single-quoted strings, and \' escapes.
  // Parse via Function constructor (safe here — we wrote this content ourselves).
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const parser = new Function(`return ${arrText};`);
  const raw: RawAaro[] = parser();

  const records: UAPRecord[] = raw.map((r) => {
    const url = r.dvidUrl || r.videoMp4 || `https://www.aaro.mil/?case=${encodeURIComponent(r.title)}`;
    const rec: UAPRecord = {
      id: makeId('aaro', r.title),
      _source: 'aaro',
      _type: 'video',
      title: r.title,
      agency: r.agency || 'AARO / U.S. DoD',
      incidentDate: normalizeDate(r.incidentDate),
      incidentLocation: r.incidentLocation || null,
      releaseDate: null,
      resolution: r.resolution ?? null,
      blurb: r.blurb || null,
      officialBlurb: null,
      url,
      fileUrl: r.caseUrl || null,
      videoMp4: r.videoMp4 || null,
      thumb: null,
      tags: r.caseUrl ? ['has_case_report'] : [],
      country: 'US',
      classification: 'UNCLASSIFIED',
      raw: { ...(r as unknown as Record<string, unknown>) },
    };
    UAPRecordSchema.parse(rec); // throws on invalid
    return rec;
  });

  const outPath = path.join(process.cwd(), 'data', 'cache', 'aaro_manual.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(records, null, 2));
  console.log(`Wrote ${records.length} AARO records to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
