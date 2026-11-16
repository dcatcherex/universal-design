'use client'

import { BENCHMARKS, getBenchmarkValues, hasValue, pendingBenchmarkCount, type BenchmarkContext, type BenchmarkValue } from '@/lib/planner/standards/benchmarks'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { formatLength } from '@/lib/planner/units'
import type { BenchmarkId, BenchmarkVerdict, Locale, VerdictOutcome } from '@/lib/planner/types'

export const BENCHMARK_NAME: Record<BenchmarkId, MessageKey> = { 'th-public-building': 'benchmarkPublic', 'th-dop-home': 'benchmarkHome' }
// Outcomes are told apart by icon and wording, never by colour alone.
const OUTCOME: Record<VerdictOutcome, { label: MessageKey; icon: string }> = {
  meets: { label: 'outcomeMeets', icon: '✓' },
  'likely-meets': { label: 'outcomeLikelyMeets', icon: '✓' },
  'does-not-meet': { label: 'outcomeDoesNotMeet', icon: '✕' },
  'likely-does-not-meet': { label: 'outcomeLikelyDoesNotMeet', icon: '✕' },
  'no-value': { label: 'outcomeNoValue', icon: '–' },
  'not-evaluated': { label: 'outcomeNotEvaluated', icon: '?' },
}
const VALUE_WORDS: Record<string, MessageKey> = {
  lever: 'handleLever', knob: 'handleKnob', pull: 'handlePull', none: 'handleNone',
  sliding: 'opSliding', 'hinged-out': 'opHingedOut', 'hinged-in': 'opHingedIn',
  seated: 'toiletSeated', squat: 'toiletSquat',
}

const word = (locale: Locale, value: string) => VALUE_WORDS[value] ? t(locale, VALUE_WORDS[value]) : value
const cm = (locale: Locale, mm: number) => `${formatLength(mm, 'cm', locale)} ${t(locale, 'unitCm')}`

export function outcomeLabel(locale: Locale, outcome: VerdictOutcome): string {
  return t(locale, OUTCOME[outcome].label)
}

/** The benchmark's requirement in words, e.g. "at least 86 cm" or "65–70 cm". */
export function benchmarkValueText(locale: Locale, value: BenchmarkValue): string {
  if (value.comparison === 'min') return `${t(locale, 'atLeast')} ${cm(locale, value.minMm!)}`
  if (value.comparison === 'max') return `${t(locale, 'atMost')} ${cm(locale, value.maxMm!)}`
  if (value.comparison === 'range') return `${formatLength(value.minMm!, 'cm', locale)}–${cm(locale, value.maxMm!)}`
  if (value.comparison === 'allowed-values') return (value.allowed ?? []).map((allowed) => word(locale, allowed)).join(locale === 'th' ? ' หรือ ' : ' or ')
  return t(locale, 'requiredValue')
}

/** One row per benchmark verdict: which benchmark, its clause and value, what was measured, and the outcome. */
export function BenchmarkVerdicts({ verdicts, locale, context }: { verdicts: BenchmarkVerdict[]; locale: Locale; context: BenchmarkContext }) {
  if (!verdicts.length) return null
  return <ul className="verdict-list" aria-label={t(locale, 'benchmarkComparison')}>
    {verdicts.map((verdict) => {
      const value = getBenchmarkValues(verdict.key, context)[verdict.benchmarkId]
      const measured = verdict.measuredMm !== undefined ? cm(locale, verdict.measuredMm) : verdict.measuredValue ? word(locale, verdict.measuredValue) : null
      const outcome = OUTCOME[verdict.outcome]
      return <li key={`${verdict.key}-${verdict.benchmarkId}`} className={`verdict verdict-${verdict.outcome}`} data-testid="verdict" data-benchmark={verdict.benchmarkId} data-key={verdict.key} data-outcome={verdict.outcome}>
        <div className="verdict-head"><span className="verdict-icon" aria-hidden="true">{outcome.icon}</span><strong>{t(locale, outcome.label)}</strong>{verdict.pendingReview && <span className="verdict-pending">{t(locale, 'benchmarkPending')}</span>}</div>
        <p className="verdict-source">{t(locale, BENCHMARK_NAME[verdict.benchmarkId])}</p>
        <p className="verdict-detail">{t(locale, `bk.${verdict.key}` as MessageKey)}{hasValue(value)
          ? <> · {value.clause} · {benchmarkValueText(locale, value)}</>
          : value?.notApplicableReason ? <> · {value.notApplicableReason[locale]}</> : null}{measured && <> · {t(locale, 'recordedValue')}: {measured}</>}</p>
      </li>
    })}
  </ul>
}

/** Tells the user which benchmark data is in use and how much of it is still unreviewed. */
export function BenchmarkBanner({ locale }: { locale: Locale }) {
  const { pending, total } = pendingBenchmarkCount()
  return <p className="benchmark-banner" role="note" data-testid="benchmark-banner">
    <strong>{t(locale, 'benchmarkData')} {BENCHMARKS.datasetVersion}</strong>
    <span>{pending > 0 ? `${pending}/${total} ${t(locale, 'benchmarkPendingCount')}` : t(locale, 'benchmarkAllReviewed')}</span>
  </p>
}
