'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/planner/i18n'
import { parseLength } from '@/lib/planner/units'
import { parseBahtAmount } from '@/lib/planner/recommendations'
import { PROVINCES } from '@/lib/planner/standards/provinces'
import type { RoomType } from '@/lib/planner/types'
import { newProjectDraft, usePlanner } from './planner-provider'

export function ProjectSetup({ onBack, onCreated }: { onBack: () => void; onCreated(): void }) {
  const { locale, beginNewProject } = usePlanner()
  const [title, setTitle] = useState(locale === 'th' ? 'โครงการปรับห้องนั่งเล่น' : 'Living room adaptation')
  const [provinceCode, setProvinceCode] = useState('')
  const [roomType, setRoomType] = useState<RoomType>('living')
  const [width, setWidth] = useState('6')
  const [depth, setDepth] = useState('5')
  const [height, setHeight] = useState('2.7')
  const [budget, setBudget] = useState('')
  const [activity, setActivity] = useState('')
  const [aids, setAids] = useState<string[]>([])
  const [concerns, setConcerns] = useState<string[]>([])
  const [assistance, setAssistance] = useState('')
  const [preferences, setPreferences] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const measurements = [width, depth, height].map((value) => parseLength(value, 'm'))
    if (measurements.some((value) => !value.ok)) {
      setError(t(locale, 'invalidLength'))
      return
    }
    const dimensions = measurements.map((value) => value.ok ? value.value : 0)
    if (dimensions[0] < 1500 || dimensions[0] > 15000 || dimensions[1] < 1500 || dimensions[1] > 15000 || dimensions[2] < 2000 || dimensions[2] > 5000) {
      setError(t(locale, 'invalidLength'))
      return
    }
    const now = new Date().toISOString()
    const project = newProjectDraft(title.trim() || t(locale, 'projectCreated'), {
      widthMm: dimensions[0], depthMm: dimensions[1], heightMm: dimensions[2],
    }, now, roomType)
    const province = PROVINCES.find((entry) => entry.code === provinceCode)
    project.household.province = province ? province[locale] : ''
    project.household.provinceCode = province ? province.code : null
    project.household.activities = activity.trim() ? [activity.trim()] : []
    project.household.mobilityAids = aids
    project.household.concerns = concerns as typeof project.household.concerns
    project.household.assistanceNotes = assistance.trim()
    project.household.residentPreferences = preferences.trim()
    if (budget.trim()) {
      const satang = parseBahtAmount(budget)
      if (satang === null) {
        setError(t(locale, 'invalidBudget'))
        return
      }
      project.household.budgetSatang = satang
    }
    beginNewProject(project)
    onCreated()
  }

  // Switching room type swaps in that room's typical starting size and title; the user can still change both.
  function changeRoomType(next: RoomType) {
    setRoomType(next)
    const size = next === 'bathroom' ? ['2', '1.8', '2.5'] : ['6', '5', '2.7']
    setWidth(size[0]); setDepth(size[1]); setHeight(size[2])
    setTitle(t(locale, next === 'bathroom' ? 'defaultTitleBathroom' : 'defaultTitleLiving'))
  }

  const aidsOptions = locale === 'th' ? ['ไม้เท้า', 'รถช่วยเดิน', 'รถเข็น'] : ['Cane', 'Walker', 'Wheelchair']
  const concernOptions = [
    ['lighting', locale === 'th' ? 'แสงสว่าง' : 'Lighting'], ['reach', locale === 'th' ? 'การเอื้อมหยิบ' : 'Reach'],
    ['rugs', locale === 'th' ? 'พรม' : 'Rugs'], ['thresholds', locale === 'th' ? 'ธรณีประตู' : 'Thresholds'],
  ]
  const toggle = (values: string[], value: string, setter: (values: string[]) => void) => setter(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value])

  return (
    <main className="setup-page">
      <form className="setup-card" onSubmit={submit}>
        <div className="setup-heading"><span className="brand-mark">บ</span><div><p className="eyebrow">{t(locale, 'brand')}</p><h1>{t(locale, 'newProject')}</h1></div></div>
        <label>{t(locale, 'projectTitle')}<Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
        <label>{t(locale, 'province')}<select className="setup-select" value={provinceCode} onChange={(event) => setProvinceCode(event.target.value)}><option value="">{t(locale, 'provinceNone')}</option>{[...PROVINCES].sort((a, b) => a[locale].localeCompare(b[locale], locale)).map((entry) => <option key={entry.code} value={entry.code}>{entry[locale]}</option>)}</select></label>
        <label>{t(locale, 'roomType')}<select className="setup-select" value={roomType} onChange={(event) => changeRoomType(event.target.value as RoomType)}><option value="living">{t(locale, 'roomLiving')}</option><option value="bathroom">{t(locale, 'roomBathroom')}</option></select></label>
        <fieldset><legend>{t(locale, 'roomSize')}</legend><div className="setup-grid">
          <label>{t(locale, 'widthM')}<Input inputMode="decimal" value={width} onChange={(event) => setWidth(event.target.value)} /></label>
          <label>{t(locale, 'depthM')}<Input inputMode="decimal" value={depth} onChange={(event) => setDepth(event.target.value)} /></label>
          <label>{t(locale, 'heightM')}<Input inputMode="decimal" value={height} onChange={(event) => setHeight(event.target.value)} /></label>
        </div></fieldset>
        <label>{t(locale, 'activities')}<Input value={activity} onChange={(event) => setActivity(event.target.value)} maxLength={500} /></label>
        <fieldset><legend>{t(locale, 'mobilityAids')}</legend><div className="choice-row">{aidsOptions.map((option) => <label className="choice" key={option}><input type="checkbox" checked={aids.includes(option)} onChange={() => toggle(aids, option, setAids)} />{option}</label>)}</div></fieldset>
        <fieldset><legend>{t(locale, 'concerns')}</legend><div className="choice-row">{concernOptions.map(([key, label]) => <label className="choice" key={key}><input type="checkbox" checked={concerns.includes(key)} onChange={() => toggle(concerns, key, setConcerns)} />{label}</label>)}</div></fieldset>
        <label>{t(locale, 'assistanceNotes')}<textarea value={assistance} onChange={(event) => setAssistance(event.target.value)} maxLength={4000} rows={2} /></label>
        <label>{t(locale, 'residentPreferences')}<textarea value={preferences} onChange={(event) => setPreferences(event.target.value)} maxLength={4000} rows={2} /></label>
        <label>{t(locale, 'budget')}<Input inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
        <p className="helper-text">{t(locale, 'setupNote')}</p>
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="setup-actions"><Button type="button" variant="outline" onClick={onBack}>{t(locale, 'back')}</Button><Button type="submit" className="primary-action">{t(locale, 'createProject')}</Button></div>
      </form>
    </main>
  )
}
