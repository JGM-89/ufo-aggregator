/**
 * GEIPAN (CNES / France) scraper.
 *
 * Source: https://www.cnes-geipan.fr/recherche/cas (Drupal-rendered listing,
 * 6 cases per page, server-side HTML — no JS needed).
 *
 * Per-listing-card data:
 *   <div class="fiche row">
 *     <div class="fiche-title">DD/MM/YYYY</div>
 *     <div class="fiche-logo-document {A|B|C|D}"></div>
 *     <span class="cas_title">[R] LOCATION (DEPT) DD.MM.YYYY</span>
 *     <a href="/fr/cas/{YYYY-MM-id}?...">...</a>
 *   </div>
 *
 * Classification mapping (per GEIPAN docs):
 *   A: fully explained             → resolved
 *   B: probably explained          → resolved
 *   C: unknown but data lacking    → analysis
 *   D: unknown with data           → unresolved (the interesting ones)
 *
 * v1 fetches the first PAGES_TO_FETCH listing pages (most-recent-first
 * default sort) and emits one record per card. No detail-page fetches —
 * cards carry classification, date, location, and URL, which is enough for
 * the frontend to render. Detail-page enrichment (blurb, witness count,
 * photos) is a v2 task.
 *
 * Rate limit: 1 concurrent request + 500ms sleep between pages. GEIPAN
 * runs on French government infrastructure — be polite.
 */
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { http, sleep } from '../utils/http';
import { makeLogger } from '../utils/logger';
import { makeId, normalizeDate } from '../utils/normalize';
import type { UAPRecord, Resolution } from '../schema';

const log = makeLogger('geipan');

const BASE = 'https://www.cnes-geipan.fr';
const LISTING = `${BASE}/recherche/cas`;
const PAGES_TO_FETCH = 10; // 6 cases/page → ~60 cases
const PAGE_DELAY_MS = 500;

interface RawCase {
  href: string;
  caseId: string;
  rawTitle: string;
  rawDate: string;
  classLetter: 'A' | 'B' | 'C' | 'D' | null;
  isRevisited: boolean;
}

function classifyResolutionFromLetter(letter: 'A' | 'B' | 'C' | 'D' | null): Resolution | null {
  if (letter === 'A' || letter === 'B') return 'resolved';
  if (letter === 'C') return 'analysis';
  if (letter === 'D') return 'unresolved';
  return null;
}

function parsePage(html: string): RawCase[] {
  const $ = cheerio.load(html);
  const out: RawCase[] = [];

  $('.fiche.row').each((_, el) => {
    const $el = $(el);
    const rawDate = $el.find('.fiche-title').first().text().trim();
    const rawTitle = $el.find('.cas_title').first().text().trim();

    // Classification letter is the second class on `.fiche-logo-document A`
    const logoClass = $el.find('.fiche-logo-document').first().attr('class') ?? '';
    const m = logoClass.match(/fiche-logo-document\s+([A-D])\b/);
    const classLetter = (m?.[1] as 'A' | 'B' | 'C' | 'D' | undefined) ?? null;

    const href = $el.find('a[href*="/cas/"]').first().attr('href') ?? '';
    const cleanHref = href.split('?')[0];
    const idMatch = cleanHref.match(/\/cas\/([0-9]{4}-[0-9]{2}-[0-9]+)/);
    if (!idMatch || !rawTitle) return;

    out.push({
      href: cleanHref,
      caseId: idMatch[1],
      rawTitle,
      rawDate,
      classLetter,
      isRevisited: rawTitle.startsWith('[R]'),
    });
  });

  return out;
}

function parseTitleLocation(rawTitle: string): { location: string; trimmed: string } {
  // Strip optional [R] (revisited) prefix and the trailing date.
  // Example: "[R] DE BRIIS-SOUS-FORGES (91) VERS LIMOURS (91) 01.01.2026"
  let s = rawTitle.replace(/^\[R\]\s*/, '').trim();
  // Trailing date pattern DD.MM.YYYY (or just YYYY)
  s = s.replace(/\s+\d{1,2}\.\d{1,2}\.\d{4}\s*$/, '').trim();
  return { location: s, trimmed: s };
}

function parseDateFrench(s: string): string | null {
  // DD/MM/YYYY → YYYY-MM-DD
  const m = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
  if (!m) return normalizeDate(s);
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

async function fetchPage(pageIdx: number): Promise<string | null> {
  // GEIPAN's Drupal listing uses a multi-pager with comma-prefixed page param:
  //   ?page=,0  → page 1
  //   ?page=,1  → page 2
  // A plain `?page=N` (without the comma) returns the same first page.
  const url = pageIdx === 0 ? LISTING : `${LISTING}?page=,${pageIdx}`;
  try {
    const res = await http.get<string>(url, { responseType: 'text' });
    return res.data;
  } catch (err: any) {
    log.warn(`page ${pageIdx} fetch failed: ${err?.message ?? err}`);
    return null;
  }
}

function toRecord(raw: RawCase): UAPRecord | null {
  const { location } = parseTitleLocation(raw.rawTitle);
  const incidentDate = parseDateFrench(raw.rawDate);
  const url = `${BASE}${raw.href}`;
  const resolution = classifyResolutionFromLetter(raw.classLetter);

  const tags = ['lang:fr'];
  if (raw.classLetter) tags.push(`geipan_class_${raw.classLetter}`);
  if (raw.isRevisited) tags.push('revisited');

  return {
    id: makeId('geipan', raw.caseId),
    _source: 'geipan',
    _type: 'case',
    title: location || raw.rawTitle,
    agency: 'GEIPAN / CNES',
    incidentDate,
    incidentLocation: location || null,
    releaseDate: null,
    resolution,
    blurb: null,
    officialBlurb: null,
    url,
    fileUrl: null,
    videoMp4: null,
    thumb: null,
    tags,
    country: 'FR',
    classification: raw.classLetter,
    raw: {
      caseId: raw.caseId,
      rawTitle: raw.rawTitle,
      rawDate: raw.rawDate,
      classLetter: raw.classLetter,
      isRevisited: raw.isRevisited,
    },
  };
}

export async function scrape(): Promise<UAPRecord[]> {
  const all: RawCase[] = [];

  for (let i = 0; i < PAGES_TO_FETCH; i++) {
    log.info(`fetching listing page ${i}`);
    const html = await fetchPage(i);
    if (!html) break;

    const cases = parsePage(html);
    if (cases.length === 0) {
      log.info(`page ${i} had 0 cases — stopping`);
      break;
    }
    all.push(...cases);
    await sleep(PAGE_DELAY_MS);
  }

  // Cache raw
  const cachePath = path.join('data', 'cache', 'geipan.json');
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(all, null, 2));

  const records: UAPRecord[] = [];
  for (const r of all) {
    const rec = toRecord(r);
    if (rec) records.push(rec);
  }

  log.info(`returning ${records.length} records from ${all.length} raw cases`);
  return records;
}
