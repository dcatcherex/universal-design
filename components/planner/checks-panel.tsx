'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { resultNeedsProfessionalCheck, sortCheckResults } from '@/lib/planner/checks'
import { DISCLAIMER } from '@/lib/planner/exports/report-data'
import { getFixesForResult, type Fix } from '@/lib/planner/standards/fixes'
import { formatLength } from '@/lib/planner/units'
import { t, type MessageKey } from '@/lib/planner/i18n'
import type { BenchmarkId, CheckResult, Locale, Project, RoomType } from '@/lib/planner/types'
import { BENCHMARK_NAME, BenchmarkVerdicts } from './benchmark-verdicts'

const origins = {
  geometry: 'originGeometry',
  'project-target': 'originProjectTarget',
  'custom-overlay': 'originCustomOverlay',
  manual: 'originManual',
  benchmark: 'originBenchmark',
  resident: 'originResident',
} as const

const confidenceLabels = {
  estimated: 'confidenceEstimated',
  measured: 'confidenceMeasured',
  'advisor-verified': 'confidenceVerified',
} as const

/** Advisor control for the benchmark that drives each check's overall status. Changing it makes an existing review outdated. */
export function BenchmarkPolicy({ project, locale, onChange }: { project: Project; locale: Locale; onChange(primary: BenchmarkId | null, chosenBy: string): void }) {
  const [primary, setPrimary] = useState<BenchmarkId | ''>(project.benchmarkPolicy?.primary ?? '')
  const [name, setName] = useState(project.benchmarkPolicy?.chosenBy ?? '')
  const [error, setError] = useState(false)
  function save() {
    if (primary && !name.trim()) { setError(true); return }
    setError(false)
    onChange(primary || null, name)
  }
  return <section className="benchmark-policy" aria-labelledby="benchmark-policy-title">
    <h3 id="benchmark-policy-title">{t(locale, 'primaryBenchmark')}</h3>
    <p className="helper-text">{t(locale, 'primaryBenchmarkHelp')}</p>
    <label className="field-label">{t(locale, 'primaryBenchmark')}<select value={primary} onChange={(event) => setPrimary(event.target.value as BenchmarkId | '')}>
      <option value="">{t(locale, 'primaryBenchmarkNone')}</option>
      <option value="th-public-building">{t(locale, 'benchmarkPublic')}</option>
      <option value="th-dop-home">{t(locale, 'benchmarkHome')}</option>
    </select></label>
    {primary && <label className="field-label">{t(locale, 'chosenBy')}<input type="text" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></label>}
    {error && <p role="alert" className="field-error">{t(locale, 'chosenByRequired')}</p>}
    <Button type="button" variant="outline" onClick={save}>{t(locale, 'primaryBenchmarkSave')}</Button>
    {project.benchmarkPolicy && <p className="helper-text">{t(locale, 'primaryBenchmarkCurrent')}: {t(locale, BENCHMARK_NAME[project.benchmarkPolicy.primary])} · {project.benchmarkPolicy.chosenBy}</p>}
  </section>
}

export function ChecksPanel({ results, locale, project, roomType, onSelectEntities, onCreateRecommendation, onPreviewFix }: {
  results: CheckResult[]
  locale: Locale
  project: Project
  roomType: RoomType
  onSelectEntities(result: CheckResult): void
  onCreateRecommendation?(result: CheckResult): void
  onPreviewFix?(result: CheckResult, fix: Fix): void
}) {
  const attention = results.filter((result) => result.status === 'attention').length
  const pending = results.filter((result) => result.status === 'not-evaluated').length
  const clear = results.filter((result) => result.status === 'clear').length
  const context = { roomType, mobilityAids: project.household.mobilityAids }
  return <section className="checks-panel" aria-labelledby="checks-panel-title">
    <header className="checks-heading">
      <h2 id="checks-panel-title">{t(locale, 'checksTitle')}</h2>
      <p>{locale === 'th' ? 'ผลตรวจจากข้อมูลในแผนผัง ไม่ใช่การรับรองความปลอดภัย' : 'Results describe entered plan geometry; they do not certify safety.'}</p>
      <div className="checks-counts" aria-label={locale === 'th' ? 'สรุปผลตรวจ' : 'Check counts'}>
        <span className="check-count-attention">{t(locale, 'checkAttention')}: {attention}</span>
        <span>{t(locale, 'checkClear')}: {clear}</span>
        <span>{t(locale, 'checkNotEvaluated')}: {pending}</span>
      </div>
    </header>
    <div className="check-result-list">
      {sortCheckResults(results).map((result) => {
        const fixes = onPreviewFix ? getFixesForResult(result, project) : []
        return <article className={`check-result check-result-${result.status}`} key={result.id} data-testid="check-result" data-rule-id={result.ruleId} data-check-status={result.status} data-near-fall={result.nearFall}>
          <div className="check-result-head">
            <span className="check-rule">{result.ruleId}</span>
            <strong>{t(locale, result.status === 'attention' ? 'checkAttention' : result.status === 'clear' ? 'checkClear' : 'checkNotEvaluated')}</strong>
            {result.nearFall && <span className="near-fall-chip"><span aria-hidden="true">▲</span> {t(locale, 'nearFall')}</span>}
          </div>
          <p>{t(locale, result.messageKey as MessageKey)}</p>
          <BenchmarkVerdicts verdicts={result.verdicts} locale={locale} context={context} />
          {resultNeedsProfessionalCheck(result) && <p className="get-checked"><span aria-hidden="true">☞</span> {t(locale, 'getThisChecked')}</p>}
          <dl>
            <div><dt>{t(locale, 'checkOrigin')}</dt><dd>{t(locale, origins[result.evidence.origin])}</dd></div>
            <div><dt>{t(locale, 'checkConfidence')}</dt><dd>{t(locale, confidenceLabels[result.evidence.confidence])}</dd></div>
            {result.measuredMm !== undefined && <div><dt>{locale === 'th' ? 'ขนาดที่ใช้ในแบบ' : 'Value used in plan'}</dt><dd>{formatLength(result.measuredMm, 'cm', locale)} {locale === 'th' ? 'ซม.' : 'cm'}</dd></div>}
            {result.targetMm !== undefined && <div><dt>{t(locale, result.basis === 'resident' ? 'residentValue' : result.basis === 'benchmark' ? 'benchmarkValue' : 'projectTargetValue')}</dt><dd>{formatLength(result.targetMm, 'cm', locale)} {locale === 'th' ? 'ซม.' : 'cm'}</dd></div>}
            <div className="check-limitation"><dt>{t(locale, 'checkLimitation')}</dt><dd>{t(locale, result.evidence.limitationKey as MessageKey)}</dd></div>
          </dl>
          {fixes.length > 0 && <div className="fix-list" role="group" aria-label={t(locale, 'suggestedFixes')}>
            <strong>{t(locale, 'suggestedFixes')}</strong>
            {fixes.map((fix) => <Button key={fix.id} type="button" variant="outline" data-fix-id={fix.id} onClick={() => onPreviewFix!(result, fix)}>{t(locale, 'previewFix')}: {fix.label[locale]}</Button>)}
          </div>}
          <Button type="button" variant="outline" onClick={() => onSelectEntities(result)}>{t(locale, 'selectCheckLocation')}</Button>
          {onCreateRecommendation && result.status !== 'clear' && <Button type="button" variant="outline" onClick={() => onCreateRecommendation(result)}>{t(locale, 'addFromCheck')}</Button>}
        </article>
      })}
    </div>
    <footer className="checks-disclaimer"><p>{DISCLAIMER[locale]}</p></footer>
  </section>
}
