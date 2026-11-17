'use client'

import type { KeyboardEvent } from 'react'
import type { EntityCheckStatus } from '@/lib/planner/checks'
import { t } from '@/lib/planner/i18n'
import type { Locale } from '@/lib/planner/types'

export function CheckMarkBadge({ status, entityId, entityLabel, locale, x, y, size, onActivate }: {
  status: EntityCheckStatus
  entityId: string
  entityLabel: string
  locale: Locale
  x: number
  y: number
  size: number
  onActivate(resultId: string): void
}) {
  if (status.status === 'clear' || !status.resultIds[0]) return null
  const attention = status.status === 'attention'
  const count = attention ? status.attentionCount : status.notEvaluatedCount
  const summary = t(locale, attention ? 'checkMarkerAttentionSummary' : 'checkMarkerNotEvaluatedSummary')
  const label = `${entityLabel}: ${count} ${summary}`
  const activate = () => onActivate(status.resultIds[0])
  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    activate()
  }

  return <g
    transform={`translate(${x} ${y}) scale(${size / 100})`}
    className={`check-marker-badge check-marker-badge-${status.status}`}
    role="button"
    tabIndex={0}
    aria-label={label}
    data-check-mark={status.status}
    data-check-entity-id={entityId}
    data-result-id={status.resultIds[0]}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => { event.stopPropagation(); activate() }}
    onKeyDown={onKeyDown}
  >
    {attention
      ? <path className="check-marker-badge-shape" d="M50 4 97 91H3Z" />
      : <rect className="check-marker-badge-shape" x="8" y="8" width="84" height="84" rx="18" />}
    <text className="check-marker-badge-symbol" x="50" y={attention ? '69' : '72'} textAnchor="middle" aria-hidden="true">{attention ? '!' : '?'}</text>
    <title>{label}</title>
  </g>
}
