'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/planner/i18n'
import { formatLength, parseLength } from '@/lib/planner/units'
import type { Layout, Locale } from '@/lib/planner/types'

export function RoomEditor({ layout, locale, editable, onCommit }: { layout: Layout; locale: Locale; editable: boolean; onCommit(layout: Layout): void }) {
  const [error, setError] = useState('')
  const fields = [
    { key: 'width' as const, label: t(locale, 'widthCm') },
    { key: 'depth' as const, label: t(locale, 'depthCm') },
    { key: 'height' as const, label: t(locale, 'heightCm') },
  ]
  function change(field: 'width' | 'depth' | 'height', value: string) {
    const parsed = parseLength(value, 'cm')
    if (!parsed.ok) { setError(t(locale, 'invalidLength')); return }
    const minimum = field === 'height' ? 2000 : 1500
    const maximum = field === 'height' ? 5000 : 15000
    if (parsed.value < minimum || parsed.value > maximum) { setError(t(locale, 'invalidLength')); return }
    const next = structuredClone(layout)
    next.room[field] = { valueMm: parsed.value, confidence: 'estimated' }
    const invalidOpening = next.openings.some((opening) => {
      const wallLength = opening.wall === 'north' || opening.wall === 'south' ? next.room.width.valueMm : next.room.depth.valueMm
      return opening.offset.valueMm + opening.width.valueMm > wallLength || opening.sill.valueMm + opening.height.valueMm > next.room.height.valueMm
    })
    if (invalidOpening) { setError(t(locale, 'openingInvalid')); return }
    setError('')
    onCommit(next)
  }
  return <section className="room-editor" id="room-editor" tabIndex={-1} aria-label={t(locale, 'roomMeasurements')}>
    <h3>{t(locale, 'roomMeasurements')}</h3>
    <div className="field-grid">{fields.slice(0, 2).map(({ key, label }) => <label className="field-label" key={key}>{label}<Input aria-label={label} inputMode="decimal" value={formatLength(layout.room[key].valueMm, 'cm', locale)} disabled={!editable} onChange={(event) => change(key, event.target.value)} /></label>)}</div>
    <label className="field-label">{t(locale, 'heightCm')}<Input aria-label={t(locale, 'heightCm')} inputMode="decimal" value={formatLength(layout.room.height.valueMm, 'cm', locale)} disabled={!editable} onChange={(event) => change('height', event.target.value)} /></label>
    {error && <p role="alert" className="field-error">{error}</p>}
    {editable && <div className="opening-actions"><Button type="button" variant="outline" onClick={() => {
      const next = structuredClone(layout)
      next.openings.push({ id: `door-${crypto.randomUUID()}`, kind: 'door', wall: 'north', offset: { valueMm: 0, confidence: 'estimated' }, width: { valueMm: 900, confidence: 'estimated' }, height: { valueMm: 2100, confidence: 'estimated' }, sill: { valueMm: 0, confidence: 'estimated' }, threshold: { valueMm: 0, confidence: 'estimated' }, operation: 'hinged-in', hinge: 'start' })
      onCommit(next)
    }}>{t(locale, 'addDoor')}</Button><Button type="button" variant="outline" onClick={() => {
      const next = structuredClone(layout)
      next.openings.push({ id: `window-${crypto.randomUUID()}`, kind: 'window', wall: 'south', offset: { valueMm: 0, confidence: 'estimated' }, width: { valueMm: 1200, confidence: 'estimated' }, height: { valueMm: 1200, confidence: 'estimated' }, sill: { valueMm: 900, confidence: 'estimated' }, threshold: { valueMm: 0, confidence: 'estimated' } })
      onCommit(next)
    }}>{t(locale, 'addWindow')}</Button></div>}
    <ul className="opening-list">{layout.openings.map((opening) => <li key={opening.id}><span>{opening.kind === 'door' ? (locale === 'th' ? 'ประตู' : 'Door') : (locale === 'th' ? 'หน้าต่าง' : 'Window')} · {opening.wall}</span><span>{opening.width.valueMm} mm</span></li>)}</ul>
  </section>
}
