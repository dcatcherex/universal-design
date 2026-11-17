import priceData from '../../lib/planner/standards/data/prices-2026.10.json'
import { importPrices } from '../../lib/planner/standards/import-prices'
import { priceListSchema } from '../../lib/planner/standards/schema'
import { describe, expect, it } from 'vitest'

const header = 'priceKey,region,materialsLow,materialsHigh,labourLow,labourHigh,jobDate,province,note'
const basePrices = priceListSchema.parse(priceData)

function csv(...rows: string[]) {
  return [header, ...rows].join('\n')
}

function job(materialsLow: number, materialsHigh: number, labourLow: number, labourHigh: number, jobDate: string, note = '') {
  return `door-rehang-out,north,${materialsLow},${materialsHigh},${labourLow},${labourHigh},${jobDate},เชียงใหม่,"${note.replace(/"/g, '""')}"`
}

function imported(text: string) {
  const result = importPrices(text, basePrices, '2026.11')
  if (!result.ok) throw new Error(result.error)
  return result.value
}

describe('price CSV import', () => {
  it('rejects a high amount below its low amount with the CSV row number', () => {
    expect(importPrices(csv(job(200, 100, 50, 70, '2026-10-01')), basePrices, '2026.11')).toMatchObject({
      ok: false,
      error: expect.stringContaining('row 2'),
    })
  })

  it('rejects a price key absent from the current list with the CSV row number', () => {
    expect(importPrices(csv(job(100, 200, 50, 70, '2026-10-01').replace('door-rehang-out', 'not-a-price')), basePrices, '2026.11')).toMatchObject({
      ok: false,
      error: expect.stringContaining('row 2'),
    })
  })

  it('rejects a region outside the PriceRegion union with the CSV row number', () => {
    expect(importPrices(csv(job(100, 200, 50, 70, '2026-10-01').replace(',north,', ',moon,')), basePrices, '2026.11')).toMatchObject({
      ok: false,
      error: expect.stringContaining('row 2'),
    })
  })

  it('aggregates three jobs into satang bands and validates the resulting price list', () => {
    const original = JSON.stringify(basePrices)
    const result = imported(csv(
      job(100, 150, 50, 80, '2026-10-01'),
      job(120, 200, 40, 75, '2026-10-17'),
      job(90, 180, 60, 90, '2026-10-12'),
    ))
    const priceList = priceListSchema.parse(result.priceList)
    const entry = priceList.prices.find((price) => price.priceKey === 'door-rehang-out')!

    expect(entry.regions.north).toEqual({ materials: [9000, 20000], labour: [4000, 9000] })
    expect(entry.sampleSize).toBe(3)
    expect(entry.collectedAt).toBe('2026-10-17')
    expect(entry.sourceNote).toContain('3 completed jobs')
    expect(priceList.version).toBe('2026.11')
    expect(JSON.stringify(basePrices)).toBe(original)
  })

  it('leaves a region without a price and explains when fewer than three jobs were supplied', () => {
    const result = imported(csv(
      job(100, 150, 50, 80, '2026-10-01'),
      job(120, 200, 40, 75, '2026-10-17'),
    ))
    const priceList = priceListSchema.parse(result.priceList)
    const entry = priceList.prices.find((price) => price.priceKey === 'door-rehang-out')!

    expect(entry.regions.north).toBeUndefined()
    expect(result.skipped).toContain('door-rehang-out / north skipped: 2 jobs; at least 3 required.')
    expect(entry.sampleSize).toBe(0)
    expect(entry.collectedAt).toBeNull()
  })

  it('parses quoted fields containing commas and skips clearly marked template examples', () => {
    const example = 'door-rehang-out,north,,,,,,,"EXAMPLE - delete this row"'
    const result = imported(csv(
      example,
      job(100, 150, 50, 80, '2026-10-01', 'materials, labour, and "delivery"'),
      job(120, 200, 40, 75, '2026-10-17'),
      job(90, 180, 60, 90, '2026-10-12'),
    ))
    const priceList = priceListSchema.parse(result.priceList)

    expect(priceList.prices.find((price) => price.priceKey === 'door-rehang-out')?.sampleSize).toBe(3)
    expect(priceList.prices.find((price) => price.priceKey === 'door-rehang-out')?.sourceNote).toContain('materials, labour, and "delivery"')
  })
})
