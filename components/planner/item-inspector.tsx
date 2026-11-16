'use client'

import { useMemo, useState } from 'react'
import { thumbnailKey } from '@/lib/planner/scene/thumbnail-key'
import type { MessageKey } from '@/lib/planner/i18n'
import { useThumbnails } from './use-thumbnails'

// Swatch colours mirror the upholstery colour each finish uses in the 3D view.
const FINISHES: { id: FurnitureItem['finish']; label: MessageKey; color: string }[] = [
  { id: 'oak', label: 'finishOak', color: '#e9dfce' },
  { id: 'cream', label: 'finishCream', color: '#f3ecdf' },
  { id: 'sage', label: 'finishSage', color: '#8eab9c' },
  { id: 'charcoal', label: 'finishCharcoal', color: '#7d807b' },
]
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCatalogEntry } from '@/lib/planner/catalog'
import { getPrimaryRoom } from '@/lib/planner/layout-access'
import { MeasureField } from './measure-field'
import { getFootprint } from '@/lib/planner/geometry'
import { t } from '@/lib/planner/i18n'
import { formatLength, parseLength } from '@/lib/planner/units'
import type { FurnitureItem, Layout, Locale } from '@/lib/planner/types'

type Props = { item?: FurnitureItem; layout: Layout; locale: Locale; editable: boolean; advisorMode?: boolean; onCommit(layout: Layout): void; onSelect(id: string | null): void }

export function ItemInspector({ item, layout, locale, editable, advisorMode = false, onCommit, onSelect }: Props) {
  const [error, setError] = useState('')
  const previewItems = useMemo(() => item ? [item] : [], [item])
  const thumbnails = useThumbnails(previewItems)
  const image = item ? thumbnails[thumbnailKey(item)] : undefined
  if (!item) return <section className="inspector-empty"><span className="inspector-icon">⌖</span><p>{t(locale, 'selectItem')}</p></section>

  const catalog = getCatalogEntry(item.catalogId)
  const room = getPrimaryRoom(layout)
  const update = (patch: Partial<FurnitureItem>) => {
    const next = structuredClone(layout)
    const nextRoom = getPrimaryRoom(next)
    nextRoom.items = nextRoom.items.map((candidate) => candidate.id === item.id ? { ...candidate, ...patch } : candidate)
    const updated = nextRoom.items.find((candidate) => candidate.id === item.id)!
    const bounds = getFootprint(updated)
    if (bounds.minX < 0 || bounds.minY < 0 || bounds.maxX > room.shape.width.valueMm || bounds.maxY > room.shape.depth.valueMm) {
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
    const nextRoom = getPrimaryRoom(next)
    nextRoom.items = nextRoom.items.filter((candidate) => candidate.id !== item.id)
    onCommit(next)
    onSelect(null)
  }
  const input = (label: string, value: number, onChange: (value: string) => void) => <label className="field-label">{label}<Input aria-label={label} inputMode="decimal" value={formatLength(value, 'cm', locale)} disabled={!editable} onChange={(event) => onChange(event.target.value)} /></label>

  return <section className="item-inspector" aria-labelledby="selected-item-heading">
    <div className="inspector-hero" aria-hidden="true">{image
      // eslint-disable-next-line @next/next/no-img-element -- generated data URL, not an optimisable asset
      ? <img src={image} alt="" draggable={false} />
      : <span className={`catalog-preview preview-${catalog?.meshKind ?? 'block'}`}><span /></span>}</div>
    <div className="inspector-item-title"><div><p className="eyebrow">{t(locale, 'selectedItem')}</p><h3 id="selected-item-heading">{item.label}</h3></div></div>
    {!editable && <p className="helper-text">{locale === 'th' ? 'ห้องปัจจุบันเป็นแบบอ่านอย่างเดียว เลือกแก้ไขห้องปัจจุบันเพื่อปลดล็อก' : 'Current is read-only. Choose Edit current to make changes.'}</p>}
    <div className="field-grid">{input(t(locale, 'positionX'), item.center.xMm, (value) => updatePosition('xMm', value))}{input(t(locale, 'positionY'), item.center.yMm, (value) => updatePosition('yMm', value))}</div>
    <div className="field-grid">{input(t(locale, 'widthCm'), item.width.valueMm, (value) => updateMeasure('width', value))}{input(t(locale, 'depthCm'), item.depth.valueMm, (value) => updateMeasure('depth', value))}</div>
    {input(t(locale, 'heightCm'), item.height.valueMm, (value) => updateMeasure('height', value))}
    {catalog?.hasSeatHeight && <MeasureField label={t(locale, 'seatHeightCm')} measurement={item.seatHeight ?? null} locale={locale} editable={editable} advisorMode={advisorMode} min={1} max={1500} optional onChange={(seatHeight) => update({ seatHeight })} />}
    <div className="inspector-detail"><span>{t(locale, 'rotation')}</span><strong>{item.rotationDeg}°</strong></div>
    <Button type="button" variant="outline" className="wide-button" disabled={!editable} onClick={() => update({ rotationDeg: ((item.rotationDeg + 90) % 360) as FurnitureItem['rotationDeg'] })}>{t(locale, 'rotate90')}</Button>
    <fieldset className="finish-field" disabled={!editable}>
      <legend>{t(locale, 'finish')}</legend>
      <div className="finish-swatches">{FINISHES.map((finish) => <label key={finish.id} className="finish-swatch" title={t(locale, finish.label)}>
        <input type="radio" name={`finish-${item.id}`} value={finish.id} checked={item.finish === finish.id} onChange={() => update({ finish: finish.id })} />
        <span className="finish-dot" style={{ background: finish.color }} aria-hidden="true" />
        <span className="finish-name">{t(locale, finish.label)}</span>
      </label>)}</div>
    </fieldset>
    {error && <p role="alert" className="field-error">{error}</p>}
    <Button type="button" variant="ghost" className="wide-button remove-button" disabled={!editable} onClick={remove}>{t(locale, 'deleteItem')}</Button>
  </section>
}
