import { Button } from '@/components/ui/button'
import type { CheckSummary } from '@/lib/planner/checks'
import { t } from '@/lib/planner/i18n'
import type { Locale } from '@/lib/planner/types'

export type CheckSummaryFilter = 'all' | 'attention' | 'likelyAttention' | 'notEvaluated' | 'clear' | 'nearFall'

type SummaryEntry = { filter: CheckSummaryFilter; icon: string; label: string; count: number }

export function CheckSummaryCounts({ summary, locale, filter, onFilter }: {
  summary: CheckSummary
  locale: Locale
  filter?: CheckSummaryFilter
  onFilter?: (filter: CheckSummaryFilter) => void
}) {
  const entries: SummaryEntry[] = [
    { filter: 'all', icon: 'Σ', label: t(locale, 'checkSummaryAll'), count: summary.total },
    { filter: 'attention', icon: '!', label: t(locale, 'checkAttention'), count: summary.attention },
    { filter: 'likelyAttention', icon: '~', label: t(locale, 'checkSummaryLikely'), count: summary.likelyAttention },
    { filter: 'notEvaluated', icon: '?', label: t(locale, 'checkNotEvaluated'), count: summary.notEvaluated },
    { filter: 'clear', icon: '✓', label: t(locale, 'checkSummaryClear'), count: summary.clear },
    { filter: 'nearFall', icon: '△', label: t(locale, 'nearFall'), count: summary.nearFall },
  ]
  const content = entries.map((entry) => onFilter
    ? <Button key={entry.filter} type="button" variant={filter === entry.filter ? 'secondary' : 'outline'} aria-pressed={filter === entry.filter} data-check-filter={entry.filter} data-count={entry.count} onClick={() => onFilter(entry.filter)}>
        <span aria-hidden="true">{entry.icon}</span> {entry.label}: {entry.count}
      </Button>
    : <span key={entry.filter} className={`check-count check-count-${entry.filter}`} data-check-filter={entry.filter} data-count={entry.count}>
        <span aria-hidden="true">{entry.icon}</span> {entry.label}: {entry.count}
      </span>)
  return <div className="checks-counts" aria-label={t(locale, 'checkSummaryLabel')} data-total={summary.total}>
    {onFilter ? <div className="checks-count-controls" role="group" aria-label={t(locale, 'checkSummaryFilters')}>{content}</div> : content}
  </div>
}

export function CheckAttentionComparison({ current, proposed, locale }: { current: CheckSummary; proposed: CheckSummary; locale: Locale }) {
  return <div className="check-before-after" data-current-attention-count={current.attention} data-proposed-attention-count={proposed.attention} aria-label={`${t(locale, 'current')}: ${current.attention} ${t(locale, 'checkAttention')}; ${t(locale, 'proposed')}: ${proposed.attention} ${t(locale, 'checkAttention')}`}>
    <span>{t(locale, 'current')}: <strong>{current.attention}</strong> {t(locale, 'checkAttention')}</span>
    <span aria-hidden="true">→</span>
    <span>{t(locale, 'proposed')}: <strong>{proposed.attention}</strong> {t(locale, 'checkAttention')}</span>
  </div>
}
