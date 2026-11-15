'use client'

import { Button } from '@/components/ui/button'
import { formatLength } from '@/lib/planner/units'
import { t, type MessageKey } from '@/lib/planner/i18n'
import type { CheckResult, Locale } from '@/lib/planner/types'

const origins = {
  geometry: 'originGeometry',
  'project-target': 'originProjectTarget',
  'custom-overlay': 'originCustomOverlay',
  manual: 'originManual',
} as const

const confidenceLabels = {
  estimated: 'confidenceEstimated',
  measured: 'confidenceMeasured',
  'advisor-verified': 'confidenceVerified',
} as const

export function ChecksPanel({ results, locale, onSelectEntities, onCreateRecommendation }: {
  results: CheckResult[]
  locale: Locale
  onSelectEntities(result: CheckResult): void
  onCreateRecommendation?(result: CheckResult): void
}) {
  const attention = results.filter((result) => result.status === 'attention').length
  const pending = results.filter((result) => result.status === 'not-evaluated').length
  const clear = results.filter((result) => result.status === 'clear').length
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
      {results.map((result) => <article className={`check-result check-result-${result.status}`} key={result.id} data-testid="check-result" data-rule-id={result.ruleId} data-check-status={result.status}>
        <div className="check-result-head">
          <span className="check-rule">{result.ruleId}</span>
          <strong>{t(locale, result.status === 'attention' ? 'checkAttention' : result.status === 'clear' ? 'checkClear' : 'checkNotEvaluated')}</strong>
        </div>
        <p>{t(locale, result.messageKey as MessageKey)}</p>
        <dl>
          <div><dt>{t(locale, 'checkOrigin')}</dt><dd>{t(locale, origins[result.evidence.origin])}</dd></div>
          <div><dt>{t(locale, 'checkConfidence')}</dt><dd>{t(locale, confidenceLabels[result.evidence.confidence])}</dd></div>
          {result.measuredMm !== undefined && <div><dt>{locale === 'th' ? 'ขนาดที่ใช้ในแบบ' : 'Value used in plan'}</dt><dd>{formatLength(result.measuredMm, 'cm', locale)} {locale === 'th' ? 'ซม.' : 'cm'}</dd></div>}
          {result.targetMm !== undefined && <div><dt>{locale === 'th' ? 'เป้าหมายโครงการ' : 'Project target'}</dt><dd>{formatLength(result.targetMm, 'cm', locale)} {locale === 'th' ? 'ซม.' : 'cm'}</dd></div>}
          <div className="check-limitation"><dt>{t(locale, 'checkLimitation')}</dt><dd>{t(locale, result.evidence.limitationKey as MessageKey)}</dd></div>
        </dl>
        <Button type="button" variant="outline" onClick={() => onSelectEntities(result)}>{t(locale, 'selectCheckLocation')}</Button>
        {onCreateRecommendation && result.status !== 'clear' && <Button type="button" variant="outline" onClick={() => onCreateRecommendation(result)}>{t(locale, 'addFromCheck')}</Button>}
      </article>)}
    </div>
  </section>
}
