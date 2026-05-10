# UFO/UAP Aggregator

Aggregates declassified UFO/UAP records from official government sources into a single normalized JSON feed. The frontend ([index.html](index.html)) consumes the aggregated feed from this repo via jsDelivr; the backend (in `src/`) can also be run as a live Express API for local development.

## Sources

| Source | Status | Records |
|---|---|---|
| PURSUE Release 01 + 02 (U.S. Dept of War) | live | ~280 |
| AARO Official Imagery (U.S. DoD) | fixture | 32 |
| GEIPAN / CNES (France) | stub | 0 |
| UK National Archives (MoD) | stub | 0 |
| Brazil FAB (SIOANI) | stub | 0 |
| Canada NRC | stub | 0 |
| Chile CEFAA, Peru DIFAA, Uruguay CRIDOVNI, Australia RAAF, NZ RNZAF | placeholder | 0 |

## Quick start

```bash
npm install
npm run aggregate            # produces data/data.json
npm run dev                  # Express on http://localhost:3000
```

Open `index.html` in a browser. When served from `localhost` or `file://`, it auto-targets the local Express API; otherwise it hits jsDelivr.

## API

- `GET /health`
- `GET /api/meta`
- `GET /api/sources`
- `GET /api/records?source=&type=&country=&resolution=&q=&limit=&offset=`
- `GET /api/records/:id`

## Schema

See [src/schema.ts](src/schema.ts). Every record carries `id`, `_source`, `_type`, `title`, `agency`, optional dates, `url`, `country` (ISO-2), `tags`, and a `raw` payload for source-specific fields.

## Refreshing data

A GitHub Actions workflow ([.github/workflows/aggregate.yml](.github/workflows/aggregate.yml)) re-runs the aggregator every Monday 06:00 UTC and commits the updated `data/data.json`. Trigger manually with `gh workflow run aggregate.yml`.

## Adding a scraper

1. Create `src/scrapers/<source>.ts` exporting `async function scrape(): Promise<UAPRecord[]>`
2. Register it in `src/aggregate.ts` `RUNNERS`
3. Add the new source id to `SOURCES` in `src/schema.ts`
4. Verify with `npx ts-node scripts/run-scraper.ts <source>`
