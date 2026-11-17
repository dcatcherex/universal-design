'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ActionList } from './action-list'
import { formatBahtAmount, summarizeCosts } from '@/lib/planner/recommendations'
import { t } from '@/lib/planner/i18n'
import type { CheckResult, Locale, Project, Recommendation } from '@/lib/planner/types'
import type { Fix } from '@/lib/planner/standards/fixes'
import { RecommendationEditor } from './recommendation-editor'
import { ReviewPanel } from './review-panel'

export function RecommendationsPanel({ project, locale, advisorMode, draft, onDraftConsumed, onSave, onDelete, onReview, onPreviewFix }: {
  project: Project; locale: Locale; advisorMode: boolean; draft: Recommendation | null; onDraftConsumed(): void
  onSave(recommendation: Recommendation): void; onDelete(id: string): void; onReview(name: string): void
  onPreviewFix(check: CheckResult, fix: Fix): void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const editing = draft ?? project.recommendations.find((recommendation) => recommendation.id === editingId) ?? null
  const summary = summarizeCosts(project.recommendations)
  const budget = project.household.budgetSatang
  const statusLine = budget === null ? t(locale, 'budgetUnknown')
    : summary.includedCount === 0 ? t(locale, 'budgetNoIncludedCosts')
      : summary.missingComponents ? t(locale, 'budgetProvisional')
        : summary.highSatang <= budget ? t(locale, 'budgetUnder')
          : summary.lowSatang > budget ? t(locale, 'budgetOver') : t(locale, 'budgetRangeCrosses')
  function save(recommendation: Recommendation) {
    onSave(recommendation)
    setNotice(t(locale, 'recommendationSaved'))
    if (draft) onDraftConsumed()
    setEditingId(null)
  }
  return <section className="recommendations-panel" aria-labelledby="recommendations-panel-title">
    <header className="recommendations-heading"><h2 id="recommendations-panel-title">{t(locale, 'recommendationsTitle')}</h2></header>
    <div className="cost-summary" aria-label={t(locale, 'costSummary')}>
      <h3>{t(locale, 'costSummary')}</h3>
      {summary.includedCount ? <><p>{t(locale, 'knownSubtotal')}: {locale === 'th' ? `${formatBahtAmount(summary.lowSatang, locale)}–${formatBahtAmount(summary.highSatang, locale)} บาท` : `THB ${formatBahtAmount(summary.lowSatang, locale)}–${formatBahtAmount(summary.highSatang, locale)}`}</p><p>{t(locale, 'missingCostComponents')}: {summary.missingComponents} · {t(locale, 'includedRecommendationCount')}: {summary.includedCount}</p></> : <p>{t(locale, 'noCostComponents')}</p>}
      <p>{statusLine}{budget !== null && ` · ${locale === 'th' ? `${formatBahtAmount(budget, locale)} บาท` : `THB ${formatBahtAmount(budget, locale)}`}`}</p>
    </div>
    <ActionList project={project} locale={locale} onPreviewFix={onPreviewFix} />
    {notice && <p role="status">{notice}</p>}
    {editing && <RecommendationEditor key={editing.id} recommendation={editing} locale={locale} onSave={save} onCancel={() => { if (draft) onDraftConsumed(); setEditingId(null) }} />}
    {project.recommendations.length ? <div className="recommendation-list">{project.recommendations.map((recommendation) => <article className="recommendation-card" key={recommendation.id}>
      <div><span className="recommendation-status">{t(locale, `status${recommendation.status[0].toUpperCase()}${recommendation.status.slice(1)}` as 'statusProposed' | 'statusAccepted' | 'statusDeferred' | 'statusCompleted')}</span><span>{t(locale, `priority${recommendation.priority[0].toUpperCase()}${recommendation.priority.slice(1)}` as 'priorityNow' | 'priorityNext' | 'priorityLater')}</span><span>{t(locale, recommendation.layoutId)}</span></div>
      <h3>{recommendation.title}</h3><p>{recommendation.reason}</p><p>{recommendation.action}</p>
      <p>{t(locale, 'costEstimateMaterials')}: {recommendation.materials ? `${formatBahtAmount(recommendation.materials.lowSatang, locale)}–${formatBahtAmount(recommendation.materials.highSatang, locale)} ${locale === 'th' ? 'บาท' : 'THB'} · ${recommendation.materials.sourceNote} · ${recommendation.materials.estimatedAt.slice(0, 10)}` : t(locale, 'unknownCost')}</p>
      <p>{t(locale, 'costEstimateLabour')}: {recommendation.labour ? `${formatBahtAmount(recommendation.labour.lowSatang, locale)}–${formatBahtAmount(recommendation.labour.highSatang, locale)} ${locale === 'th' ? 'บาท' : 'THB'} · ${recommendation.labour.sourceNote} · ${recommendation.labour.estimatedAt.slice(0, 10)}` : t(locale, 'unknownCost')}</p>
      {recommendation.advisorNote && <p>{recommendation.advisorNote}</p>}
      <div className="form-actions"><Button type="button" variant="outline" onClick={() => { onDraftConsumed(); setEditingId(recommendation.id) }}>{t(locale, 'recommendationEdit')}</Button><Button type="button" variant="ghost" onClick={() => { onDelete(recommendation.id); setNotice(t(locale, 'recommendationDeleted')) }}>{t(locale, 'recommendationDelete')}</Button></div>
    </article>)}</div> : !editing && <p>{t(locale, 'recommendationsEmpty')}</p>}
    {advisorMode && <ReviewPanel project={project} locale={locale} onReview={onReview} />}
  </section>
}
