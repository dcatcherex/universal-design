'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createPlanSvg } from '@/lib/planner/exports/plan-svg'
import { formatBahtAmount } from '@/lib/planner/recommendations'
import { t, type MessageKey } from '@/lib/planner/i18n'
import type { ReportData, ReportPlan } from '@/lib/planner/exports/report-data'
import type { Locale } from '@/lib/planner/types'

function svgDataUrl(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
function baht(value: number, locale: Locale) { return locale === 'th' ? `${formatBahtAmount(value, locale)} บาท` : `THB ${formatBahtAmount(value, locale)}` }
function confidence(locale: Locale, value: string) {
  return t(locale, value === 'advisor-verified' ? 'confidenceVerified' : value === 'measured' ? 'confidenceMeasured' : 'confidenceEstimated')
}

function PlanSection({ plan, locale }: { plan: ReportPlan; locale: Locale }) {
  if (!plan.layout) return <section className="report-plan"><h2>{plan.label}</h2><p>{t(locale, 'reportNoProposal')}</p></section>
  const svg = createPlanSvg(plan.layout, { locale, layoutLabel: plan.label, showOverlays: true })
  return <section className="report-plan">
    <h2>{plan.label}</h2>
    <p>{t(locale, 'reportRoomDimensions')}: {plan.layout.room.width.valueMm} × {plan.layout.room.depth.valueMm} × {plan.layout.room.height.valueMm} mm · {confidence(locale, plan.layout.room.width.confidence)} / {confidence(locale, plan.layout.room.depth.confidence)} / {confidence(locale, plan.layout.room.height.confidence)}</p>
    <Image unoptimized width={1200} height={1000} className="report-plan-image" src={svgDataUrl(svg)} alt={`${plan.label}, ${(plan.layout.room.width.valueMm / 1000).toFixed(2)} × ${(plan.layout.room.depth.valueMm / 1000).toFixed(2)} m`} />
    <h3>{t(locale, 'reportChecks')}</h3>
    {plan.checks.length ? <ul className="report-check-list">{plan.checks.map((check) => <li key={check.id}>
      <strong>{check.ruleId} · {t(locale, check.status === 'attention' ? 'checkAttention' : check.status === 'clear' ? 'checkClear' : 'checkNotEvaluated')}</strong>
      <p>{t(locale, check.messageKey as MessageKey)}</p>
      <p>{t(locale, 'checkOrigin')}: {t(locale, check.evidence.origin === 'geometry' ? 'originGeometry' : check.evidence.origin === 'project-target' ? 'originProjectTarget' : check.evidence.origin === 'custom-overlay' ? 'originCustomOverlay' : 'originManual')} · {t(locale, 'confidence')}: {confidence(locale, check.evidence.confidence)}</p>
      <p>{t(locale, 'checkLimitation')}: {t(locale, check.evidence.limitationKey as MessageKey)}</p>
    </li>)}</ul> : <p>{t(locale, 'reportNoChecks')}</p>}
  </section>
}

export function ReportPreview({ data, locale, pngUrl, onClose }: { data: ReportData; locale: Locale; pngUrl: string | null; onClose(): void }) {
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
        <PlanSection plan={data.plans.current} locale={locale} />
        <PlanSection plan={data.plans.proposed} locale={locale} />
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
        <footer className="report-limitations"><p>{t(locale, 'checksTitle')}: {t(locale, 'checksDisclaimer')}</p><p>{t(locale, 'checkLimitGeneral')}</p></footer>
      </div>
    </DialogContent>
  </Dialog>
}
