import seedDataset from './data/benchmarks-th-2026.10-draft.json'
import type { BenchmarkKey } from './benchmark-keys'
import { benchmarkDatasetSchema, type BenchmarkDataset, type BenchmarkValue } from './schema'
import type { BenchmarkId, RoomType } from '../types'

export type { BenchmarkKey } from './benchmark-keys'
export type { BenchmarkDataset, BenchmarkSource, BenchmarkValue } from './schema'

/**
 * The benchmark dataset in use, validated when the module loads so bad data fails the build.
 * Released files are never edited: a correction is a new versioned file imported here.
 */
export const BENCHMARKS: BenchmarkDataset = benchmarkDatasetSchema.parse(seedDataset)
export const BENCHMARK_IDS: readonly BenchmarkId[] = ['th-public-building', 'th-dop-home']

export type BenchmarkContext = { roomType: RoomType; mobilityAids: readonly string[] }

/**
 * The household brief stores mobility aids as the labels the user picked, in either language.
 * Benchmarks talk about canonical aids, so map the labels we offer onto them.
 */
export function canonicalMobilityAids(aids: readonly string[]): string[] {
  const canonical = new Set<string>()
  for (const aid of aids) {
    const value = aid.trim().toLowerCase()
    if (value.includes('wheelchair') || value.includes('รถเข็น') || value.includes('เก้าอี้ล้อ')) canonical.add('wheelchair')
    else if (value.includes('walker') || value.includes('รถช่วยเดิน') || value.includes('โครงช่วยเดิน')) canonical.add('walker')
    else if (value.includes('cane') || value.includes('ไม้เท้า')) canonical.add('cane')
  }
  return [...canonical]
}

function applies(value: BenchmarkValue, context: BenchmarkContext): boolean {
  const when = value.appliesWhen
  if (!when) return true
  if (when.roomTypes && !when.roomTypes.includes(context.roomType)) return false
  if (when.mobilityAids) {
    const aids = canonicalMobilityAids(context.mobilityAids)
    if (!when.mobilityAids.some((aid) => aids.includes(aid))) return false
  }
  return true
}

/**
 * The value each benchmark gives for a key in this context. null means the dataset has no
 * entry that applies. An entry with `notApplicableReason` is returned as-is: it is an explicit
 * "no value" and carries the reason to show.
 */
export function getBenchmarkValues(key: BenchmarkKey, context: BenchmarkContext, dataset: BenchmarkDataset = BENCHMARKS): Record<BenchmarkId, BenchmarkValue | null> {
  const find = (benchmarkId: BenchmarkId) => dataset.values.find((value) => value.key === key && value.benchmarkId === benchmarkId && applies(value, context)) ?? null
  return { 'th-public-building': find('th-public-building'), 'th-dop-home': find('th-dop-home') }
}

/** True when the benchmark gives an actual value, as opposed to no entry or an explicit "not applicable". */
export function hasValue(value: BenchmarkValue | null): value is BenchmarkValue & { notApplicableReason?: undefined } {
  return value !== null && !value.notApplicableReason
}

/** How many values in the dataset are still waiting for review against their source. */
export function pendingBenchmarkCount(dataset: BenchmarkDataset = BENCHMARKS): { pending: number; total: number } {
  const values = dataset.values.filter((value) => !value.notApplicableReason)
  return { pending: values.filter((value) => value.review.status === 'pending').length, total: values.length }
}

/**
 * The value a fix should aim for (spec §10): the primary benchmark if one is set and has a value,
 * otherwise the stricter of the benchmarks that have one. "Stricter" means the larger minimum,
 * the smaller maximum, or the narrower range.
 */
export function strictestValue(key: BenchmarkKey, context: BenchmarkContext, primary: BenchmarkId | null = null, dataset: BenchmarkDataset = BENCHMARKS): BenchmarkValue | null {
  const values = getBenchmarkValues(key, context, dataset)
  if (primary && hasValue(values[primary])) return values[primary]
  const candidates = BENCHMARK_IDS.map((id) => values[id]).filter(hasValue)
  if (!candidates.length) return null
  return candidates.reduce((strictest, candidate) => {
    switch (candidate.comparison) {
      case 'min': return (candidate.minMm ?? 0) > (strictest.minMm ?? 0) ? candidate : strictest
      case 'max': return (candidate.maxMm ?? Infinity) < (strictest.maxMm ?? Infinity) ? candidate : strictest
      case 'range': return (candidate.maxMm! - candidate.minMm!) < (strictest.maxMm! - strictest.minMm!) ? candidate : strictest
      case 'allowed-values': return (candidate.allowed?.length ?? Infinity) < (strictest.allowed?.length ?? Infinity) ? candidate : strictest
      default: return strictest
    }
  })
}

/** The single target number a fix uses for a value: the bound for min/max, the midpoint (to 10 mm) for a range. */
export function targetMm(value: BenchmarkValue): number | null {
  if (value.comparison === 'min') return value.minMm ?? null
  if (value.comparison === 'max') return value.maxMm ?? null
  if (value.comparison === 'range' && value.minMm !== undefined && value.maxMm !== undefined) return Math.round((value.minMm + value.maxMm) / 20) * 10
  return null
}
