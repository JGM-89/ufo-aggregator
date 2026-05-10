# Claude Code Prompt: UFO/UAP Multi-Source Aggregator

Paste this entire prompt into Claude Code (the CLI) to build the backend aggregator system.

---

## The Project

Build a Node.js backend that scrapes, normalizes, and serves UFO/UAP records from multiple official government sources into a single unified JSON API. The frontend (`index.html`, already built) will fetch from this API instead of hitting sources directly.

The system has three parts:
1. **Scrapers** — one per source, each outputting normalized records
2. **Aggregator** — merges all sources, deduplicates, saves a master `data.json`
3. **Server** — Express API serving the data with optional caching headers

---

## Common Record Schema

Every scraper must normalize its records to this schema. Use `null` for unavailable fields — never omit them.

```typescript
interface UAPRecord {
  id: string;               // "{source}_{slug}" e.g. "pursue_r01_fbi-memo-1947"
  _source: string;          // 'pursue_r01' | 'aaro' | 'geipan' | 'uk_na' | 'brazil_af' | 'canada_nrc'
  _type: 'pdf' | 'image' | 'video' | 'case';
  title: string;
  agency: string;           // originating agency/department
  incidentDate: string | null;    // ISO 8601 or partial "2004" or "2004-11"
  incidentLocation: string | null;
  releaseDate: string | null;     // when declassified/published
  resolution: 'resolved' | 'unresolved' | 'analysis' | null;
  blurb: string | null;           // short human-readable summary (1–2 sentences)
  officialBlurb: string | null;   // verbatim description from source
  url: string;                    // canonical page URL (always present)
  fileUrl: string | null;         // direct download URL for PDF/image
  videoMp4: string | null;        // direct MP4 stream URL
  thumb: string | null;           // thumbnail image URL
  tags: string[];                 // e.g. ["radar", "military", "triangle"]
  country: string;                // ISO 3166-1 alpha-2, e.g. "US", "FR", "GB"
  classification: string | null;  // e.g. "UNCLASSIFIED", "SECRET//NOFORN"
  raw: Record<string, unknown>;   // source-specific raw data, preserved for debugging
}
```

---

## Directory Structure

```
ufo-aggregator/
├── package.json
├── .env.example
├── src/
│   ├── index.ts            # Express server
│   ├── aggregate.ts        # Orchestrates all scrapers → data.json
│   ├── schema.ts           # TypeScript interfaces
│   ├── scrapers/
│   │   ├── pursue_r01.ts
│   │   ├── aaro.ts
│   │   ├── geipan.ts
│   │   ├── uk_national_archives.ts
│   │   ├── brazil_af.ts
│   │   └── canada_nrc.ts
│   └── utils/
│       ├── http.ts         # Axios instance with retry + rate limiting
│       ├── normalize.ts    # Shared date parsing, slug generation, dedup
│       └── logger.ts
├── data/
│   ├── data.json           # Master output — served by API + usable standalone
│   └── cache/              # Per-source raw cache (gitignored)
├── scripts/
│   └── run-scraper.ts      # CLI: `npx ts-node scripts/run-scraper.ts geipan`
└── tsconfig.json
```

---

## Package Dependencies

```json
{
  "dependencies": {
    "express": "^4.18",
    "axios": "^1.6",
    "axios-retry": "^4.0",
    "cheerio": "^1.0",
    "p-limit": "^5.0",
    "date-fns": "^3.0",
    "slugify": "^1.6",
    "zod": "^3.22",
    "dotenv": "^16.0"
  },
  "devDependencies": {
    "typescript": "^5.3",
    "ts-node": "^10.9",
    "@types/express": "^4.17",
    "@types/node": "^20"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "aggregate": "ts-node src/aggregate.ts",
    "scrape": "ts-node scripts/run-scraper.ts"
  }
}
```

---

## Scraper Specifications

### 1. PURSUE Release 01 (`pursue_r01.ts`)

**Data source:** `https://cdn.jsdelivr.net/gh/vng9trmgr8-pixel/war-gov-ufo-release-1@main/data.json`

This JSON has the shape:
```json
{
  "counts": { "pdfs": 162, "images": 13, "videos": 0 },
  "pdfs": [{ "title": "...", "agency": "...", "incidentDate": "...", "incidentLocation": "...", "releaseDate": "...", "blurb": "...", "officialBlurb": "...", "url": "...", "thumb": "..." }],
  "images": [{ ...same fields... }]
}
```

- Fetch the JSON, iterate `pdfs` and `images` arrays
- Set `_source: 'pursue_r01'`, `country: 'US'`
- `_type`: `'pdf'` for pdfs array, `'image'` for images array
- `fileUrl`: for PDFs, pattern is `https://www.war.gov/medialink/ufo/release_1/{slugified-title}.pdf` — derive from `url` field if present, otherwise reconstruct
- `resolution`: parse from `blurb`/`officialBlurb` — if text contains "identified" or "explained", use `'resolved'`; if "unknown" or "unidentified", use `'unresolved'`; default `null`
- Check for a `release_2` variant of the same repo path — the user may add future releases and you should handle them if they appear
- Cache raw JSON to `data/cache/pursue_r01.json`

### 2. AARO Official Imagery (`aaro.ts`)

**Data source:** `https://www.aaro.mil/Resources/Imagery/` (HTML scrape)

The page renders server-side HTML. Each entry is a card containing:
- Video title
- Date
- A CloudFront CDN MP4 URL: `https://d34w7g4gy10iej.cloudfront.net/video/{id}/{filename}.mp4`
- A DVIDS page URL: `https://www.dvidshub.net/video/{dvids_id}/`
- Description text

Scraping approach:
1. Fetch the imagery page HTML with Cheerio
2. Select all video card elements (inspect the live page to find the right selectors — likely `.card` or similar within a `#imagery-container` div)
3. For each card extract: title, description, date, MP4 src attribute, DVIDS href
4. If the MP4 URL is not embedded in the HTML, look for a data attribute like `data-src` or fetch the DVIDS page for each video and extract the MP4 from a `<source>` tag or JSON-LD

Output fields:
- `_source: 'aaro'`, `_type: 'video'`, `country: 'US'`
- `agency: 'AARO / U.S. DoD'`
- `videoMp4`: direct CloudFront URL
- `url`: DVIDS page URL
- `resolution: 'unresolved'` for the famous videos (Gimbal, Go Fast, FLIR); parse for others

**Fallback**: If the page structure makes scraping unreliable, accept a hardcoded JSON fixture at `data/cache/aaro_manual.json` and read from that. The fixture format mirrors the UAPRecord schema. The scraper should check for the fixture first and skip live fetching if it exists and is less than 7 days old.

### 3. GEIPAN (`geipan.ts`)

**GEIPAN** is the French space agency CNES's UAP investigation unit. They have the most structured public API of any international source.

**API base:** `https://www.cnes-geipan.fr/fr/recherche`

GEIPAN classifies cases as:
- **A**: Fully explained (IFO)
- **B**: Probably explained, lacking data
- **C**: Unknown, lacking data
- **D**: Unknown with sufficient data (genuine UAP)

**Approach:**
1. First try the GEIPAN public API endpoint. Check these URLs for a JSON or CSV data export:
   - `https://www.cnes-geipan.fr/api/` 
   - `https://www.cnes-geipan.fr/fr/recherche?format=json`
   - Look in the page source for any `fetch()` or XHR calls to find the actual data endpoint
2. If no clean API exists, scrape the search results page: fetch with pagination (`?page=1`, `?page=2`, ...), parse each case card with Cheerio
3. Each case has a detail page URL. Fetch a sample of ~50 "D" classification cases for initial import (these are the most interesting)

Field mapping:
- `_source: 'geipan'`, `country: 'FR'`, `_type: 'case'`
- `agency: 'GEIPAN / CNES'`
- GEIPAN classification → `resolution`: A/B → `'resolved'`, C → `'analysis'`, D → `'unresolved'`
- `url`: case detail page on cnes-geipan.fr
- `incidentDate`: GEIPAN uses French date formats (DD/MM/YYYY) — normalize to ISO

**Rate limit**: Add a 500ms delay between requests. GEIPAN servers are French government infrastructure — be polite.

### 4. UK National Archives (`uk_national_archives.ts`)

**Source:** `https://www.nationalarchives.gov.uk/ufos/`

The UK released 11 batches of UFO files (1997–2009 reporting period). The National Archives site has a catalogue with direct download links to zipped batches.

**Approach:**
1. Fetch the UFO landing page and extract all file batch links (likely PDFs or ZIP links)
2. For each batch link, record a single `UAPRecord` of `_type: 'pdf'` representing the batch document — do **not** try to unzip and parse individual reports (too large)
3. Additionally, check `https://discovery.nationalarchives.gov.uk/details/r/C11931` for the structured catalogue — it may have individual document records with metadata
4. Parse each catalogue entry's date range, file reference (e.g., `DEFE 24/2013/1`), description

Field mapping:
- `_source: 'uk_na'`, `country: 'GB'`
- `agency: 'UK Ministry of Defence'`
- `title`: batch title e.g. "UFO Files 1997-2009 — Batch 4"

### 5. Brazil Air Force (`brazil_af.ts`)

**Source:** `https://www.fab.mil.br/` — search for "SIOANI" or "OVNIs"

The Brazilian Air Force operated **SIOANI** (Serviço de Investigação de Objetos Aéreos Não-Identificados) and has declassified documents. Locate the relevant archive section and scrape document listings.

**Approach:**
1. Fetch `https://www.fab.mil.br/noticias/mostra/35165/` or search the site for OVNI/SIOANI releases
2. Extract PDF document links and metadata (Portuguese — use as-is for `officialBlurb`, English translation not required)
3. Set `blurb` to a brief English description derived from context

Field mapping:
- `_source: 'brazil_af'`, `country: 'BR'`, `agency: 'Brazilian Air Force (FAB)'`

### 6. Canada NRC (`canada_nrc.ts`)

**Source:** Library and Archives Canada — search for "Project Magnet" and NRC UFO reports

**Approach:**
1. Fetch `https://www.bac-lac.gc.ca/eng/discover/unusual/ufo/Pages/introduction.aspx`
2. Extract document links, dates, and descriptions
3. The NRC collected ~9,000 sighting reports between 1947–1994

Field mapping:
- `_source: 'canada_nrc'`, `country: 'CA'`, `agency: 'National Research Council of Canada'`

---

## HTTP Utility (`utils/http.ts`)

```typescript
import axios from 'axios';
import axiosRetry from 'axios-retry';

export const http = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'UAP-Aggregator/1.0 (public research; contact: your@email.com)',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

axiosRetry(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err) || err.response?.status === 429,
});
```

Add a per-scraper concurrency limiter using `p-limit`. Default: 3 concurrent requests. GEIPAN: 1.

---

## Aggregator (`aggregate.ts`)

```typescript
async function aggregate() {
  const results = await Promise.allSettled([
    runScraper('pursue_r01'),
    runScraper('aaro'),
    runScraper('geipan'),
    runScraper('uk_na'),
    runScraper('brazil_af'),
    runScraper('canada_nrc'),
  ]);

  const allRecords = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => (r as PromiseFulfilledResult<UAPRecord[]>).value);

  // Deduplicate by URL (same document appearing in multiple sources)
  const deduped = deduplicateByUrl(allRecords);

  // Build output
  const output = {
    meta: {
      generated: new Date().toISOString(),
      totalRecords: deduped.length,
      bySource: countBySource(deduped),
      byType: countByType(deduped),
    },
    records: deduped,
  };

  await fs.writeFile('data/data.json', JSON.stringify(output, null, 2));
  console.log(`Wrote ${deduped.length} records to data/data.json`);
}
```

Run with: `npm run aggregate`

---

## Express API (`index.ts`)

Endpoints:

```
GET /api/records
  ?source=pursue_r01,aaro         (comma-separated filter)
  ?type=pdf,video                 (comma-separated filter)
  ?country=US,FR                  (comma-separated filter)
  ?resolution=unresolved          
  ?q=roswell                      (full-text search on title+blurb)
  ?limit=50&offset=0              (pagination)

GET /api/records/:id              (single record by id)
GET /api/sources                  (list of sources with counts + last-scraped timestamps)
GET /api/meta                     (total counts, generation timestamp)
GET /health                       (200 OK)
```

- Serve `data/data.json` from memory (load on startup, reload every 6 hours or on SIGHUP)
- Set `Cache-Control: public, max-age=300` on all record endpoints
- Add CORS headers: `Access-Control-Allow-Origin: *`
- Compress responses with `compression` middleware

---

## Frontend Integration

After building the backend, update `index.html` to fetch from the API instead of the hardcoded jsDelivr URL. The API URL should be configurable via a `const API_BASE` at the top of the script:

```javascript
const API_BASE = 'http://localhost:3000'; // change to production URL after deploy
```

Replace the current `init()` function's fetch calls to use:
```javascript
const res = await fetch(`${API_BASE}/api/records?limit=500`);
const { records } = await res.json();
```

The record shape from the API matches the existing card rendering logic — `_source`, `_type`, `title`, `agency`, `blurb`, `thumb`, `videoMp4`, etc. are all present.

---

## Deployment

**Option A — Static (no server needed):**
Run `npm run aggregate` locally, commit `data/data.json` to GitHub, serve via jsDelivr CDN. Add a GitHub Actions workflow that re-runs the aggregator weekly:

```yaml
# .github/workflows/aggregate.yml
name: Aggregate UAP Data
on:
  schedule:
    - cron: '0 6 * * 1'   # Every Monday 6am UTC
  workflow_dispatch:
jobs:
  aggregate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run aggregate
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: weekly data refresh'
          file_pattern: 'data/data.json'
```

**Option B — Live API:**
Deploy the Express server to Railway, Render, or Fly.io. Set up a cron job on the server that runs `aggregate.ts` weekly. Use Redis or a simple JSON file for caching.

---

## Quality Checks

After running the aggregator for the first time:

1. Verify record counts: `jq '.meta.bySource' data/data.json`
2. Check for missing required fields: `jq '[.records[] | select(.url == null or .url == "")] | length' data/data.json` — should be 0
3. Check date parsing: `jq '[.records[] | select(.incidentDate != null)] | .[0:5] | .[].incidentDate' data/data.json`
4. Sample a GEIPAN record to verify French encoding is preserved: `jq '[.records[] | select(._source == "geipan")] | .[0]' data/data.json`
5. Verify no duplicate IDs: `jq '[.records[].id] | length - (unique | length)' data/data.json` — should be 0

---

## Notes

- **Be a good citizen**: All scrapers must respect `robots.txt`. Check before scraping: `https://{domain}/robots.txt`. If scraping is disallowed, fall back to publicly available data exports or cached fixtures.
- **GEIPAN rate limiting**: Their servers are public French government infrastructure. Never run more than 1 concurrent request. Add `await sleep(500)` between pages.
- **UK National Archives**: The site may require a session cookie for some document downloads. If 403s occur, try adding a `Referer` header pointing to the catalogue page.
- **Language**: Store non-English `officialBlurb` values as-is. Put English context in `blurb`. Do not machine-translate — just note the language in the `tags` array (e.g., `["lang:fr"]`, `["lang:pt"]`).
- **Future sources to add**: Chile CEFAA (`difaa.cl`), Peru DIFAA, Uruguay CRIDOVNI, Australia RAAF (digitized at NAA), New Zealand RNZAF (already fully online at `nzdf.mil.nz`). Stub these out as scrapers that return `[]` with a TODO comment so they're easy to fill in later.
