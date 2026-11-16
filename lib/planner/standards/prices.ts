import priceData from './data/prices-2026.10.json'
import { getRegion } from './provinces'
import { priceListSchema, type CostBand, type PriceEntry, type PriceList } from './schema'
import type { CostRange } from '../types'

/** The price list in use, validated when the module loads. Entries stay null until real job prices are collected. */
export const PRICES: PriceList = priceListSchema.parse(priceData)

export function getPriceEntry(priceKey: string, list: PriceList = PRICES): PriceEntry | undefined {
  return list.prices.find((price) => price.priceKey === priceKey)
}

/**
 * Default cost ranges for a fix in a province. The region's value comes first, then the
 * national value. null means "no default price yet": the recommendation's cost stays unknown.
 */
export function getDefaultCosts(priceKey: string | null, provinceCode: string | null, list: PriceList = PRICES): { materials: CostRange | null; labour: CostRange | null } {
  const none = { materials: null, labour: null }
  if (!priceKey) return none
  const entry = getPriceEntry(priceKey, list)
  if (!entry || !entry.collectedAt) return none
  const region = getRegion(provinceCode)
  const band: CostBand | null = (region ? entry.regions[region] : undefined) ?? entry.national
  if (!band) return none
  // Estimate provenance travels with the numbers, as for hand-entered estimates.
  const estimatedAt = /^\d{4}-\d{2}-\d{2}$/.test(entry.collectedAt) ? `${entry.collectedAt}T00:00:00.000Z` : entry.collectedAt
  const range = (value: [number, number] | null): CostRange | null => value ? { lowSatang: value[0], highSatang: value[1], sourceNote: entry.sourceNote, estimatedAt } : null
  return { materials: range(band.materials), labour: range(band.labour) }
}
