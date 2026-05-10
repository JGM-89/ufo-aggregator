import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs/promises';
import path from 'path';
import { AggregateOutput, UAPRecord } from './schema';
import { makeLogger } from './utils/logger';

const log = makeLogger('server');
const DATA_PATH = path.join('data', 'data.json');
const PORT = Number(process.env.PORT ?? 3000);
const RELOAD_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache: AggregateOutput = {
  meta: { generated: '', _schemaVersion: 1, totalRecords: 0, bySource: {}, byType: {}, lastScraped: {} },
  records: [],
};

async function loadData(): Promise<void> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    cache = JSON.parse(raw);
    log.info(`loaded ${cache.records.length} records from ${DATA_PATH}`);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      log.warn(`${DATA_PATH} not found. Run: npm run aggregate`);
    } else {
      log.error('failed to load data', err);
    }
  }
}

function parseCsv(v: unknown): string[] | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function filterRecords(req: Request): UAPRecord[] {
  let out = cache.records;
  const sources = parseCsv(req.query.source);
  if (sources) out = out.filter((r) => sources.includes(r._source));
  const types = parseCsv(req.query.type);
  if (types) out = out.filter((r) => types.includes(r._type));
  const countries = parseCsv(req.query.country);
  if (countries) out = out.filter((r) => countries.includes(r.country));
  const resolutions = parseCsv(req.query.resolution);
  if (resolutions) out = out.filter((r) => r.resolution !== null && resolutions.includes(r.resolution));
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  if (q) {
    out = out.filter((r) => {
      const hay = [r.title, r.blurb, r.officialBlurb, r.agency, r.incidentLocation]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }
  return out;
}

const app = express();
app.use(cors());
app.use(compression());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', records: cache.records.length });
});

app.get('/api/meta', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(cache.meta);
});

app.get('/api/sources', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  const sources = Object.entries(cache.meta.bySource).map(([id, count]) => ({
    id,
    count,
    lastScraped: cache.meta.lastScraped[id] ?? null,
  }));
  res.json({ sources });
});

app.get('/api/records/:id', (req: Request, res: Response) => {
  const rec = cache.records.find((r) => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: 'not_found' });
  res.set('Cache-Control', 'public, max-age=300');
  res.json(rec);
});

app.get('/api/records', (req, res) => {
  const limit = Math.max(0, Math.min(1000, Number(req.query.limit ?? 100)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));
  const filtered = filterRecords(req);
  const page = filtered.slice(offset, offset + limit);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    meta: {
      total: filtered.length,
      offset,
      limit,
      generated: cache.meta.generated,
    },
    records: page,
  });
});

async function main() {
  await loadData();
  setInterval(loadData, RELOAD_MS);
  app.listen(PORT, () => log.info(`listening on http://localhost:${PORT}`));

  // Reload on SIGHUP (unix only; Windows ignores)
  process.on('SIGHUP', () => {
    log.info('SIGHUP — reloading data');
    loadData();
  });
}

main();
