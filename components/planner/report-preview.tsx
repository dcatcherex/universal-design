'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createPlanSvg } from '@/lib/planner/exports/plan-svg'
import { formatBahtAmount } from '@/lib/planner/recommendations'
import { t, type MessageKey } from '@/lib/planner/i18n'
import type { ReportData, ReportPlan } from '@/lib/planner/exports/report-data'
import { getPrimaryRoom } from '@/lib/planner/layout-access'
import { getBenchmarkValues, hasValue } from '@/lib/planner/standards/benchmarks'
import type { Locale } from '@/lib/planner/types'
import { BENCHMARK_NAME, benchmarkValueText, outcomeLabel } from './benchmark-verdicts'

const ORIGINS = { geometry: 'originGeometry', 'project-target': 'originProjectTarget', 'custom-overlay': 'originCustomOverlay', manual: 'originManual', benchmark: 'originBenchmark', resident: 'originResident' } as const

function svgDataUrl(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
function baht(value: number, locale: Locale) { return locale === 'th' ? `${formatBahtAmount(value, locale)} บาท` : `THB ${formatBahtAmount(value, locale)}` }
function confidence(locale: Locale, value: string) {
  return t(locale, value === 'advisor-verified' ? 'confidenceVerified' : value === 'measured' ? 'confidenceMeasured' : 'confidenceEstimated')
}

function PlanSection({ plan, locale, mobilityAids }: { plan: ReportPlan; locale: Locale; mobilityAids: string[] }) {
  if (!plan.layout) return <section className="report-plan"><h2>{plan.label}</h2><p>{t(locale, 'reportNoProposal')}</p></section>
  const room = getPrimaryRoom(plan.layout)
  const svg = createPlanSvg(plan.layout, { locale, layoutLabel: plan.label, showOverlays: true })
  const context = { roomType: room.type, mobilityAids }
  const verdictRows = plan.checks.flatMap((check) => check.verdicts.map((verdict) => ({ check, verdict })))
  return <section className="report-plan">
    <h2>{plan.label}</h2>
    <p>{t(locale, 'roomType')}: {t(locale, room.type === 'bathroom' ? 'roomBathroom' : 'roomLiving')}</p>
    <p>{t(locale, 'reportRoomDimensions')}: {room.shape.width.valueMm} × {room.shape.depth.valueMm} × {room.height.valueMm} mm · {confidence(locale, room.shape.width.confidence)} / {confidence(locale, room.shape.depth.confidence)} / {confidence(locale, room.height.confidence)}</p>
    <Image unoptimized width={1200} height={1000} className="report-plan-image" src={svgDataUrl(svg)} alt={`${plan.label}, ${(room.shape.width.valueMm / 1000).toFixed(2)} × ${(room.shape.depth.valueMm / 1000).toFixed(2)} m`} />
    {room.fixtures.length > 0 && <><h3>{t(locale, 'fixtures')}</h3><ul className="report-fixtures">{room.fixtures.map((fixture) => <li key={fixture.id}>{fixture.label} · {t(locale, fixture.wall === 'north' ? 'wallNorth' : fixture.wall === 'south' ? 'wallSouth' : fixture.wall === 'east' ? 'wallEast' : 'wallWest')} · {fixture.referenceHeight.valueMm} mm · {confidence(locale, fixture.referenceHeight.confidence)}</li>)}</ul></>}
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
      <p>{t(locale, 'checkOrigin')}: {t(locale, ORIGINS[check.evidence.origin])} · {t(locale, 'confidence')}: {confidence(locale, check.evidence.confidence)}</p>
      <p>{t(locale, 'checkLimitation')}: {t(locale, check.evidence.limitationKey as MessageKey)}</p>
    </li>)}</ul> : <p>{t(locale, 'reportNoChecks')}</p>}
  </section>
}
export function ReportPreview({ data, locale, pngUrl, onClose, onToggleFallHistory }: { data: ReportData; locale: Locale; pngUrl: string | null; onClose(): void; onToggleFallHistory?(include: boolean): void }) {
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
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="report-dialog" showCloseButton={false}>
      <DialogHeader className="report-dialog-header"><div><DialogTitle>{t(locale, 'reportTitle')}</DialogTitle><DialogDescription>{t(locale, 'reportDescription')}</DialogDescription></div>
        <div className="report-actions"><Button type="button" onClick={print}>{t(locale, 'reportPrint')}</Button><DialogClose render={<Button type="button" variant="outline" />}>{t(locale, 'reportClose')}</DialogClose></div>
      </DialogHeader>
      {printError && <p role="alert">{t(locale, 'exportFailed')}</p>}
      <div className="report-document" ref={reportRef} role="region" aria-label={t(locale, 'reportTitle')} tabIndex={0}>
        <header className="report-cover"><p>{t(locale, 'brand')}</p><h1>{data.title}</h1><p>{data.province && `${t(locale, 'province')}: ${data.province} · `}{t(locale, 'reportRevision')} {data.projectRevision}</p></header>
        <section className="report-brief"><h2>{t(locale, 'reportBrief')}</h2>
          <p>{t(locale, 'activities')}: {data.brief.activities.join(', ') || '—'}</p><p>{t(locale, 'mobilityAids')}: {data.brief.mobilityAids.join(', ') || '—'}</p><p>{t(locale, 'concerns')}: {data.brief.concerns.join(', ') || '—'}</p>
          <p>{t(locale, 'assistanceNotes')}: {data.brief.assistanceNotes || '—'}</p><p>{t(locale, 'residentPreferences')}: {data.brief.residentPreferences || '—'}</p><p>{t(locale, 'budget')}: {data.budgetSatang === null ? t(locale, 'budgetUnknown') : baht(data.budgetSatang, locale)}</p>
        </section>
        <section className="report-resident"><h2>{t(locale, 'reportResidentNeeds')}</h2>
          <p>{t(locale, 'standingHeightCm')}: {data.residentNeeds.standingHeight ? data.residentNeeds.standingHeight.valueMm / 10 : '—'}</p>
          <p>{t(locale, 'reachBand')}: {data.residentNeeds.reach ? `–  · ` : '—'}</p>
          <p>{t(locale, 'wheelchairSize')}: {data.residentNeeds.wheelchair ? ` ×  ` : '—'}</p>
          {onToggleFallHistory && <label className="choice report-fall-toggle"><input type="checkbox" checked={data.falls !== null} onChange={(event) => onToggleFallHistory(event.target.checked)} />{t(locale, 'includeFallHistory')}</label>}
          {data.falls !== null ? (data.falls.length ? <ul className="report-falls">{data.falls.map((fall, index) => <li key={fall.id}>{t(locale, 'fallMarker')} {index + 1} · {t(locale, fall.when === 'within-3-months' ? 'fallWithin3' : 'fall3to12')}{fall.note ? ` · ` : ''}</li>)}</ul> : <p>{t(locale, 'fallsNone')}</p>) : <p className="report-image-note">{t(locale, 'fallHistoryOmitted')}</p>}
        </section>
        <section className="report-benchmarks"><h2>{t(locale, 'benchmarkData')} {data.benchmarks.datasetVersion}</h2>
          {data.benchmarks.sources.map((source) => <p key={source.id}><strong>{t(locale, BENCHMARK_NAME[source.benchmarkId])}</strong> — {source.title} ({source.edition}). {source.applicability[locale]}</p>)}
          <p>{t(locale, 'primaryBenchmark')}: {data.benchmarks.primary ? ` · ` : t(locale, 'primaryBenchmarkNone')}</p>
        </section>
        <PlanSection plan={data.plans.current} locale={locale} mobilityAids={data.brief.mobilityAids} />
        <PlanSection plan={data.plans.proposed} locale={locale} mobilityAids={data.brief.mobilityAids} />
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
        {pngUrl ? <section className="report-3d"><h2>{t(locale, 'view3d')}</h2><Image unoptimized width={1200} height={900} src={pngUrl} alt={locale === 'th' ? 'ภาพมุมมองสามมิติของห้อง' : 'Three-dimensional room view'} /></section> : <p className="report-image-note">{t(locale, 'reportNoImage')}</p>}
        <footer className="report-limitations"><p className="report-disclaimer">{data.disclaimer}</p><p>{t(locale, 'checksTitle')}: {t(locale, 'checksDisclaimer')}</p><p>{t(locale, 'checkLimitGeneral')}</p></footer>
      </div>
    </DialogContent>
  </Dialog>
}
