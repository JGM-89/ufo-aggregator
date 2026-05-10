import slugify from 'slugify';
import { parse, isValid, format } from 'date-fns';
import type { UAPRecord, Resolution, SourceId } from '../schema';

export function makeId(source: SourceId, key: string): string {
  const slug = slugify(key, { lower: true, strict: true, trim: true });
  return `${source}_${slug || 'untitled'}`.slice(0, 120);
}

/**
 * Normalize a variety of date string inputs into a partial-ISO date.
 * Accepts: "2004", "Nov 2004", "2004-11", "2004-11-14", "14/11/2004", "11/14/2004", etc.
 * Returns: "YYYY", "YYYY-MM", or "YYYY-MM-DD", or null if unparseable.
 */
export function normalizeDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // Already ISO-ish
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Expand 2-digit years: M/D/YY or MM/DD/YY → assume 20YY (or 19YY if >50)
  // (5/8/26 should become 2026-05-08, not year-0005-08-26)
  const twoDigitYear = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (twoDigitYear) {
    const [, m, d, y] = twoDigitYear;
    const yy = Number(y);
    const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;
    const expanded = `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${fullYear}`;
    const dt = parse(expanded, 'MM/dd/yyyy', new Date());
    if (isValid(dt)) return format(dt, 'yyyy-MM-dd');
  }

  // Try common patterns
  const patterns = [
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'd MMM yyyy',
    'MMM yyyy',
    'MMMM yyyy',
    'd MMMM yyyy',
    'yyyy',
  ];
  for (const p of patterns) {
    const d = parse(s, p, new Date());
    if (isValid(d) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) {
      if (p === 'yyyy') return format(d, 'yyyy');
      if (p === 'MMM yyyy' || p === 'MMMM yyyy') return format(d, 'yyyy-MM');
      return format(d, 'yyyy-MM-dd');
    }
  }

  // Last resort: extract a 4-digit year
  const yearMatch = s.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return yearMatch[0];

  return null;
}

const RESOLVED_KEYWORDS = /\b(identified|explained|resolved|debunked|conventional)\b/i;
const UNRESOLVED_KEYWORDS = /\b(unidentified|unknown|unexplained|anomalous)\b/i;
const ANALYSIS_KEYWORDS = /\b(analysis|under (review|investigation)|inconclusive)\b/i;

export function classifyResolution(...texts: (string | null | undefined)[]): Resolution | null {
  const blob = texts.filter(Boolean).join(' ');
  if (!blob) return null;
  if (ANALYSIS_KEYWORDS.test(blob)) return 'analysis';
  if (UNRESOLVED_KEYWORDS.test(blob)) return 'unresolved';
  if (RESOLVED_KEYWORDS.test(blob)) return 'resolved';
  return null;
}

/**
 * Dedupe records by `url`, then by `id`. When duplicates exist, prefer the one with more populated fields.
 */
export function deduplicateByUrl(records: UAPRecord[]): UAPRecord[] {
  const byUrl = new Map<string, UAPRecord>();
  for (const r of records) {
    const existing = byUrl.get(r.url);
    if (!existing) {
      byUrl.set(r.url, r);
      continue;
    }
    if (richnessScore(r) > richnessScore(existing)) byUrl.set(r.url, r);
  }
  // Second pass: collapse id collisions (slug aliasing across distinct URLs)
  const byId = new Map<string, UAPRecord>();
  for (const r of byUrl.values()) {
    const existing = byId.get(r.id);
    if (!existing) byId.set(r.id, r);
    else if (richnessScore(r) > richnessScore(existing)) byId.set(r.id, r);
  }
  return Array.from(byId.values());
}

function richnessScore(r: UAPRecord): number {
  const fields = [
    r.incidentDate,
    r.incidentLocation,
    r.releaseDate,
    r.resolution,
    r.blurb,
    r.officialBlurb,
    r.fileUrl,
    r.videoMp4,
    r.thumb,
    r.classification,
  ];
  return fields.filter((v) => v !== null && v !== '').length + r.tags.length;
}

export function countBy<T extends string>(
  records: UAPRecord[],
  key: (r: UAPRecord) => T
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
