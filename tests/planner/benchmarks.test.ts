import { describe, expect, it } from 'vitest'
import { BENCHMARK_KEYS } from '../../lib/planner/standards/benchmark-keys'
import { BENCHMARKS, canonicalMobilityAids, getBenchmarkValues, pendingBenchmarkCount, strictestValue, targetMm, type BenchmarkDataset } from '../../lib/planner/standards/benchmarks'
import { FIXES } from '../../lib/planner/standards/fixes'
import { getDefaultCosts, PRICES } from '../../lib/planner/standards/prices'
import { getRegion, matchProvinceCode, PROVINCES } from '../../lib/planner/standards/provinces'
import { benchmarkDatasetSchema, PRICE_REGIONS, type PriceList } from '../../lib/planner/standards/schema'
import { evaluateVerdict, statusFromVerdicts } from '../../lib/planner/standards/verdicts'
import type { Measurement } from '../../lib/planner/types'

const living = { roomType: 'living' as const, mobilityAids: [] }
const bathroom = { roomType: 'bathroom' as const, mobilityAids: [] }
const now = '2026-09-28T00:00:00.000Z'

/** A copy of the seed data with chosen values marked reviewed. The seed file itself is never marked reviewed in tests. */
function reviewedDataset(...keys: string[]): BenchmarkDataset {
  const copy = structuredClone(BENCHMARKS)
  for (const value of copy.values) if (keys.includes(value.key)) value.review = { status: 'reviewed', reviewer: 'Test reviewer', reviewedAt: '2026-11-01' }
  return benchmarkDatasetSchema.parse(copy)
}

const measurement = (valueMm: number, kind: 'estimated' | 'measured' | 'on-site' | 'photo' | 'unspecified' = 'estimated'): Measurement => kind === 'estimated' || kind === 'measured'
  ? { valueMm, confidence: kind }
  : { valueMm, confidence: 'advisor-verified', verifiedBy: 'Advisor', verifiedAt: now, verificationMethod: kind }

describe('benchmark dataset', () => {
  it('uses only known keys, at most once per benchmark, each with a clause or a reason', () => {
    const seen = new Set<string>()
    for (const value of BENCHMARKS.values) {
      expect(BENCHMARK_KEYS).toContain(value.key)
      const pair = `${value.key}|${value.benchmarkId}`
      expect(seen.has(pair), pair).toBe(false)
      seen.add(pair)
      expect(Boolean(value.clause.trim()) || Boolean(value.notApplicableReason), pair).toBe(true)
    }
    // Both benchmarks say something about every key, even if only "no value".
    expect(seen.size).toBe(BENCHMARK_KEYS.length * 2)
  })

  it('ships with every seed value still pending review', () => {
    expect(BENCHMARKS.values.every((value) => value.review.status === 'pending')).toBe(true)
    const { pending, total } = pendingBenchmarkCount()
    expect(pending).toBe(total)
    expect(total).toBeGreaterThan(0)
  })

  it('rejects a dataset with a duplicate pair or a value without a clause', () => {
    const duplicate = structuredClone(BENCHMARKS)
    duplicate.values.push(structuredClone(duplicate.values[0]))
    expect(benchmarkDatasetSchema.safeParse(duplicate).success).toBe(false)
    const noClause = structuredClone(BENCHMARKS)
    noClause.values[0].clause = ''
    expect(benchmarkDatasetSchema.safeParse(noClause).success).toBe(false)
  })

  it('applies room-type and mobility-aid conditions', () => {
    expect(getBenchmarkValues('bathroom.turningDiameter', living)['th-public-building']).toBeNull()
    expect(getBenchmarkValues('bathroom.turningDiameter', bathroom)['th-public-building']?.minMm).toBe(1500)
    expect(getBenchmarkValues('socket.height', living)['th-dop-home']).toBeNull()
    expect(getBenchmarkValues('socket.height', { roomType: 'living', mobilityAids: ['รถเข็น'] })['th-dop-home']?.minMm).toBe(800)
    expect(canonicalMobilityAids(['Wheelchair', 'ไม้เท้า', 'something else'])).toEqual(['wheelchair', 'cane'])
  })

  it('picks the stricter value for a fix unless a primary benchmark is set', () => {
    expect(strictestValue('door.clearWidth', living)?.minMm).toBe(900)
    expect(strictestValue('door.clearWidth', living, 'th-public-building')?.minMm).toBe(860)
    expect(strictestValue('door.threshold', living)?.maxMm).toBe(13)
    // Only the public-building benchmark has a grab bar height: 650-700, midpoint 675, rounded to 10 mm.
    expect(targetMm(strictestValue('grabBar.horizontalHeight', bathroom)!)).toBe(680)
    expect(strictestValue('toilet.type', bathroom, 'th-public-building')?.benchmarkId).toBe('th-dop-home')
  })
})

describe('provinces and regions', () => {
  it('lists 77 provinces with unique codes and uses every price region', () => {
    expect(PROVINCES).toHaveLength(77)
    expect(new Set(PROVINCES.map((province) => province.code)).size).toBe(77)
    expect(new Set(PROVINCES.map((province) => province.region))).toEqual(new Set(PRICE_REGIONS))
    expect(getRegion('10')).toBe('bangkok-vicinity')
    expect(getRegion(null)).toBeNull()
    expect(matchProvinceCode('  khon kaen ')).toBe('40')
    expect(matchProvinceCode('ขอนแก่นเหนือ')).toBeNull()
  })
})

describe('verdicts', () => {
  const verdict = (measured: Measurement, dataset?: BenchmarkDataset) => evaluateVerdict({ key: 'door.clearWidth', measured, context: living, primary: null, dataset }).verdicts

  it('is never definite on the seed data, even with on-site verified input', () => {
    expect(verdict(measurement(900, 'on-site')).map((entry) => entry.outcome)).toEqual(['likely-meets', 'likely-meets'])
    expect(verdict(measurement(800, 'on-site')).map((entry) => entry.outcome)).toEqual(['likely-does-not-meet', 'likely-does-not-meet'])
    expect(verdict(measurement(900, 'on-site')).every((entry) => entry.pendingReview)).toBe(true)
  })

  it('is definite only with a reviewed value and on-site verification', () => {
    const reviewed = reviewedDataset('door.clearWidth')
    expect(verdict(measurement(900, 'on-site'), reviewed).map((entry) => entry.outcome)).toEqual(['meets', 'meets'])
    expect(verdict(measurement(850, 'on-site'), reviewed).map((entry) => entry.outcome)).toEqual(['does-not-meet', 'does-not-meet'])
    for (const kind of ['photo', 'unspecified', 'measured', 'estimated'] as const) {
      expect(verdict(measurement(900, kind), reviewed).map((entry) => entry.outcome), kind).toEqual(['likely-meets', 'likely-meets'])
    }
  })

  it('needs every compared measurement to be on-site verified', () => {
    const reviewed = reviewedDataset('grabBar.horizontalHeight')
    const run = (measured: Measurement[]) => evaluateVerdict({ key: 'grabBar.horizontalHeight', measured, context: bathroom, primary: null, dataset: reviewed }).verdicts[0].outcome
    expect(run([measurement(680, 'on-site'), measurement(690, 'on-site')])).toBe('meets')
    expect(run([measurement(680, 'on-site'), measurement(690, 'photo')])).toBe('likely-meets')
    expect(run([measurement(680, 'on-site'), measurement(720, 'on-site')])).toBe('does-not-meet')
  })

  it('treats a value equal to the bound as meeting it and 1 mm beyond as not', () => {
    const outcome = (key: 'door.clearWidth' | 'door.threshold' | 'toilet.seatHeight', valueMm: number) => evaluateVerdict({ key, measured: measurement(valueMm), context: bathroom, primary: null }).verdicts[0].outcome
    expect(outcome('door.clearWidth', 860)).toBe('likely-meets')
    expect(outcome('door.clearWidth', 859)).toBe('likely-does-not-meet')
    expect(outcome('door.threshold', 13)).toBe('likely-meets')
    expect(outcome('door.threshold', 14)).toBe('likely-does-not-meet')
    expect(outcome('toilet.seatHeight', 400)).toBe('likely-meets')
    expect(outcome('toilet.seatHeight', 450)).toBe('likely-meets')
    expect(outcome('toilet.seatHeight', 399)).toBe('likely-does-not-meet')
    expect(outcome('toilet.seatHeight', 451)).toBe('likely-does-not-meet')
  })

  it('compares allowed values and reports an explicit no-value with neither pass nor fail', () => {
    const operation = (value: string) => evaluateVerdict({ key: 'bathroom.doorOperation', measured: { value, definiteInput: false }, context: bathroom, primary: null })
    expect(operation('sliding').status).toBe('clear')
    expect(operation('hinged-out').status).toBe('clear')
    expect(operation('hinged-in').status).toBe('attention')
    const type = evaluateVerdict({ key: 'toilet.type', measured: { value: 'seated', definiteInput: false }, context: bathroom, primary: null })
    expect(type.verdicts.map((entry) => entry.outcome)).toEqual(['no-value', 'likely-meets'])
    // One benchmark without a value plus the other met is clear.
    expect(type.status).toBe('clear')
  })

  it('returns not-evaluated when the fact was not recorded', () => {
    const missing = evaluateVerdict({ key: 'door.clearWidth', measured: null, context: living, primary: null })
    expect(missing.verdicts.map((entry) => entry.outcome)).toEqual(['not-evaluated', 'not-evaluated'])
    expect(missing.status).toBe('not-evaluated')
  })

  it('derives the overall status with and without a primary benchmark', () => {
    // 870 mm: meets the public-building 860, misses the home 900.
    const split = evaluateVerdict({ key: 'door.clearWidth', measured: measurement(870), context: living, primary: null })
    expect(split.verdicts.map((entry) => entry.outcome)).toEqual(['likely-meets', 'likely-does-not-meet'])
    expect(split.status).toBe('attention')
    expect(statusFromVerdicts(split.verdicts, 'th-public-building')).toBe('clear')
    expect(statusFromVerdicts(split.verdicts, 'th-dop-home')).toBe('attention')
    // A primary benchmark that has no value leaves the check not evaluated rather than clear.
    const type = evaluateVerdict({ key: 'toilet.type', measured: { value: 'seated', definiteInput: false }, context: bathroom, primary: 'th-public-building' })
    expect(type.status).toBe('not-evaluated')
  })
})

describe('fix library and price list', () => {
  it('resolves every price key and keeps every price empty until real data exists', () => {
    const keys = new Set(PRICES.prices.map((price) => price.priceKey))
    for (const fix of FIXES.fixes) if (fix.priceKey) expect(keys.has(fix.priceKey), fix.id).toBe(true)
    expect(PRICES.prices.every((price) => price.national === null && Object.keys(price.regions).length === 0)).toBe(true)
    expect(getDefaultCosts('grab-bar-horizontal', '50')).toEqual({ materials: null, labour: null })
    expect(getDefaultCosts(null, '50')).toEqual({ materials: null, labour: null })
  })

  it('prefers a regional price over the national one and copies its provenance', () => {
    const prices: PriceList = {
      version: 'test',
      prices: [{
        priceKey: 'grab-bar-horizontal', unit: 'per-item', label: { th: 'ราวจับ', en: 'Grab bar' },
        national: { materials: [100000, 200000], labour: [50000, 80000] },
        regions: { north: { materials: [90000, 150000], labour: null } },
        sourceNote: 'Test jobs', collectedAt: '2026-10-01', sampleSize: 16,
      }],
    }
    expect(getDefaultCosts('grab-bar-horizontal', '50', prices)).toEqual({
      materials: { lowSatang: 90000, highSatang: 150000, sourceNote: 'Test jobs', estimatedAt: '2026-10-01T00:00:00.000Z' }, labour: null,
    })
    expect(getDefaultCosts('grab-bar-horizontal', '10', prices).labour).toMatchObject({ lowSatang: 50000, highSatang: 80000 })
    expect(getDefaultCosts('grab-bar-horizontal', null, prices).materials?.lowSatang).toBe(100000)
  })
})
