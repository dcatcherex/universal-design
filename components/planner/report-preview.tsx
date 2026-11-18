'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createPlanSvg } from '@/lib/planner/exports/plan-svg'
import { checkViewFromResults, compareCheckResults, summarizeChecks } from '@/lib/planner/checks'
import { PlanSchedule } from './plan-schedule'
import { formatBahtAmount } from '@/lib/planner/recommendations'
import { EFFORT_LABEL_KEYS, EFFORT_TIERS, getActionPriceText, getActionReferenceText, getActionText } from '@/lib/planner/action-list'
import { confidenceLabel, t, type MessageKey } from '@/lib/planner/i18n'
import { NEED_LABEL_KEYS } from '@/lib/planner/resident-needs'
import type { ReportData, ReportPlan } from '@/lib/planner/exports/report-data'
import { getPrimaryFloor, getPrimaryRoom } from '@/lib/planner/layout-access'
import { getBenchmarkValues, hasValue } from '@/lib/planner/standards/benchmarks'
import type { CheckResult, Locale } from '@/lib/planner/types'
import { BENCHMARK_NAME, benchmarkValueText, outcomeLabel } from './benchmark-verdicts'
import { CheckAttentionComparison, CheckSummaryCounts } from './check-summary'

const ORIGINS = { geometry: 'originGeometry', 'project-target': 'originProjectTarget', 'custom-overlay': 'originCustomOverlay', manual: 'originManual', benchmark: 'originBenchmark', resident: 'originResident' } as const

function svgDataUrl(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
function baht(value: number, locale: Locale) { const unit = t(locale, 'unitBaht'); return locale === 'th' ? `${formatBahtAmount(value, locale)} ${unit}` : `${unit} ${formatBahtAmount(value, locale)}` }

function entityLabels(plan: ReportPlan, result: CheckResult, locale: Locale): string[] {
  if (!plan.layout) return []
  const room = getPrimaryRoom(plan.layout)
  const floor = getPrimaryFloor(plan.layout)
  return result.entityIds.map((id) => {
    const item = room.items.find((candidate) => candidate.id === id)
    if (item) return item.label
    const fixture = room.fixtures.find((candidate) => candidate.id === id)
    if (fixture) return fixture.label
    const opening = room.openings.find((candidate) => candidate.id === id)
    if (opening) return t(locale, opening.kind)
    return room.wetZones.find((candidate) => candidate.id === id)?.label
      ?? floor.routes.find((candidate) => candidate.id === id)?.label
      ?? floor.turningAreas.find((candidate) => candidate.id === id)?.label
      ?? id
  })
}

function PlanSection({ plan, locale, showDimensions, showCheckMarks, selectedItemId }: { plan: ReportPlan; locale: Locale; showDimensions: boolean; showCheckMarks: boolean; selectedItemId: string | null }) {
  if (!plan.layout) return <section className="report-plan"><h2>{plan.label}</h2><p>{t(locale, 'reportNoProposal')}</p></section>
  const room = getPrimaryRoom(plan.layout)
  const checkView = checkViewFromResults(plan.checks)
  const svg = createPlanSvg(plan.layout, { locale, layoutLabel: plan.label, showOverlays: true, showDimensions, showCheckMarks, checkView, selectedItemId })
  const context = plan.context
  const verdictRows = plan.checks.flatMap((check) => check.verdicts.map((verdict) => ({ check, verdict })))
  return <section className="report-plan">
    <h2>{plan.label}</h2>
    <p>{t(locale, 'roomType')}: {t(locale, room.type === 'bathroom' ? 'roomBathroom' : 'roomLiving')}</p>
    <p>{t(locale, 'reportRoomDimensions')}: {room.shape.width.valueMm} × {room.shape.depth.valueMm} × {room.height.valueMm} mm · {confidenceLabel(locale, room.shape.width.confidence)} / {confidenceLabel(locale, room.shape.depth.confidence)} / {confidenceLabel(locale, room.height.confidence)}</p>
    <Image unoptimized width={1200} height={1000} className="report-plan-image" src={svgDataUrl(svg)} alt={`${plan.label}, ${(room.shape.width.valueMm / 1000).toFixed(2)} × ${(room.shape.depth.valueMm / 1000).toFixed(2)} m`} />
    {showCheckMarks && <div className="check-mark-legend" role="img" aria-label={`${t(locale, 'checkMarkerLegendAttention')}; ${t(locale, 'checkMarkerLegendNotEvaluated')}`}><span><i className="report-check-mark-symbol report-check-mark-attention">!</i>{t(locale, 'checkMarkerLegendAttention')}</span><span><i className="report-check-mark-symbol report-check-mark-not-evaluated">?</i>{t(locale, 'checkMarkerLegendNotEvaluated')}</span></div>}
    <PlanSchedule room={room} locale={locale} selectionId={selectedItemId} />
    {verdictRows.length > 0 && <><h3>{t(locale, 'benchmarkComparison')}</h3>
      <table className="report-verdicts">
        <thead><tr><th scope="col">{t(locale, 'reportCheck')}</th><th scope="col">{t(locale, 'reportBenchmark')}</th><th scope="col">{t(locale, 'reportClauseValue')}</th><th scope="col">{t(locale, 'recordedValue')}</th><th scope="col">{t(locale, 'checkStatus')}</th></tr></thead>
        <tbody>{verdictRows.map(({ check, verdict }) => {
          const value = getBenchmarkValues(verdict.key, context)[verdict.benchmarkId]
          const definite = verdict.outcome === 'meets' || verdict.outcome === 'does-not-meet'
          return <tr key={`${check.id}-${verdict.key}-${verdict.benchmarkId}`}>
            <td>{check.ruleId} · {t(locale, `bk.${verdict.key}` as MessageKey)}{check.nearFall ? ` · ▲ ${t(locale, 'nearFall')}` : ''}</td>
            <td>{t(locale, BENCHMARK_NAME[verdict.benchmarkId])}</td>
            <td>{hasValue(value) ? `${value.clause} · ${benchmarkValueText(locale, value)}${verdict.pendingReview ? ` · ${t(locale, 'benchmarkPending')}` : ''}` : value?.notApplicableReason?.[locale] ?? '—'}</td>
            <td>{verdict.measuredMm !== undefined ? `${verdict.measuredMm} mm` : verdict.measuredValue ?? '—'}</td>
            <td>{outcomeLabel(locale, verdict.outcome)}{verdict.outcome === 'no-value' || verdict.outcome === 'not-evaluated' ? '' : ` · ${t(locale, definite ? 'verdictDefinite' : 'verdictLikely')}`}</td>
          </tr>
        })}</tbody>
      </table></>}
    <h3>{t(locale, 'reportChecks')}</h3>
    {plan.checks.length ? <ul className="report-check-list">{plan.checks.map((check) => <li key={check.id}>
      <strong>{check.ruleId} · {t(locale, check.status === 'attention' ? 'checkAttention' : check.status === 'clear' ? 'checkClear' : 'checkNotEvaluated')}</strong>
      <p>{t(locale, check.messageKey as MessageKey)}</p>
      <p>{t(locale, 'checkOrigin')}: {t(locale, ORIGINS[check.evidence.origin])} · {t(locale, 'confidence')}: {confidenceLabel(locale, check.evidence.confidence)}</p>
      <p>{t(locale, 'checkLimitation')}: {t(locale, check.evidence.limitationKey as MessageKey)}</p>
    </li>)}</ul> : <p>{t(locale, 'reportNoChecks')}</p>}
  </section>
}
export function ReportPreview({ data, locale, pngUrl, showDimensions, showCheckMarks, selectedItemId, onClose, onToggleFallHistory }: { data: ReportData; locale: Locale; pngUrl: string | null; showDimensions: boolean; showCheckMarks: boolean; selectedItemId: string | null; onClose(): void; onToggleFallHistory?(include: boolean): void }) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [printError, setPrintError] = useState(false)
  async function print() {
    setPrintError(false)
    const popup = reportRef.current?.closest<HTMLElement>('[data-slot="dialog-content"]')
    const styled = [popup, document.documentElement, document.body].filter((element): element is HTMLElement => Boolean(element))
    const previous = styled.map((element) => element.getAttribute('style'))
    const restore = () => styled.forEach((element, index) => {
      const style = previous[index]
      if (style === null || style === undefined) element.removeAttribute('style')
      else element.setAttribute('style', style)
    })
    try {
      await document.fonts?.ready
      const images = Array.from(reportRef.current?.querySelectorAll('img') ?? [])
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
      if (popup) {
        popup.style.setProperty('position', 'static', 'important')
        popup.style.setProperty('translate', 'none', 'important')
        popup.style.setProperty('transform', 'none', 'important')
        popup.style.setProperty('width', '186mm', 'important')
        popup.style.setProperty('min-width', '0', 'important')
        popup.style.setProperty('max-width', '186mm', 'important')
        popup.style.setProperty('max-height', 'none', 'important')
        popup.style.setProperty('height', 'auto', 'important')
        popup.style.setProperty('display', 'block', 'important')
        popup.style.setProperty('overflow', 'visible', 'important')
        popup.style.setProperty('margin', '0', 'important')
        popup.style.setProperty('padding', '0', 'important')
      }
      for (const element of styled.slice(1)) {
        element.style.setProperty('width', '186mm', 'important')
        element.style.setProperty('min-width', '0', 'important')
        element.style.setProperty('height', 'auto', 'important')
        element.style.setProperty('overflow', 'visible', 'important')
      }
      window.addEventListener('afterprint', restore, { once: true })
      window.print()
    } catch {
      restore()
      setPrintError(true)
    }
  }
  const reviewStatus = data.review.status === 'reviewed' ? 'reviewCurrent' : data.review.status === 'outdated' ? 'reviewOutdated' : 'reviewNotReviewed'
  const currentSummary = summarizeChecks(data.plans.current.checks)
  const proposedSummary = summarizeChecks(data.plans.proposed.checks)
  const statusChanges = data.plans.proposed.layout ? compareCheckResults(data.plans.current.checks, data.plans.proposed.checks) : []
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="report-dialog" showCloseButton={false}>
      <DialogHeader className="report-dialog-header"><div><DialogTitle>{t(locale, 'reportTitle')}</DialogTitle><DialogDescription>{t(locale, 'reportDescription')}</DialogDescription></div>
        <div className="report-actions"><Button type="button" onClick={print}>{t(locale, 'reportPrint')}</Button><DialogClose render={<Button type="button" variant="outline" />}>{t(locale, 'reportClose')}</DialogClose></div>
      </DialogHeader>
      {printError && <p role="alert">{t(locale, 'exportFailed')}</p>}
      <div className="report-document" ref={reportRef} role="region" aria-label={t(locale, 'reportTitle')} tabIndex={0}>
        <div className="report-cover"><p>{t(locale, 'brand')}</p><h1>{data.title}</h1><p>{data.province && `${t(locale, 'province')}: ${data.province} · `}{t(locale, 'reportRevision')} {data.projectRevision}</p></div>
        <section className="report-brief"><h2>{t(locale, 'reportBrief')}</h2>
          <p>{t(locale, 'activities')}: {data.brief.activities.join(', ') || '—'}</p><p>{t(locale, 'mobilityAids')}: {data.brief.mobilityAids.join(', ') || '—'}</p><p>{t(locale, 'concerns')}: {data.brief.concerns.join(', ') || '—'}</p>
          <p>{t(locale, 'assistanceNotes')}: {data.brief.assistanceNotes || '—'}</p><p>{t(locale, 'residentPreferences')}: {data.brief.residentPreferences || '—'}</p><p>{t(locale, 'budget')}: {data.budgetSatang === null ? t(locale, 'budgetUnknown') : baht(data.budgetSatang, locale)}</p>
        </section>
        <section className="report-resident"><h2>{t(locale, 'reportResidentNeeds')}</h2>
          <p>{t(locale, 'reportSelectedNeeds')}: {data.residentNeeds.needs?.length ? data.residentNeeds.needs.map((need) => t(locale, NEED_LABEL_KEYS[need])).join(', ') : '—'}</p>
          <p>{t(locale, 'standingHeightCm')}: {data.residentNeeds.standingHeight ? data.residentNeeds.standingHeight.valueMm / 10 : '—'}</p>
          <p>{t(locale, 'reachBand')}: {data.residentNeeds.reach ? `${data.residentNeeds.reach.low.valueMm / 10}–${data.residentNeeds.reach.high.valueMm / 10} ${t(locale, 'unitCm')} · ${t(locale, data.residentNeeds.reach.posture === 'seated' ? 'postureSeated' : 'postureStanding')}` : '—'}</p>
          <p>{t(locale, 'wheelchairSize')}: {data.residentNeeds.wheelchair ? `${data.residentNeeds.wheelchair.width.valueMm / 10} × ${data.residentNeeds.wheelchair.length.valueMm / 10} ${t(locale, 'unitCm')}` : '—'}</p>
          {onToggleFallHistory && <label className="choice report-fall-toggle"><input type="checkbox" checked={data.falls !== null} onChange={(event) => onToggleFallHistory(event.target.checked)} />{t(locale, 'includeFallHistory')}</label>}
          {data.falls !== null ? (data.falls.length ? <ul className="report-falls">{data.falls.map((fall, index) => <li key={fall.id}>{t(locale, 'fallMarker')} {index + 1} · {t(locale, fall.when === 'within-3-months' ? 'fallWithin3' : 'fall3to12')}{fall.note ? ` · ${fall.note}` : ''}</li>)}</ul> : <p>{t(locale, 'fallsNone')}</p>) : <p className="report-image-note">{t(locale, 'fallHistoryOmitted')}</p>}
        </section>
        <section className="report-benchmarks"><h2>{t(locale, 'benchmarkData')} {data.benchmarks.datasetVersion}</h2>
          {data.benchmarks.sources.map((source) => <p key={source.id}><strong>{t(locale, BENCHMARK_NAME[source.benchmarkId])}</strong> — {source.title} ({source.edition}). {source.applicability[locale]}</p>)}
          <p>{t(locale, 'primaryBenchmark')}: {data.benchmarks.primary ? `${t(locale, BENCHMARK_NAME[data.benchmarks.primary.primary])} · ${data.benchmarks.primary.chosenBy}` : t(locale, 'primaryBenchmarkNone')}</p>
        </section>
        <section className="report-walkthrough">
          <h2>{t(locale, 'walkthroughTitle')}</h2>
          <p>{t(locale, 'walkthroughDatasetVersion')}: {data.walkthrough.datasetVersion}</p>
          {data.walkthrough.pendingReview && <p className="walkthrough-pending">{t(locale, 'walkthroughPending')}</p>}
          <p>{t(locale, 'walkthroughSummary')
            .replace('{hazards}', String(data.walkthrough.summary.hazards))
            .replace('{checked}', String(data.walkthrough.summary.getChecked))
            .replace('{unanswered}', String(data.walkthrough.summary.notAnswered))}</p>
          {data.walkthrough.entries.length ? <ul>{data.walkthrough.entries.map((entry) => {
            const outcomeKey = entry.outcome === 'hazard' ? 'walkthroughHazard'
              : entry.outcome === 'get-checked' ? 'walkthroughGetChecked'
                : entry.outcome === 'clear' ? 'walkthroughClear'
                  : entry.outcome === 'not-applicable' ? 'walkthroughNotApplicableOutcome' : 'walkthroughNotAnswered'
            const source = data.walkthrough.sources.find((item) => item.id === entry.question.sourceId)
            return <li key={entry.question.id} data-walkthrough-outcome={entry.outcome}>
              <strong>{entry.question.text[locale]}</strong>
              <p>{entry.question.why[locale]}</p>
              <p>{t(locale, outcomeKey)}</p>
              {(entry.outcome === 'hazard' || entry.outcome === 'get-checked') && <p>{entry.question.advice[locale]}</p>}
              {entry.answer?.note && <p>{entry.answer.note}</p>}
              {source && <p>{t(locale, 'walkthroughSource')}: {source.title} — {entry.question.sourceRef}</p>}
            </li>
          })}</ul> : <p>{t(locale, 'walkthroughNoQuestions')}</p>}
        </section>
        <section className="report-action-list" data-testid="report-action-list" aria-labelledby="report-action-list-title">
          <h2 id="report-action-list-title">{t(locale, 'actionListReportHeading')}</h2>
          <p>{t(locale, 'actionListIntro')}</p>
          {EFFORT_TIERS.map((tier) => <section className={`report-action-tier report-action-tier-${tier}`} key={tier}>
            <h3>{t(locale, EFFORT_LABEL_KEYS[tier])}</h3>
            {tier === 'building-work' && <p>{t(locale, 'actionBuildingWorkNote')}</p>}
            {data.actionGroups[tier].length
              ? <ul>{data.actionGroups[tier].map((item) => <li key={item.id} data-action-id={item.id} data-action-tier={tier} data-action-kind={item.kind}>
                <strong>{getActionText(item, locale)}</strong>
                <p>{getActionReferenceText(item, locale)}</p>
                {item.nearFall && <p>{t(locale, 'nearFall')}</p>}
                <p>{getActionPriceText(item, locale)}</p>
              </li>)}</ul>
              : <p>{t(locale, 'actionListNoItems')}</p>}
          </section>)}
        </section>
        <section className="report-check-comparison" data-testid="report-check-comparison">
          <h2>{t(locale, 'reportChecks')}</h2>
          {data.plans.proposed.layout
            ? <CheckAttentionComparison current={currentSummary} proposed={proposedSummary} locale={locale} />
            : <CheckSummaryCounts summary={currentSummary} locale={locale} />}
          {data.plans.proposed.layout && (statusChanges.length
            ? <><h3>{t(locale, 'checkSummaryChanges')}</h3><ul className="report-check-changes">{statusChanges.map((change) => {
              const beforeKey = change.before.status === 'attention' ? 'checkAttention' : change.before.status === 'clear' ? 'checkClear' : 'checkNotEvaluated'
              const afterKey = change.after.status === 'attention' ? 'checkAttention' : change.after.status === 'clear' ? 'checkClear' : 'checkNotEvaluated'
              const labels = entityLabels(data.plans.current, change.before, locale)
              return <li key={`${change.ruleId}:${change.entityIds.join('|')}`} data-rule-id={change.ruleId} data-check-before={change.before.status} data-check-after={change.after.status}>
                <strong>{change.ruleId}{labels.length ? ` · ${labels.join(', ')}` : ''}</strong>
                <p>{t(locale, beforeKey)} → {t(locale, afterKey)}</p>
                <p>{t(locale, change.before.messageKey as MessageKey)} → {t(locale, change.after.messageKey as MessageKey)}</p>
              </li>
            })}</ul></>
            : <p>{t(locale, 'checkSummaryNoChanges')}</p>)}
        </section>
        <PlanSection plan={data.plans.current} locale={locale} showDimensions={showDimensions} showCheckMarks={showCheckMarks} selectedItemId={selectedItemId} />
        <PlanSection plan={data.plans.proposed} locale={locale} showDimensions={showDimensions} showCheckMarks={showCheckMarks} selectedItemId={selectedItemId} />
        <section className="report-recommendations"><h2>{t(locale, 'recommendations')}</h2>
          {data.recommendations.length ? <ul>{data.recommendations.map((recommendation) => <li key={recommendation.id}><h3>{recommendation.title}</h3><p>{recommendation.reason}</p><p>{recommendation.action}</p><p>{t(locale, 'recommendationStatus')}: {t(locale, `status${recommendation.status[0].toUpperCase()}${recommendation.status.slice(1)}` as 'statusProposed' | 'statusAccepted' | 'statusDeferred' | 'statusCompleted')} · {t(locale, recommendation.layoutId)}</p>{recommendation.advisorNote && <p>{t(locale, 'recommendationAdvisorNote')}: {recommendation.advisorNote}</p>}
            <p>{t(locale, 'costEstimateMaterials')}: {recommendation.materials ? `${baht(recommendation.materials.lowSatang, locale)}–${baht(recommendation.materials.highSatang, locale)} · ${recommendation.materials.sourceNote} · ${recommendation.materials.estimatedAt.slice(0, 10)}` : t(locale, 'unknownCost')}</p>
            <p>{t(locale, 'costEstimateLabour')}: {recommendation.labour ? `${baht(recommendation.labour.lowSatang, locale)}–${baht(recommendation.labour.highSatang, locale)} · ${recommendation.labour.sourceNote} · ${recommendation.labour.estimatedAt.slice(0, 10)}` : t(locale, 'unknownCost')}</p>
          </li>)}</ul> : <p>{t(locale, 'recommendationsEmpty')}</p>}
        </section>
        <section className="report-costs"><h2>{t(locale, 'reportCosts')}</h2>
          <p>{t(locale, 'knownSubtotal')}: {data.costs.includedCount ? `${baht(data.costs.lowSatang, locale)}–${baht(data.costs.highSatang, locale)}` : t(locale, 'noCostComponents')}</p>
          <p>{t(locale, 'includedRecommendationCount')}: {data.costs.includedCount} · {t(locale, 'missingCostComponents')}: {data.costs.missingComponents}</p>
          {data.costs.missingComponents > 0 && data.budgetSatang !== null && <p>{t(locale, 'budgetProvisional')}</p>}
        </section>
        <section className="report-review"><h2>{t(locale, 'reportReview')}</h2><p>{t(locale, reviewStatus)}</p>
          {data.review.receipt && <><p>{t(locale, 'reviewName')}: {data.review.receipt.reviewerName}</p><p>{t(locale, 'reviewRevision')}: {data.review.receipt.projectRevision}</p><p>{t(locale, 'reviewDate')}: {new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium' }).format(new Date(data.review.receipt.reviewedAt))}</p></>}
          <p>{t(locale, 'reviewIdentityNote')}</p>
        </section>
        {pngUrl ? <section className="report-3d"><h2>{t(locale, 'view3d')}</h2><Image unoptimized width={1200} height={900} src={pngUrl} alt={t(locale, 'report3dAlt')} /></section> : <p className="report-image-note">{t(locale, 'reportNoImage')}</p>}
        <div className="report-limitations"><p className="report-disclaimer">{data.disclaimer}</p><p>{t(locale, 'checksTitle')}: {t(locale, 'checksDisclaimer')}</p><p>{t(locale, 'checkLimitGeneral')}</p></div>
      </div>
    </DialogContent>
  </Dialog>
}
