'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/planner/i18n'
import { formatLength, parseLength } from '@/lib/planner/units'
import type { Confidence, Locale, Measurement, VerificationMethod } from '@/lib/planner/types'

type Props = {
  label: string
  measurement: Measurement | null
  locale: Locale
  editable: boolean
  inputId?: string
  focusTarget?: string
  /** Only an advisor can record a value as verified. */
  advisorMode?: boolean
  min: number
  max: number
  /** When true, an empty field means "not recorded" and reports null. */
  optional?: boolean
  onChange(measurement: Measurement | null): void
}

/**
 * A length in centimetres together with how far it can be trusted.
 * The number is committed on Enter or when focus leaves the field, so a half-typed value is never saved.
 * Changing the number resets it to "estimated" and clears any verification: a verified value is only
 * verified for the number that was checked.
 */
export function MeasureField({ label, measurement, locale, editable, advisorMode = false, min, max, optional = false, inputId, focusTarget, onChange }: Props) {
  const generatedId = useId()
  const id = inputId ?? generatedId
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifier, setVerifier] = useState(measurement?.verifiedBy ?? '')
  const [method, setMethod] = useState<VerificationMethod>(measurement?.verificationMethod === 'photo' ? 'photo' : 'on-site')
  const [note, setNote] = useState(measurement?.verificationNote ?? '')
  const shown = draft ?? (measurement ? formatLength(measurement.valueMm, 'cm', locale) : '')

  function commit() {
    if (draft === null) return
    if (!draft.trim()) {
      if (optional) { setDraft(null); setError(''); if (measurement) onChange(null) } else { setDraft(null); setError('') }
      return
    }
    const parsed = parseLength(draft, 'cm')
    if (!parsed.ok || parsed.value < min || parsed.value > max) {
      setError(`${t(locale, 'invalidLength')} (${formatLength(min, 'cm', locale)}–${formatLength(max, 'cm', locale)} ${t(locale, 'unitCm')})`)
      return
    }
    setDraft(null)
    setError('')
    if (parsed.value !== measurement?.valueMm) onChange({ valueMm: parsed.value, confidence: 'estimated' })
  }

  function changeConfidence(value: Confidence) {
    if (!measurement) return
    if (value === 'advisor-verified') { setVerifying(true); return }
    setVerifying(false)
    onChange({ valueMm: measurement.valueMm, confidence: value })
  }

  function saveVerification() {
    if (!measurement) return
    if (!verifier.trim()) { setError(t(locale, 'verifierRequired')); return }
    setError('')
    setVerifying(false)
    onChange({
      valueMm: measurement.valueMm, confidence: 'advisor-verified', verifiedBy: verifier.trim(), verifiedAt: new Date().toISOString(),
      verificationMethod: method, ...(note.trim() ? { verificationNote: note.trim().slice(0, 500) } : {}),
    })
  }

  const confidence = verifying ? 'advisor-verified' : measurement?.confidence ?? 'estimated'
  const methodLabel = (value: VerificationMethod | undefined) => t(locale, value === 'on-site' ? 'verifiedOnSite' : value === 'photo' ? 'verifiedFromPhoto' : 'verifiedUnspecified')

  return <div className="measure-field">
    <label className="field-label" htmlFor={id}>{label}</label>
    <div className="measure-row">
      <input id={id} type="text" inputMode="decimal" value={shown} placeholder={optional ? '—' : undefined} disabled={!editable}
        data-need-focus={focusTarget}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} />
      <select aria-label={`${label}: ${t(locale, 'checkConfidence')}`} value={confidence} disabled={!editable || !measurement} onChange={(event) => changeConfidence(event.target.value as Confidence)}>
        <option value="estimated">{t(locale, 'confidenceEstimated')}</option>
        <option value="measured">{t(locale, 'confidenceMeasured')}</option>
        {(advisorMode || measurement?.confidence === 'advisor-verified') && <option value="advisor-verified">{t(locale, 'confidenceVerified')}</option>}
      </select>
    </div>
    {measurement?.confidence === 'advisor-verified' && !verifying && <p className="measure-note">{methodLabel(measurement.verificationMethod)} · {measurement.verifiedBy}{measurement.verificationNote ? ` · ${measurement.verificationNote}` : ''}</p>}
    {verifying && <fieldset className="measure-verify">
      <legend>{t(locale, 'verifyHeading')}</legend>
      <label className="field-label">{t(locale, 'verifierName')}<input type="text" value={verifier} maxLength={160} onChange={(event) => setVerifier(event.target.value)} /></label>
      <label className="field-label">{t(locale, 'verificationMethod')}<select value={method} onChange={(event) => setMethod(event.target.value as VerificationMethod)}>
        <option value="on-site">{t(locale, 'verifiedOnSite')}</option>
        <option value="photo">{t(locale, 'verifiedFromPhoto')}</option>
      </select></label>
      <label className="field-label">{t(locale, 'verificationNote')}<input type="text" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label>
      <p className="helper-text">{t(locale, 'verifyHelp')}</p>
      <div className="form-actions"><Button type="button" onClick={saveVerification}>{t(locale, 'verifySave')}</Button><Button type="button" variant="outline" onClick={() => { setVerifying(false); setError('') }}>{t(locale, 'recommendationCancel')}</Button></div>
    </fieldset>}
    {error && <p role="alert" id={`${id}-error`} className="field-error">{error}</p>}
  </div>
}
