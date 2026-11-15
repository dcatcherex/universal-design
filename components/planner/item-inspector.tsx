'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATALOG } from '@/lib/planner/catalog'
import { getFootprint } from '@/lib/planner/geometry'
import { t } from '@/lib/planner/i18n'
import { formatLength, parseLength } from '@/lib/planner/units'
import type { FurnitureItem, Layout, Locale } from '@/lib/planner/types'

type Props = { item?: FurnitureItem; layout: Layout; locale: Locale; editable: boolean; onCommit(layout: Layout): void; onSelect(id: string | null): void }

export function ItemInspector({ item, layout, locale, editable, onCommit, onSelect }: Props) {
  const [error, setError] = useState('')
  if (!item) return <section className="inspector-empty"><span className="inspector-icon">⌖</span><p>{t(locale, 'selectItem')}</p></section>

  const catalog = CATALOG.find((entry) => entry.id === item.catalogId)
  const update = (patch: Partial<FurnitureItem>) => {
    const next = structuredClone(layout)
    next.items = next.items.map((candidate) => candidate.id === item.id ? { ...candidate, ...patch } : candidate)
    const updated = next.items.find((candidate) => candidate.id === item.id)!
    const bounds = getFootprint(updated)
    if (bounds.minX < 0 || bounds.minY < 0 || bounds.maxX > layout.room.width.valueMm || bounds.maxY > layout.room.depth.valueMm) {
      setError(t(locale, 'outOfBounds'))
      return
    }
    setError('')
    onCommit(next)
  }
  const updatePosition = (axis: 'xMm' | 'yMm', text: string) => {
    const parsed = parseLength(text, 'cm')
    if (!parsed.ok) { setError(t(locale, 'invalidLength')); return }
    update({ center: { ...item.center, [axis]: parsed.value } })
  }
  const updateMeasure = (field: 'width' | 'depth' | 'height', text: string) => {
    const parsed = parseLength(text, 'cm')
    if (!parsed.ok) { setError(t(locale, 'invalidLength')); return }
    const minimum = field === 'height' ? 1 : 100
    const maximum = field === 'height' ? 3000 : 5000
    if (parsed.value < minimum || parsed.value > maximum) { setError(t(locale, 'invalidLength')); return }
    update({ [field]: { valueMm: parsed.value, confidence: 'estimated' } })
  }
  const remove = () => {
    const next = structuredClone(layout)
    next.items = next.items.filter((candidate) => candidate.id !== item.id)
    onCommit(next)
    onSelect(null)
  }
  const input = (label: string, value: number, onChange: (value: string) => void) => <label className="field-label">{label}<Input aria-label={label} inputMode="decimal" value={formatLength(value, 'cm', locale)} disabled={!editable} onChange={(event) => onChange(event.target.value)} /></label>

  return <section className="item-inspector" aria-labelledby="selected-item-heading">
    <div className="inspector-item-title"><span className={`catalog-preview preview-${catalog?.meshKind ?? 'block'}`} aria-hidden="true"><span /></span><div><p className="eyebrow">{t(locale, 'selectedItem')}</p><h3 id="selected-item-heading">{item.label}</h3></div></div>
    {!editable && <p className="helper-text">{locale === 'th' ? 'ห้องปัจจุบันเป็นแบบอ่านอย่างเดียว เลือกแก้ไขห้องปัจจุบันเพื่อปลดล็อก' : 'Current is read-only. Choose Edit current to make changes.'}</p>}
    <div className="field-grid">{input(t(locale, 'positionX'), item.center.xMm, (value) => updatePosition('xMm', value))}{input(t(locale, 'positionY'), item.center.yMm, (value) => updatePosition('yMm', value))}</div>
    <div className="field-grid">{input(t(locale, 'widthCm'), item.width.valueMm, (value) => updateMeasure('width', value))}{input(t(locale, 'depthCm'), item.depth.valueMm, (value) => updateMeasure('depth', value))}</div>
    {input(t(locale, 'heightCm'), item.height.valueMm, (value) => updateMeasure('height', value))}
    <div className="inspector-detail"><span>{t(locale, 'rotation')}</span><strong>{item.rotationDeg}°</strong></div>
    <Button type="button" variant="outline" className="wide-button" disabled={!editable} onClick={() => update({ rotationDeg: ((item.rotationDeg + 90) % 360) as FurnitureItem['rotationDeg'] })}>{t(locale, 'rotate90')}</Button>
    <label className="field-label">{t(locale, 'finish')}<select value={item.finish} disabled={!editable} onChange={(event) => update({ finish: event.target.value as FurnitureItem['finish'] })}>
      <option value="oak">{locale === 'th' ? 'ไม้โอ๊ก' : 'Oak'}</option><option value="cream">{locale === 'th' ? 'ครีม' : 'Cream'}</option><option value="sage">{locale === 'th' ? 'เขียวเสจ' : 'Sage'}</option><option value="charcoal">{locale === 'th' ? 'ถ่าน' : 'Charcoal'}</option>
    </select></label>
    {error && <p role="alert" className="field-error">{error}</p>}
    <Button type="button" variant="ghost" className="wide-button remove-button" disabled={!editable} onClick={remove}>{t(locale, 'deleteItem')}</Button>
  </section>
}
