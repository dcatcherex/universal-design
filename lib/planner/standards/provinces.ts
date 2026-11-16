import provincesData from './data/provinces-th.json'
import { provincesSchema, type PriceRegion, type Province } from './schema'

/** All 77 provinces, validated when the module loads so bad data fails the build. */
export const PROVINCES: readonly Province[] = provincesSchema.parse(provincesData).provinces

export function getProvince(code: string | null): Province | undefined {
  return code === null ? undefined : PROVINCES.find((province) => province.code === code)
}

export function getRegion(provinceCode: string | null): PriceRegion | null {
  return getProvince(provinceCode)?.region ?? null
}

/** Matches free text only when it equals a Thai or English province name (ignoring case and outer spaces). */
export function matchProvinceCode(text: string): string | null {
  const wanted = text.trim().toLowerCase()
  if (!wanted) return null
  return PROVINCES.find((province) => province.th === wanted || province.en.toLowerCase() === wanted)?.code ?? null
}
