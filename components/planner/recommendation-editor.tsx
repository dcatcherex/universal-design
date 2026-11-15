'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { formatBahtAmount, parseBahtAmount } from '@/lib/planner/recommendations'
import { t } from '@/lib/planner/i18n'
import type { CostRange, Locale, Recommendation } from '@/lib/planner/types'

type CostKey = 'materials' | 'labour'
function CostFields({ label, value, locale, costKey, onChange, onValidityChange }: { label: string; value: CostRange | null; locale: Locale; costKey: CostKey; onChange(value: CostRange | null): void; onValidityChange(key: CostKey, valid: boolean): void }) {
  const [low, setLow] = useState(value ? formatBahtAmount(value.lowSatang, locale) : '')
  const [high, setHigh] = useState(value ? formatBahtAmount(value.highSatang, locale) : '')
  const [source, setSource] = useState(value?.sourceNote ?? '')
  const [date, setDate] = useState(value?.estimatedAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  if (!value) return <fieldset className="cost-component"><legend>{label}</legend><p>{t(locale, 'unknownCost')}</p><Button type="button" variant="outline" onClick={() => { onChange({ lowSatang: 0, highSatang: 0, sourceNote: '', estimatedAt: new Date().toISOString() }); onValidityChange(costKey, false) }}>{t(locale, 'addCostEstimate')}</Button></fieldset>
  function updateValidity(next: { low?: string; high?: string; source?: string; date?: string }) {
    const nextLow = next.low ?? low, nextHigh = next.high ?? high, nextSource = next.source ?? source, nextDate = next.date ?? date
    onValidityChange(costKey, parseBahtAmount(nextLow) !== null && parseBahtAmount(nextHigh) !== null && !!nextSource.trim() && !!nextDate && !Number.isNaN(Date.parse(nextDate)))
  }
  return <fieldset className="cost-component"><legend>{label}</legend>
    <div className="field-grid">
      <label className="field-label">{t(locale, 'costLowBaht')}<input type="text" inputMode="decimal" value={low} onChange={(event) => { setLow(event.target.value); updateValidity({ low: event.target.value }); const parsed = parseBahtAmount(event.target.value); if (parsed !== null) onChange({ ...value, lowSatang: parsed }) }} /></label>
      <label className="field-label">{t(locale, 'costHighBaht')}<input type="text" inputMode="decimal" value={high} onChange={(event) => { setHigh(event.target.value); updateValidity({ high: event.target.value }); const parsed = parseBahtAmount(event.target.value); if (parsed !== null) onChange({ ...value, highSatang: parsed }) }} /></label>
      <label className="field-label">{t(locale, 'costSource')}<input value={source} onChange={(event) => { setSource(event.target.value); updateValidity({ source: event.target.value }); onChange({ ...value, sourceNote: event.target.value }) }} /></label>
      <label className="field-label">{t(locale, 'costDate')}<input type="date" value={date} onChange={(event) => { setDate(event.target.value); updateValidity({ date: event.target.value }); onChange({ ...value, estimatedAt: event.target.value ? `${event.target.value}T00:00:00.000Z` : '' }) }} /></label>
    </div>
    <Button type="button" variant="ghost" onClick={() => { onChange(null); onValidityChange(costKey, true) }}>{t(locale, 'removeCostEstimate')}</Button>
  </fieldset>
}

export function RecommendationEditor({ recommendation, locale, onSave, onCancel }: {
  recommendation: Recommendation; locale: Locale; onSave(recommendation: Recommendation): void; onCancel(): void
}) {
  const [draft, setDraft] = useState(() => structuredClone(recommendation))
  const [costValidity, setCostValidity] = useState<Record<CostKey, boolean>>({ materials: true, labour: true })
  const [error, setError] = useState(false)
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validCost = (cost: CostRange | null) => !cost || (Number.isSafeInteger(cost.lowSatang) && Number.isSafeInteger(cost.highSatang) && cost.lowSatang >= 0 && cost.highSatang >= cost.lowSatang && !!cost.sourceNote.trim() && !Number.isNaN(Date.parse(cost.estimatedAt)))
    if (!draft.title.trim() || !draft.reason.trim() || !draft.action.trim() || !validCost(draft.materials) || !validCost(draft.labour) || !costValidity.materials || !costValidity.labour) { setError(true); return }
    onSave({ ...draft, title: draft.title.trim(), reason: draft.reason.trim(), action: draft.action.trim() })
    setError(false)
  }
  const set = <K extends keyof Recommendation>(key: K, value: Recommendation[K]) => setDraft((current) => ({ ...current, [key]: value }))
  return <form className="recommendation-editor" onSubmit={save} noValidate>
    <label className="field-label">{t(locale, 'recommendationTitle')}<input value={draft.title} maxLength={160} onChange={(event) => set('title', event.target.value)} /></label>
    <label className="field-label">{t(locale, 'recommendationReason')}<textarea value={draft.reason} maxLength={4000} rows={3} onChange={(event) => set('reason', event.target.value)} /></label>
    <label className="field-label">{t(locale, 'recommendationAction')}<textarea value={draft.action} maxLength={4000} rows={3} onChange={(event) => set('action', event.target.value)} /></label>
    <div className="field-grid">
      <label className="field-label">{t(locale, 'recommendationLayout')}<select value={draft.layoutId} onChange={(event) => set('layoutId', event.target.value as Recommendation['layoutId'])}><option value="current">{t(locale, 'current')}</option><option value="proposed">{t(locale, 'proposed')}</option></select></label>
      <label className="field-label">{t(locale, 'recommendationPriority')}<select value={draft.priority} onChange={(event) => set('priority', event.target.value as Recommendation['priority'])}><option value="now">{t(locale, 'priorityNow')}</option><option value="next">{t(locale, 'priorityNext')}</option><option value="later">{t(locale, 'priorityLater')}</option></select></label>
      <label className="field-label">{t(locale, 'recommendationWorkType')}<select value={draft.workType} onChange={(event) => set('workType', event.target.value as Recommendation['workType'])}><option value="rearrange">{t(locale, 'workRearrange')}</option><option value="purchase">{t(locale, 'workPurchase')}</option><option value="building-work">{t(locale, 'workBuilding')}</option><option value="site-review">{t(locale, 'workSiteReview')}</option></select></label>
      <label className="field-label">{t(locale, 'recommendationStatus')}<select value={draft.status} onChange={(event) => set('status', event.target.value as Recommendation['status'])}><option value="proposed">{t(locale, 'statusProposed')}</option><option value="accepted">{t(locale, 'statusAccepted')}</option><option value="deferred">{t(locale, 'statusDeferred')}</option><option value="completed">{t(locale, 'statusCompleted')}</option></select></label>
    </div>
    <label className="field-label">{t(locale, 'recommendationAdvisorNote')}<textarea value={draft.advisorNote} maxLength={4000} rows={2} onChange={(event) => set('advisorNote', event.target.value)} /></label>
    <CostFields key={draft.materials ? 'materials-set' : 'materials-none'} costKey="materials" label={t(locale, 'costEstimateMaterials')} value={draft.materials} locale={locale} onChange={(value) => set('materials', value)} onValidityChange={(key, valid) => setCostValidity((current) => ({ ...current, [key]: valid }))} />
    <CostFields key={draft.labour ? 'labour-set' : 'labour-none'} costKey="labour" label={t(locale, 'costEstimateLabour')} value={draft.labour} locale={locale} onChange={(value) => set('labour', value)} onValidityChange={(key, valid) => setCostValidity((current) => ({ ...current, [key]: valid }))} />
    {error && <p className="field-error" role="alert">{t(locale, 'recommendationValidation')} {t(locale, 'costValidation')}</p>}
    <div className="form-actions"><Button type="submit">{t(locale, 'recommendationSave')}</Button><Button type="button" variant="outline" onClick={onCancel}>{t(locale, 'recommendationCancel')}</Button></div>
  </form>
}
