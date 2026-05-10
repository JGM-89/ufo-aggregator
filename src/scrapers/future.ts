/**
 * Future sources — placeholder stubs for countries with public UAP archives.
 * Each returns [] for v1 so the frontend can already list them as "coming soon".
 *
 *  - Chile CEFAA   (https://www.cefaa.gob.cl) — most active intl program
 *  - Peru DIFAA    (https://www.fap.mil.pe)
 *  - Uruguay CRIDOVNI (https://www.fau.mil.uy)
 *  - Australia RAAF (digitized at National Archives of Australia, NAA)
 *  - New Zealand RNZAF (nzdf.mil.nz — fully online)
 */
import type { UAPRecord } from '../schema';

export async function scrapeChileCEFAA(): Promise<UAPRecord[]> { return []; }
export async function scrapePeruDIFAA(): Promise<UAPRecord[]> { return []; }
export async function scrapeUruguayCRIDOVNI(): Promise<UAPRecord[]> { return []; }
export async function scrapeAustraliaRAAF(): Promise<UAPRecord[]> { return []; }
export async function scrapeNZRNZAF(): Promise<UAPRecord[]> { return []; }
