'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatLength, parseLength } from '@/lib/planner/units'
import { t } from '@/lib/planner/i18n'
import type { Locale, Project, ProjectTarget } from '@/lib/planner/types'

type TargetKey = 'routeWidth' | 'turningDiameter'

function TargetEditor({ targetKey, target, locale, onSave, onClear }: {
  targetKey: TargetKey; target: ProjectTarget | null; locale: Locale
  onSave(next: ProjectTarget): void; onClear(): void
}) {
  const isRoute = targetKey === 'routeWidth'
  const [value, setValue] = useState(target ? formatLength(target.valueMm, 'cm', locale) : '')
  const [enteredBy, setEnteredBy] = useState(target?.enteredBy ?? '')
  const [rationale, setRationale] = useState(target?.rationale ?? '')
  const [sourceUrl, setSourceUrl] = useState(target?.sourceUrl ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  function save() {
    const parsed = parseLength(value, 'cm')
    const max = isRoute ? 3000 : 4000
    if (!parsed.ok || parsed.value < 100 || parsed.value > max) { setError(t(locale, 'targetValueRequired')); return }
    if (!enteredBy.trim()) { setError(t(locale, 'targetNameRequired')); return }
    if (!rationale.trim()) { setError(t(locale, 'targetRationaleRequired')); return }
    if (sourceUrl.trim()) {
      try {
        const url = new URL(sourceUrl.trim())
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol')
      } catch { setError(t(locale, 'overlayInputError')); return }
    }
    setError('')
    onSave({ valueMm: parsed.value, enteredBy: enteredBy.trim(), rationale: rationale.trim(), enteredAt: new Date().toISOString(), ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}) })
    setSaved(true)
  }
  return <article className="target-card">
    <div className="target-current"><strong>{t(locale, isRoute ? 'routeTarget' : 'turningTarget')}</strong>{target ? <span>{formatLength(target.valueMm, 'cm', locale)} {locale === 'th' ? 'ซม.' : 'cm'} · {target.enteredBy}</span> : <span>{t(locale, 'checkNotEvaluated')}</span>}</div>
    <label className="field-label">{t(locale, isRoute ? 'routeTarget' : 'turningTarget')}<input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder={locale === 'th' ? 'เช่น 90' : 'e.g. 90'} /></label>
    <label className="field-label">{t(locale, 'enteredBy')}<input value={enteredBy} onChange={(event) => setEnteredBy(event.target.value)} maxLength={160} /></label>
    <label className="field-label">{t(locale, 'rationale')}<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={4000} /></label>
    <label className="field-label">{t(locale, 'sourceUrl')}<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
    <div className="overlay-actions"><Button type="button" onClick={save}>{t(locale, 'saveTarget')}</Button>{target && <Button type="button" variant="outline" onClick={() => { setError(''); setSaved(false); onClear() }}>{t(locale, 'clearTarget')}</Button>}</div>
    {error && <p role="alert" className="field-error">{error}</p>}
    {saved && <p role="status" className="helper-text">{t(locale, 'targetsSaved')}</p>}
  </article>
}

export function AdvisorTargets({ project, locale, onCommit }: {
  project: Project; locale: Locale; onCommit(targets: Project['targets']): void
}) {
  return <section className="advisor-targets" aria-labelledby="advisor-targets-title">
    <h2 id="advisor-targets-title">{t(locale, 'projectTargets')}</h2>
    <p className="helper-text">{t(locale, 'projectSpecificDisclaimer')}</p>
    <TargetEditor targetKey="routeWidth" target={project.targets.routeWidth} locale={locale}
      onSave={(routeWidth) => onCommit({ ...project.targets, routeWidth })}
      onClear={() => onCommit({ ...project.targets, routeWidth: null })} />
    <TargetEditor targetKey="turningDiameter" target={project.targets.turningDiameter} locale={locale}
      onSave={(turningDiameter) => onCommit({ ...project.targets, turningDiameter })}
      onClear={() => onCommit({ ...project.targets, turningDiameter: null })} />
  </section>
}
