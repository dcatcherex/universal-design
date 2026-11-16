import { BENCHMARK_IDS, BENCHMARKS, getBenchmarkValues, hasValue, type BenchmarkContext, type BenchmarkDataset, type BenchmarkKey, type BenchmarkValue } from './benchmarks'
import type { BenchmarkId, BenchmarkVerdict, CheckResult, Measurement, VerdictOutcome } from '../types'

/**
 * What is being compared with the benchmark:
 * - a Measurement, or several that must all satisfy the value (e.g. each end of a bar);
 * - a string for `allowed-values` keys (door operation, toilet type), with the confidence of
 *   the fact it was read from; or
 * - `null` when the fact has not been recorded.
 */
export type Measured =
  | Measurement
  | Measurement[]
  | { value: string; definiteInput: boolean }
  | { satisfied: boolean | null; definiteInput: boolean; shownMm?: number }
  | null

/** Spec §7.3: a measurement supports a definite verdict only when an advisor verified it on site. */
export function isOnSiteVerified(measurement: Measurement): boolean {
  return measurement.confidence === 'advisor-verified' && measurement.verificationMethod === 'on-site'
}

function meets(value: BenchmarkValue, measured: Exclude<Measured, null>): boolean | null {
  // The caller has already made the comparison (a geometric test, or a yes/no fact).
  if ('satisfied' in measured) return measured.satisfied
  if ('value' in measured) return value.comparison === 'allowed-values' ? (value.allowed ?? []).includes(measured.value) : null
  const measurements = Array.isArray(measured) ? measured : [measured]
  if (!measurements.length) return null
  return measurements.every((measurement) => {
    const mm = measurement.valueMm
    if (value.comparison === 'min') return mm >= value.minMm!
    if (value.comparison === 'max') return mm <= value.maxMm!
    if (value.comparison === 'range') return mm >= value.minMm! && mm <= value.maxMm!
    return false
  })
}

function inputIsDefinite(measured: Exclude<Measured, null>): boolean {
  if ('definiteInput' in measured) return measured.definiteInput
  const measurements = Array.isArray(measured) ? measured : [measured]
  return measurements.length > 0 && measurements.every(isOnSiteVerified)
}

function verdictFor(key: BenchmarkKey, benchmarkId: BenchmarkId, value: BenchmarkValue | null, measured: Measured): BenchmarkVerdict {
  const base = { benchmarkId, key, pendingReview: value?.review.status === 'pending' && hasValue(value) }
  const shown = measured === null ? {}
    : 'value' in measured ? { measuredValue: measured.value }
      : 'satisfied' in measured ? (measured.shownMm !== undefined ? { measuredMm: measured.shownMm } : {})
        : Array.isArray(measured) ? (measured.length === 1 ? { measuredMm: measured[0].valueMm } : {})
          : { measuredMm: measured.valueMm }
  if (!hasValue(value)) return { ...base, ...shown, outcome: 'no-value', pendingReview: false }
  if (measured === null) return { ...base, outcome: 'not-evaluated' }
  const satisfied = meets(value, measured)
  if (satisfied === null) return { ...base, ...shown, outcome: 'not-evaluated' }
  // Definite only with on-site verified inputs AND a reviewed benchmark value. Anything else is "likely".
  const definite = inputIsDefinite(measured) && value.review.status === 'reviewed'
  const outcome: VerdictOutcome = satisfied ? (definite ? 'meets' : 'likely-meets') : (definite ? 'does-not-meet' : 'likely-does-not-meet')
  return { ...base, ...shown, outcome }
}

const fails = (outcome: VerdictOutcome) => outcome === 'does-not-meet' || outcome === 'likely-does-not-meet'
const passes = (outcome: VerdictOutcome) => outcome === 'meets' || outcome === 'likely-meets'

/**
 * Overall status from per-benchmark verdicts (spec §7.3). Works for one key or for several keys
 * on one check (e.g. handle height and handle type).
 * - With a primary benchmark, only that benchmark's verdicts count.
 * - Any failure gives `attention`.
 * - Missing data on any key gives `not-evaluated`: a gap must never read as clear.
 * - `clear` needs at least one verdict with a value, and every such verdict passing.
 *   "No benchmark value" is neither a failure nor a pass.
 */
export function statusFromVerdicts(verdicts: BenchmarkVerdict[], primary: BenchmarkId | null): CheckResult['status'] {
  const relevant = primary ? verdicts.filter((verdict) => verdict.benchmarkId === primary) : verdicts
  if (relevant.some((verdict) => fails(verdict.outcome))) return 'attention'
  if (relevant.some((verdict) => verdict.outcome === 'not-evaluated')) return 'not-evaluated'
  const withValue = relevant.filter((verdict) => verdict.outcome !== 'no-value')
  return withValue.length > 0 && withValue.every((verdict) => passes(verdict.outcome)) ? 'clear' : 'not-evaluated'
}

export function evaluateVerdict(input: {
  key: BenchmarkKey
  measured: Measured
  context: BenchmarkContext
  primary: BenchmarkId | null
  dataset?: BenchmarkDataset
}): { verdicts: BenchmarkVerdict[]; status: CheckResult['status'] } {
  const values = getBenchmarkValues(input.key, input.context, input.dataset ?? BENCHMARKS)
  const verdicts = BENCHMARK_IDS.map((benchmarkId) => verdictFor(input.key, benchmarkId, values[benchmarkId], input.measured))
  return { verdicts, status: statusFromVerdicts(verdicts, input.primary) }
}

/** A verdict the user should take to a professional: a likely failure, or anything resting on an unreviewed value. */
export function needsProfessionalCheck(verdict: BenchmarkVerdict): boolean {
  return verdict.outcome === 'likely-does-not-meet' || (verdict.pendingReview && verdict.outcome !== 'no-value' && verdict.outcome !== 'not-evaluated')
}
