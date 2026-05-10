import fs from 'fs/promises';
import path from 'path';
import { http } from '../utils/http';
import { makeLogger } from '../utils/logger';
import { makeId, normalizeDate, classifyResolution } from '../utils/normalize';
import { UAPRecord, RecordType } from '../schema';

const log = makeLogger('pursue_r01');

const RELEASES = [
  {
    json: 'https://cdn.jsdelivr.net/gh/vng9trmgr8-pixel/war-gov-ufo-release-1@main/data.json',
    base: 'https://cdn.jsdelivr.net/gh/vng9trmgr8-pixel/war-gov-ufo-release-1@main',
  },
  {
    json: 'https://cdn.jsdelivr.net/gh/vng9trmgr8-pixel/war-gov-ufo-release-2@main/data.json',
    base: 'https://cdn.jsdelivr.net/gh/vng9trmgr8-pixel/war-gov-ufo-release-2@main',
  },
];

function absolutize(url: string | null, base: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

interface PursueItem {
  title: string;
  agency?: string;
  incidentDate?: string;
  incidentLocation?: string;
  releaseDate?: string;
  blurb?: string;
  officialBlurb?: string;
  url?: string;
  thumb?: string;
  videoId?: string;
  videoTitle?: string;
  videoMp4?: string;
  embed?: string;
  dvidsPage?: string;
}

interface PursueData {
  release?: string;
  pdfs?: PursueItem[];
  images?: PursueItem[];
  videos?: PursueItem[];
}

function cleanField(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === 'N/A' || s.toLowerCase() === 'n/a' || s === '-') return null;
  return s;
}

function mapItem(item: PursueItem, type: RecordType, release: string, base: string): UAPRecord | null {
  const title = cleanField(item.title);
  // For videos, the canonical URL is the DVIDS page (item.url is often empty
  // or points to a related PDF). For pdfs/images, use item.url.
  const dvidsPage = cleanField(item.dvidsPage);
  const rawUrl =
    type === 'video' && dvidsPage ? dvidsPage : cleanField(item.url) ?? dvidsPage;
  const url = absolutize(rawUrl, base);
  if (!title || !url) return null;

  const blurb = cleanField(item.blurb);
  const officialBlurb = cleanField(item.officialBlurb);
  const relatedDoc = type === 'video' ? cleanField(item.url) : null;

  // Derive id from URL basename for stable uniqueness (multiple records may share a title).
  // For videos we suffix with videoId so two videos on the same DVIDS page don't collide.
  const urlBasename = url.split('/').pop()?.replace(/\.\w+$/, '') ?? title;
  const idKey = type === 'video' && item.videoId ? `${release}-v${item.videoId}` : `${release}-${urlBasename}`;
  return {
    id: makeId('pursue_r01', idKey),
    _source: 'pursue_r01',
    _type: type,
    title,
    agency: cleanField(item.agency) ?? 'U.S. Department of War',
    incidentDate: normalizeDate(cleanField(item.incidentDate)),
    incidentLocation: cleanField(item.incidentLocation),
    releaseDate: normalizeDate(cleanField(item.releaseDate)),
    resolution: classifyResolution(blurb, officialBlurb),
    blurb,
    officialBlurb,
    url,
    fileUrl: type === 'pdf' || type === 'image' ? url : absolutize(relatedDoc, base),
    videoMp4: absolutize(cleanField(item.videoMp4), base),
    thumb: absolutize(cleanField(item.thumb), base),
    tags: [`release_${release}`],
    country: 'US',
    classification: null,
    raw: {
      ...item,
      _release: release,
      // expose dvidsPage as dvidUrl for the frontend's existing DVIDS-button code path
      dvidUrl: dvidsPage ?? null,
    },
  };
}

async function fetchRelease(url: string): Promise<PursueData | null> {
  try {
    const res = await http.get<PursueData>(url, { responseType: 'json' });
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      log.debug(`release not found: ${url}`);
      return null;
    }
    throw err;
  }
}

export async function scrape(): Promise<UAPRecord[]> {
  const records: UAPRecord[] = [];
  for (const release of RELEASES) {
    log.info(`fetching ${release.json}`);
    const data = await fetchRelease(release.json);
    if (!data) continue;

    const releaseNum = data.release ?? release.json.match(/release-(\d+)/)?.[1] ?? '01';

    // Cache raw
    const cachePath = path.join('data', 'cache', `pursue_r${releaseNum}.json`);
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2));

    const pdfs = (data.pdfs ?? []).map((x) => mapItem(x, 'pdf', releaseNum, release.base));
    const images = (data.images ?? []).map((x) => mapItem(x, 'image', releaseNum, release.base));
    const videos = (data.videos ?? []).map((x) => mapItem(x, 'video', releaseNum, release.base));

    for (const r of [...pdfs, ...images, ...videos]) if (r) records.push(r);
    log.info(
      `release ${releaseNum}: ${data.pdfs?.length ?? 0} pdfs, ${data.images?.length ?? 0} images, ${data.videos?.length ?? 0} videos`
    );
  }

  log.info(`returning ${records.length} records`);
  return records;
}
