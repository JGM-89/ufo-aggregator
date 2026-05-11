/**
 * UK National Archives — minimal index scraper.
 *
 * WHY THIS IS NOT A FULL SCRAPE:
 * The National Archives' machine-readable surface for UFO files is essentially
 * nonexistent:
 *   1. The current /help-with-your-research/research-guides/ufos/ page is a
 *      narrative guide with no direct file links.
 *   2. The digitized UFO portal moved to the UK Government Web Archive
 *      (webarchive.nationalarchives.gov.uk/.../nationalarchives.gov.uk/ufos/),
 *      which renders content only through a JS-driven wayback viewer.
 *   3. The Discovery catalogue (discovery.nationalarchives.gov.uk) is gated
 *      by AWS WAF — every request returns a 202 with `x-amzn-waf-action: challenge`
 *      requiring browser-based JS to clear.
 *
 * Rather than fabricate batch details or burn time on browser-automation,
 * v1 emits two verified umbrella records pointing to the canonical entry
 * points. Users click through and browse in a real browser.
 *
 * v2 plan: integrate Playwright/Puppeteer (or a headless-chrome service)
 * to clear the WAF challenge and parse Discovery search results.
 */
import type { UAPRecord } from '../schema';
import { makeLogger } from '../utils/logger';
import { makeId } from '../utils/normalize';

const log = makeLogger('uk_na');

const RECORDS: UAPRecord[] = [
  {
    id: makeId('uk_na', 'mod-ufo-research-guide'),
    _source: 'uk_na',
    _type: 'case',
    title: 'UK MoD UFO Files — Research Guide',
    agency: 'UK Ministry of Defence / The National Archives',
    incidentDate: null,
    incidentLocation: 'United Kingdom',
    releaseDate: null,
    resolution: null,
    blurb:
      'Entry point for UK Ministry of Defence UFO records (1950–2009). MoD UFO desk records spanning ~11,000 reports are held across the DEFE, AIR, FCO and BJ catalogue series. This page is the official research guide for navigating them.',
    officialBlurb: null,
    url: 'https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/ufos/',
    fileUrl: null,
    videoMp4: null,
    thumb: null,
    tags: ['index', 'research-guide'],
    country: 'GB',
    classification: null,
    raw: { kind: 'research-guide', series: ['DEFE', 'AIR', 'FCO', 'BJ'] },
  },
  {
    id: makeId('uk_na', 'digitized-ufo-portal'),
    _source: 'uk_na',
    _type: 'case',
    title: 'UK National Archives — Digitized UFO Files (1950–2002)',
    agency: 'UK Ministry of Defence / The National Archives',
    incidentDate: null,
    incidentLocation: 'United Kingdom',
    releaseDate: '2008',
    resolution: null,
    blurb:
      "The original /ufos/ portal, archived in the UK Government Web Archive. Hosts the digitized batches of MoD UFO files released to the public between 2008 and 2017. Browse in a real browser — the wayback viewer requires JS.",
    officialBlurb: null,
    url: 'https://webarchive.nationalarchives.gov.uk/ukgwa/+/https://www.nationalarchives.gov.uk/ufos/',
    fileUrl: null,
    videoMp4: null,
    thumb: null,
    tags: ['index', 'digitized', 'webarchive'],
    country: 'GB',
    classification: null,
    raw: { kind: 'digitized-portal', archivedYear: 2008 },
  },
];

export async function scrape(): Promise<UAPRecord[]> {
  log.info(`returning ${RECORDS.length} index records (v1 minimal; see comment in source)`);
  return RECORDS;
}
