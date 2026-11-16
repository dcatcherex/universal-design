'use client'

import { Button } from '@/components/ui/button'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { formatLength } from '@/lib/planner/units'
import type { FallRecord, Locale, Measurement, Project, ResidentProfile } from '@/lib/planner/types'
import { MeasureField } from './measure-field'

const ACTIVITIES: { value: FallRecord['activity']; label: MessageKey }[] = [
  { value: 'toileting', label: 'fallToileting' }, { value: 'bathing', label: 'fallBathing' }, { value: 'transferring', label: 'fallTransferring' },
  { value: 'walking', label: 'fallWalking' }, { value: 'at-night', label: 'fallAtNight' }, { value: 'other', label: 'fallOther' },
]

type Props = {
  project: Project; locale: Locale; advisorMode: boolean
  /** The fall whose location is being picked on the plan, if any. */
  pickingFallId: string | null
  onChange(resident: ResidentProfile): void
  onPickLocation(fallId: string | null): void
}

/**
 * The resident's body measurements and fall history. All of it is optional health information:
 * it stays on this device and is left out of the report unless the user includes it.
 */
export function ResidentPanel({ project, locale, advisorMode, pickingFallId, onChange, onPickLocation }: Props) {
  const resident = project.resident
  const roomId = project.current.floors[0].rooms[0].id
  const set = (patch: Partial<ResidentProfile>) => onChange({ ...resident, ...patch })
  const estimated = (valueMm: number): Measurement => ({ valueMm, confidence: 'estimated' })

  function setReach(bound: 'low' | 'high', value: Measurement | null) {
    if (!value) { set({ reach: null }); return }
    const current = resident.reach ?? { posture: 'standing' as const, low: estimated(Math.min(400, value.valueMm)), high: estimated(Math.max(1500, value.valueMm)) }
    const next = { ...current, [bound]: value }
    // Keep the band the right way round by moving the other bound with it.
    if (next.low.valueMm > next.high.valueMm) { if (bound === 'low') next.high = estimated(value.valueMm); else next.low = estimated(value.valueMm) }
    set({ reach: next })
  }
  function setWheelchair(side: 'width' | 'length', value: Measurement | null) {
    if (!value) { set({ wheelchair: null }); return }
    const current = resident.wheelchair ?? { width: estimated(650), length: estimated(1100) }
    set({ wheelchair: { ...current, [side]: value } })
  }
  const updateFall = (id: string, patch: Partial<FallRecord>) => set({ falls: resident.falls.map((fall) => fall.id === id ? { ...fall, ...patch } : fall) })
  function addFall() {
    if (resident.falls.length >= 20) return
    set({ falls: [...resident.falls, { id: `fall-${crypto.randomUUID()}`, when: 'within-3-months', roomId, point: null, activity: 'other', note: '' }] })
  }

  return <section className="resident-panel" aria-labelledby="resident-panel-title">
    <header><h2 id="resident-panel-title">{t(locale, 'resident')}</h2></header>
    <p className="privacy-note" role="note">{t(locale, 'residentPrivacy')}</p>

    <MeasureField label={t(locale, 'standingHeightCm')} measurement={resident.standingHeight} locale={locale} editable advisorMode={advisorMode} min={500} max={2500} optional onChange={(value) => set({ standingHeight: value })} />

    <fieldset className="resident-group">
      <legend>{t(locale, 'reachBand')}</legend>
      <p className="helper-text">{t(locale, 'reachWhy')}</p>
      <label className="field-label">{t(locale, 'reachPosture')}<select value={resident.reach?.posture ?? 'standing'} disabled={!resident.reach} onChange={(event) => resident.reach && set({ reach: { ...resident.reach, posture: event.target.value as 'standing' | 'seated' } })}>
        <option value="standing">{t(locale, 'postureStanding')}</option><option value="seated">{t(locale, 'postureSeated')}</option>
      </select></label>
      <MeasureField label={t(locale, 'reachLowCm')} measurement={resident.reach?.low ?? null} locale={locale} editable advisorMode={advisorMode} min={0} max={2500} optional onChange={(value) => setReach('low', value)} />
      <MeasureField label={t(locale, 'reachHighCm')} measurement={resident.reach?.high ?? null} locale={locale} editable advisorMode={advisorMode} min={0} max={2500} optional onChange={(value) => setReach('high', value)} />
    </fieldset>

    <label className="field-label">{t(locale, 'strongerHand')}<select value={resident.strongerHand} onChange={(event) => set({ strongerHand: event.target.value as ResidentProfile['strongerHand'] })}>
      <option value="unknown">{t(locale, 'handUnknown')}</option><option value="left">{t(locale, 'handLeft')}</option><option value="right">{t(locale, 'handRight')}</option><option value="both">{t(locale, 'handBoth')}</option>
    </select></label>
    <p className="helper-text">{t(locale, 'strongerHandWhy')}</p>

    <fieldset className="resident-group">
      <legend>{t(locale, 'wheelchairSize')}</legend>
      <p className="helper-text">{t(locale, 'wheelchairWhy')}</p>
      <MeasureField label={t(locale, 'wheelchairWidthCm')} measurement={resident.wheelchair?.width ?? null} locale={locale} editable advisorMode={advisorMode} min={300} max={1500} optional onChange={(value) => setWheelchair('width', value)} />
      <MeasureField label={t(locale, 'wheelchairLengthCm')} measurement={resident.wheelchair?.length ?? null} locale={locale} editable advisorMode={advisorMode} min={500} max={2500} optional onChange={(value) => setWheelchair('length', value)} />
    </fieldset>

    <fieldset className="resident-group">
      <legend>{t(locale, 'fallsHeading')}</legend>
      <p className="helper-text">{t(locale, 'fallsWhy')}</p>
      {resident.falls.map((fall, index) => <div className="fall-card" key={fall.id} data-fall-id={fall.id}>
        <strong><span className="fall-icon" aria-hidden="true">▲</span> {t(locale, 'fallMarker')} {index + 1}</strong>
        <label className="field-label">{t(locale, 'fallWhen')}<select value={fall.when} onChange={(event) => updateFall(fall.id, { when: event.target.value as FallRecord['when'] })}>
          <option value="within-3-months">{t(locale, 'fallWithin3')}</option><option value="3-to-12-months">{t(locale, 'fall3to12')}</option>
        </select></label>
        <label className="field-label">{t(locale, 'fallActivity')}<select value={fall.activity} onChange={(event) => updateFall(fall.id, { activity: event.target.value as FallRecord['activity'] })}>{ACTIVITIES.map((activity) => <option key={activity.value} value={activity.value}>{t(locale, activity.label)}</option>)}</select></label>
        <label className="field-label">{t(locale, 'fallNote')}<input type="text" defaultValue={fall.note} maxLength={500} onBlur={(event) => { if (event.target.value !== fall.note) updateFall(fall.id, { note: event.target.value }) }} /></label>
        <p className="helper-text">{fall.point ? `${t(locale, 'fallLocation')}: ${formatLength(fall.point.xMm, 'cm', locale)}, ${formatLength(fall.point.yMm, 'cm', locale)} ${t(locale, 'unitCm')}` : t(locale, 'fallNoLocation')}</p>
        <div className="form-actions">
          <Button type="button" variant={pickingFallId === fall.id ? 'secondary' : 'outline'} aria-pressed={pickingFallId === fall.id} onClick={() => onPickLocation(pickingFallId === fall.id ? null : fall.id)}>{t(locale, 'fallPick')}</Button>
          {fall.point && <Button type="button" variant="ghost" onClick={() => updateFall(fall.id, { point: null })}>{t(locale, 'fallClearLocation')}</Button>}
          <Button type="button" variant="ghost" className="remove-button" onClick={() => { if (pickingFallId === fall.id) onPickLocation(null); set({ falls: resident.falls.filter((candidate) => candidate.id !== fall.id) }) }}>{t(locale, 'fallRemove')}</Button>
        </div>
      </div>)}
      <Button type="button" variant="outline" disabled={resident.falls.length >= 20} onClick={addFall}>{t(locale, 'fallAdd')}</Button>
    </fieldset>
  </section>
}
