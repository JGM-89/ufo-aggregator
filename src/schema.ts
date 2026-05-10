import { z } from 'zod';

export const SOURCES = [
  'pursue_r01',
  'aaro',
  'geipan',
  'uk_na',
  'brazil_af',
  'canada_nrc',
  'chile_cefaa',
  'peru_difaa',
  'uruguay_cridovni',
  'australia_raaf',
  'nz_rnzaf',
] as const;

export type SourceId = (typeof SOURCES)[number];

export const RECORD_TYPES = ['pdf', 'image', 'video', 'case'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RESOLUTIONS = ['resolved', 'unresolved', 'analysis'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// Partial-date validator: accepts YYYY, YYYY-MM, or YYYY-MM-DD
const partialDate = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'must be YYYY, YYYY-MM, or YYYY-MM-DD')
  .nullable();

export const UAPRecordSchema = z.object({
  id: z.string().min(1),
  _source: z.enum(SOURCES),
  _type: z.enum(RECORD_TYPES),
  title: z.string().min(1),
  agency: z.string(),
  incidentDate: partialDate,
  incidentLocation: z.string().nullable(),
  releaseDate: partialDate,
  resolution: z.enum(RESOLUTIONS).nullable(),
  blurb: z.string().nullable(),
  officialBlurb: z.string().nullable(),
  url: z.string().url(),
  fileUrl: z.string().url().nullable(),
  videoMp4: z.string().url().nullable(),
  thumb: z.string().url().nullable(),
  tags: z.array(z.string()),
  country: z.string().length(2),
  classification: z.string().nullable(),
  raw: z.record(z.unknown()),
});

export type UAPRecord = z.infer<typeof UAPRecordSchema>;

export const SCHEMA_VERSION = 1;

export interface AggregateOutput {
  meta: {
    generated: string;
    _schemaVersion: number;
    totalRecords: number;
    bySource: Record<string, number>;
    byType: Record<string, number>;
    lastScraped: Record<string, string | null>;
  };
  records: UAPRecord[];
}
