'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { evaluateLayout } from '@/lib/planner/checks'
import { createPlanSvg } from '@/lib/planner/exports/plan-svg'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { getPrimaryRoom } from '@/lib/planner/layout-access'
import { formatBahtAmount } from '@/lib/planner/recommendations'
import { defaultFixEntity, previewFix, type Fix, type FixParams } from '@/lib/planner/standards/fixes'
import { formatLength, parseLength } from '@/lib/planner/units'
import type { CheckResult, CostRange, Locale, Project } from '@/lib/planner/types'
import { BENCHMARK_NAME } from './benchmark-verdicts'

const STATUS: Record<CheckResult['status'], MessageKey> = { attention: 'checkAttention', clear: 'checkClear', 'not-evaluated': 'checkNotEvaluated' }

/** A check keeps its identity across layouts apart from the layout segment, so before and after can be paired. */
const pairKey = (result: CheckResult) => `${result.ruleId}:${result.roomId}:${result.entityIds.join('|')}`

/**
 * Shows what a fix would change before anything is committed: the changed plan, which checks
 * change, the value it aimed for and where that came from, and the cost if one is known.
 */
export function FixPreview({ project, fix, result, locale, onApply, onClose }: {
  project: Project; fix: Fix; result: CheckResult; locale: Locale
  onApply(fixId: string, params: FixParams): void; onClose(): void
}) {
  const entityId = defaultFixEntity(fix, result, project)
  const sourceLayout = project.proposed ?? project.current
  const sourceRoom = getPrimaryRoom(sourceLayout)
  const item = sourceRoom.items.find((candidate) => candidate.id === entityId)
  const needsPosition = fix.effect.kind === 'move-item'
  const [x, setX] = useState(item ? formatLength(item.center.xMm, 'cm', locale) : '')
  const [y, setY] = useState(item ? formatLength(item.center.yMm, 'cm', locale) : '')

  const params = useMemo<FixParams>(() => {
    const base: FixParams = { entityId, ruleId: result.ruleId, locale }
    if (!needsPosition) return base
    const px = parseLength(x, 'cm'), py = parseLength(y, 'cm')
    return px.ok && py.ok ? { ...base, position: { xMm: px.value, yMm: py.value } } : base
  }, [entityId, result.ruleId, locale, needsPosition, x, y])
  const preview = useMemo(() => previewFix(project, fix.id, params, project.updatedAt), [project, fix.id, params])
  const before = useMemo(() => evaluateLayout(project, project.proposed ? 'proposed' : 'current'), [project])

  const changes = preview.ok ? (() => {
    const after = new Map(preview.value.newResults.map((entry) => [pairKey(entry), entry]))
    const earlier = new Map(before.map((entry) => [pairKey(entry), entry]))
    const rows: { key: string; ruleId: string; from: CheckResult['status'] | null; to: CheckResult['status'] | null; message: string }[] = []
    for (const [key, entry] of earlier) {
      const next = after.get(key)
      if (!next) rows.push({ key, ruleId: entry.ruleId, from: entry.status, to: null, message: entry.messageKey })
      else if (next.status !== entry.status || next.messageKey !== entry.messageKey) rows.push({ key, ruleId: entry.ruleId, from: entry.status, to: next.status, message: next.messageKey })
    }
    for (const [key, entry] of after) if (!earlier.has(key)) rows.push({ key, ruleId: entry.ruleId, from: null, to: entry.status, message: entry.messageKey })
    return rows
  })() : []
  const changedNames = preview.ok ? preview.value.changedIds.map((id) => {
    const room = getPrimaryRoom(preview.value.project.proposed!)
    return room.items.find((entry) => entry.id === id)?.label ?? room.fixtures.find((entry) => entry.id === id)?.label
      ?? sourceRoom.items.find((entry) => entry.id === id)?.label
      ?? (room.openings.some((entry) => entry.id === id) ? t(locale, 'door') : id)
  }) : []
  const planSvg = preview.ok ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createPlanSvg(preview.value.project.proposed!, { locale, layoutLabel: t(locale, 'proposed'), showOverlays: true }))}` : null
  const money = (range: CostRange | null) => range ? `${formatBahtAmount(range.lowSatang, locale)}–${formatBahtAmount(range.highSatang, locale)} ${locale === 'th' ? 'บาท' : 'THB'} · ${range.sourceNote}` : t(locale, 'noDefaultPrice')

  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="fix-dialog">
      <DialogHeader><DialogTitle>{t(locale, 'previewFix')}: {fix.label[locale]}</DialogTitle><DialogDescription>{fix.description[locale]}</DialogDescription></DialogHeader>
      <div className="fix-preview" data-testid="fix-preview">
        {!project.proposed && <p className="helper-text">{t(locale, 'fixCreatesProposal')}</p>}
        {needsPosition && <fieldset className="resident-group"><legend>{t(locale, 'fixNewPosition')}</legend><div className="field-grid">
          <label className="field-label">{t(locale, 'pointX')}<input type="text" inputMode="decimal" value={x} onChange={(event) => setX(event.target.value)} /></label>
          <label className="field-label">{t(locale, 'pointY')}<input type="text" inputMode="decimal" value={y} onChange={(event) => setY(event.target.value)} /></label>
        </div></fieldset>}
        {!preview.ok && <p role="alert" className="field-error">{t(locale, preview.error.messageKey as MessageKey)}</p>}
        {preview.ok && <>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL */}
          {planSvg && <img className="fix-plan" src={planSvg} alt={t(locale, 'fixPlanAlt')} />}
          <h3>{t(locale, 'fixChanges')}</h3>
          {changedNames.length ? <ul className="fix-changed">{changedNames.map((name, index) => <li key={index}>{name}</li>)}</ul> : <p className="helper-text">{t(locale, fix.effect.kind === 'note-only' ? 'fixNoteOnly' : 'fixRoomChange')}</p>}
          {preview.value.used && <p className="fix-used">{t(locale, 'fixValueUsed')}: <strong>{formatLength(preview.value.used.valueMm, 'cm', locale)} {t(locale, 'unitCm')}</strong> · {t(locale, BENCHMARK_NAME[preview.value.used.benchmarkId])} {preview.value.used.clause}{preview.value.used.pendingReview ? ` · ${t(locale, 'benchmarkPending')}` : ''}</p>}
          <h3>{t(locale, 'fixChecksAfter')}</h3>
          {changes.length ? <ul className="fix-check-changes">{changes.map((row) => <li key={row.key} data-rule-id={row.ruleId} data-to={row.to ?? 'removed'}>
            <span className="check-rule">{row.ruleId}</span> {row.from ? t(locale, STATUS[row.from]) : '—'} <span aria-hidden="true">→</span><span className="sr-only">{t(locale, 'becomes')}</span> <strong>{row.to ? t(locale, STATUS[row.to]) : t(locale, 'fixCheckGone')}</strong>
            <p>{t(locale, row.message as MessageKey)}</p>
          </li>)}</ul> : <p className="helper-text">{t(locale, 'fixNoCheckChange')}</p>}
          <h3>{t(locale, 'fixCost')}</h3>
          <p>{t(locale, 'costEstimateMaterials')}: {money(preview.value.recommendation.materials)}</p>
          <p>{t(locale, 'costEstimateLabour')}: {money(preview.value.recommendation.labour)}</p>
          {fix.grantCategories.length > 0 && <p>{t(locale, 'grantCategories')}: {fix.grantCategories.map((category) => t(locale, category === 'older-persons-home' ? 'grantOlderPersons' : 'grantDisability')).join(', ')}</p>}
          {fix.needsProfessional && <p className="get-checked"><span aria-hidden="true">☞</span> {t(locale, 'fixNeedsProfessional')}</p>}
        </>}
        <div className="form-actions">
          <Button type="button" className="primary-action" disabled={!preview.ok} onClick={() => onApply(fix.id, params)}>{t(locale, 'applyFix')}</Button>
          <Button type="button" variant="outline" onClick={onClose}>{t(locale, 'recommendationCancel')}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
