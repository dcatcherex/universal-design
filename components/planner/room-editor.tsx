'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { getPrimaryRoom, withPrimaryRoom } from '@/lib/planner/layout-access'
import { formatLength, parseLength } from '@/lib/planner/units'
import type { DoorHandle, FloorSurface, Layout, Locale, Opening, RoomSpace, Wall, WetZone } from '@/lib/planner/types'
import { MeasureField } from './measure-field'

const WALLS: { value: Wall; label: MessageKey }[] = [
  { value: 'north', label: 'wallNorth' }, { value: 'east', label: 'wallEast' }, { value: 'south', label: 'wallSouth' }, { value: 'west', label: 'wallWest' },
]
const OPERATIONS: { value: NonNullable<Opening['operation']>; label: MessageKey }[] = [
  { value: 'hinged-in', label: 'opHingedIn' }, { value: 'hinged-out', label: 'opHingedOut' }, { value: 'sliding', label: 'opSliding' },
]
const HANDLES: { value: DoorHandle['type']; label: MessageKey }[] = [
  { value: 'lever', label: 'handleLever' }, { value: 'knob', label: 'handleKnob' }, { value: 'pull', label: 'handlePull' }, { value: 'none', label: 'handleNone' }, { value: 'unknown', label: 'handleUnknown' },
]
const FLOOR_FINISHES: { value: FloorSurface['finish']; label: MessageKey }[] = [
  { value: 'unknown', label: 'finishUnknown' }, { value: 'tile', label: 'finishTile' }, { value: 'wood', label: 'finishWood' }, { value: 'vinyl', label: 'finishVinyl' }, { value: 'concrete', label: 'finishConcrete' }, { value: 'other', label: 'finishOther' },
]
const SLIP: { value: FloorSurface['slipResistance']; label: MessageKey }[] = [
  { value: 'unknown', label: 'slipUnknown' }, { value: 'slip-resistant', label: 'slipResistant' }, { value: 'not-slip-resistant', label: 'slipNotResistant' },
]

type Props = { layout: Layout; locale: Locale; editable: boolean; advisorMode?: boolean; selectionId?: string | null; onCommit(layout: Layout): void; onSelect?(id: string | null): void }

function OpeningEditor({ opening, locale, editable, advisorMode, onChange, onRemove }: { opening: Opening; locale: Locale; editable: boolean; advisorMode: boolean; onChange(opening: Opening): void; onRemove(): void }) {
  const door = opening.kind === 'door'
  const handle = opening.handle ?? null
  return <div className="opening-editor">
    <label className="field-label">{t(locale, 'openingWall')}<select value={opening.wall} disabled={!editable} onChange={(event) => onChange({ ...opening, wall: event.target.value as Wall })}>{WALLS.map((wall) => <option key={wall.value} value={wall.value}>{t(locale, wall.label)}</option>)}</select></label>
    <MeasureField label={t(locale, 'openingOffsetCm')} measurement={opening.offset} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={15000} onChange={(value) => value && onChange({ ...opening, offset: value })} />
    <MeasureField label={t(locale, 'openingWidthCm')} measurement={opening.width} locale={locale} editable={editable} advisorMode={advisorMode} min={100} max={15000} onChange={(value) => value && onChange({ ...opening, width: value })} />
    <MeasureField label={t(locale, 'openingHeightCm')} measurement={opening.height} locale={locale} editable={editable} advisorMode={advisorMode} min={100} max={5000} onChange={(value) => value && onChange({ ...opening, height: value })} />
    {!door && <MeasureField label={t(locale, 'openingSillCm')} measurement={opening.sill} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={5000} onChange={(value) => value && onChange({ ...opening, sill: value })} />}
    {door && <>
      <label className="field-label">{t(locale, 'doorOperation')}<select value={opening.operation ?? 'hinged-in'} disabled={!editable} onChange={(event) => onChange({ ...opening, operation: event.target.value as Opening['operation'] })}>{OPERATIONS.map((operation) => <option key={operation.value} value={operation.value}>{t(locale, operation.label)}</option>)}</select></label>
      {opening.operation !== 'sliding' && <label className="field-label">{t(locale, 'doorHinge')}<select value={opening.hinge ?? 'start'} disabled={!editable} onChange={(event) => onChange({ ...opening, hinge: event.target.value as Opening['hinge'] })}><option value="start">{t(locale, 'hingeStart')}</option><option value="end">{t(locale, 'hingeEnd')}</option></select></label>}
      <MeasureField label={t(locale, 'thresholdCm')} measurement={opening.threshold} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={500} onChange={(value) => value && onChange({ ...opening, threshold: value })} />
      <label className="field-label">{t(locale, 'handleType')}<select value={handle?.type ?? ''} disabled={!editable} onChange={(event) => onChange({ ...opening, handle: event.target.value ? { type: event.target.value as DoorHandle['type'], height: handle?.height ?? null } : null })}>
        <option value="">{t(locale, 'handleNotRecorded')}</option>{HANDLES.map((option) => <option key={option.value} value={option.value}>{t(locale, option.label)}</option>)}
      </select></label>
      {handle && handle.type !== 'none' && <MeasureField label={t(locale, 'handleHeightCm')} measurement={handle.height} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={3000} optional onChange={(value) => onChange({ ...opening, handle: { ...handle, height: value } })} />}
    </>}
    <Button type="button" variant="ghost" className="remove-button" disabled={!editable} onClick={onRemove}>{t(locale, 'removeOpening')}</Button>
  </div>
}

function WetZoneEditor({ zone, room, locale, editable, onChange, onRemove }: { zone: WetZone; room: RoomSpace; locale: Locale; editable: boolean; onChange(zone: WetZone): void; onRemove(): void }) {
  const [error, setError] = useState('')
  const fields: { key: keyof WetZone['rect']; label: MessageKey }[] = [
    { key: 'minX', label: 'zoneWestCm' }, { key: 'maxX', label: 'zoneEastCm' }, { key: 'minY', label: 'zoneNorthCm' }, { key: 'maxY', label: 'zoneSouthCm' },
  ]
  function change(key: keyof WetZone['rect'], text: string) {
    const parsed = parseLength(text, 'cm')
    if (!parsed.ok) { setError(t(locale, 'invalidLength')); return }
    const rect = { ...zone.rect, [key]: parsed.value }
    if (rect.minX >= rect.maxX || rect.minY >= rect.maxY || rect.maxX > room.shape.width.valueMm || rect.maxY > room.shape.depth.valueMm) { setError(t(locale, 'wetZoneInvalid')); return }
    setError('')
    onChange({ ...zone, rect })
  }
  return <div className="opening-editor">
    <p className="helper-text">{t(locale, 'wetZoneHelp')}</p>
    <div className="field-grid">{fields.map((field) => <label className="field-label" key={field.key}>{t(locale, field.label)}<Input inputMode="decimal" defaultValue={formatLength(zone.rect[field.key], 'cm', locale)} key={zone.rect[field.key]} disabled={!editable} onBlur={(event) => change(field.key, event.target.value)} /></label>)}</div>
    {error && <p role="alert" className="field-error">{error}</p>}
    <Button type="button" variant="ghost" className="remove-button" disabled={!editable} onClick={onRemove}>{t(locale, 'removeWetZone')}</Button>
  </div>
}

export function RoomEditor({ layout, locale, editable, advisorMode = false, selectionId = null, onCommit, onSelect }: Props) {
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const room = getPrimaryRoom(layout)
  // Selecting a door from a check result opens its editor.
  const expandedId = openId ?? (room.openings.some((opening) => opening.id === selectionId) ? selectionId : null)
  const sizeOf = (field: 'width' | 'depth' | 'height') => field === 'height' ? room.height : room.shape[field]
  const updateRoom = (update: (room: RoomSpace) => RoomSpace) => onCommit(withPrimaryRoom(layout, update))

  function change(field: 'width' | 'depth' | 'height', value: string) {
    const parsed = parseLength(value, 'cm')
    if (!parsed.ok) { setError(t(locale, 'invalidLength')); return }
    const minimum = field === 'height' ? 2000 : 1500
    const maximum = field === 'height' ? 5000 : 15000
    if (parsed.value < minimum || parsed.value > maximum) { setError(t(locale, 'invalidLength')); return }
    const measurement = { valueMm: parsed.value, confidence: 'estimated' as const }
    const next = withPrimaryRoom(layout, (value) => field === 'height' ? { ...value, height: measurement } : { ...value, shape: { ...value.shape, [field]: measurement } })
    const nextRoom = getPrimaryRoom(next)
    const invalidOpening = nextRoom.openings.some((opening) => {
      const wallLength = opening.wall === 'north' || opening.wall === 'south' ? nextRoom.shape.width.valueMm : nextRoom.shape.depth.valueMm
      return opening.offset.valueMm + opening.width.valueMm > wallLength || opening.sill.valueMm + opening.height.valueMm > nextRoom.height.valueMm
    })
    if (invalidOpening) { setError(t(locale, 'openingInvalid')); return }
    setError('')
    onCommit(next)
  }

  function addOpening(kind: Opening['kind']) {
    const estimated = (valueMm: number) => ({ valueMm, confidence: 'estimated' as const })
    const opening: Opening = kind === 'door'
      ? { id: `door-${crypto.randomUUID()}`, kind: 'door', wall: 'north', offset: estimated(0), width: estimated(Math.min(900, room.shape.width.valueMm)), height: estimated(Math.min(2100, room.height.valueMm)), sill: estimated(0), threshold: estimated(0), operation: 'hinged-in', hinge: 'start', handle: null, connectsToRoomId: null }
      : { id: `window-${crypto.randomUUID()}`, kind: 'window', wall: 'south', offset: estimated(0), width: estimated(Math.min(1200, room.shape.width.valueMm)), height: estimated(1200), sill: estimated(900), threshold: estimated(0) }
    updateRoom((value) => ({ ...value, openings: [...value.openings, opening] }))
  }
  const saveOpening = (updated: Opening) => updateRoom((value) => ({ ...value, openings: value.openings.map((opening) => opening.id === updated.id ? updated : opening) }))
  function removeOpening(id: string) {
    setOpenId(null)
    onSelect?.(null)
    updateRoom((value) => ({ ...value, openings: value.openings.filter((opening) => opening.id !== id) }))
  }
  function toggle(id: string) {
    const next = expandedId === id ? null : id
    setOpenId(next)
    onSelect?.(room.openings.some((opening) => opening.id === next) ? next : null)
  }

  function addWetZone() {
    const zone: WetZone = { id: `wet-zone-${crypto.randomUUID()}`, label: t(locale, 'wetZone'), rect: { minX: 0, minY: 0, maxX: Math.round(room.shape.width.valueMm / 2), maxY: room.shape.depth.valueMm } }
    updateRoom((value) => ({ ...value, wetZones: [...value.wetZones, zone] }))
  }

  const fields = [
    { key: 'width' as const, label: t(locale, 'widthCm') },
    { key: 'depth' as const, label: t(locale, 'depthCm') },
  ]
  return <section className="room-editor" id="room-editor" tabIndex={-1} aria-label={t(locale, 'roomMeasurements')}>
    <h3>{t(locale, 'roomMeasurements')}</h3>
    <div className="field-grid">{fields.map(({ key, label }) => <label className="field-label" key={key}>{label}<Input aria-label={label} inputMode="decimal" value={formatLength(sizeOf(key).valueMm, 'cm', locale)} disabled={!editable} onChange={(event) => change(key, event.target.value)} /></label>)}</div>
    <label className="field-label">{t(locale, 'heightCm')}<Input aria-label={t(locale, 'heightCm')} inputMode="decimal" value={formatLength(room.height.valueMm, 'cm', locale)} disabled={!editable} onChange={(event) => change('height', event.target.value)} /></label>
    {error && <p role="alert" className="field-error">{error}</p>}

    <h3>{t(locale, 'floorSurface')}</h3>
    <div className="field-grid">
      <label className="field-label">{t(locale, 'floorFinish')}<select value={room.floor.finish} disabled={!editable} onChange={(event) => updateRoom((value) => ({ ...value, floor: { ...value.floor, finish: event.target.value as FloorSurface['finish'], confidence: 'estimated' } }))}>{FLOOR_FINISHES.map((option) => <option key={option.value} value={option.value}>{t(locale, option.label)}</option>)}</select></label>
      <label className="field-label">{t(locale, 'slipResistance')}<select value={room.floor.slipResistance} disabled={!editable} onChange={(event) => updateRoom((value) => ({ ...value, floor: { ...value.floor, slipResistance: event.target.value as FloorSurface['slipResistance'], confidence: 'estimated' } }))}>{SLIP.map((option) => <option key={option.value} value={option.value}>{t(locale, option.label)}</option>)}</select></label>
    </div>

    <h3>{t(locale, 'openings')}</h3>
    {editable && <div className="opening-actions"><Button type="button" variant="outline" onClick={() => addOpening('door')}>{t(locale, 'addDoor')}</Button><Button type="button" variant="outline" onClick={() => addOpening('window')}>{t(locale, 'addWindow')}</Button></div>}
    <ul className="opening-list">{room.openings.map((opening) => {
      const expanded = expandedId === opening.id
      const name = `${t(locale, opening.kind === 'door' ? 'door' : 'window')} · ${t(locale, WALLS.find((wall) => wall.value === opening.wall)!.label)}`
      return <li key={opening.id} className={expanded ? 'opening-open' : ''}>
        <div className="opening-row"><span>{name}</span><span>{opening.width.valueMm} mm</span><Button type="button" variant="outline" aria-expanded={expanded} aria-label={`${t(locale, expanded ? 'doneEditing' : 'editOpening')}: ${name}`} onClick={() => toggle(opening.id)}>{t(locale, expanded ? 'doneEditing' : 'editOpening')}</Button></div>
        {expanded && <OpeningEditor opening={opening} locale={locale} editable={editable} advisorMode={advisorMode} onChange={saveOpening} onRemove={() => removeOpening(opening.id)} />}
      </li>
    })}</ul>

    {room.type === 'bathroom' && <>
      <h3>{t(locale, 'wetZones')}</h3>
      {editable && <div className="opening-actions"><Button type="button" variant="outline" disabled={room.wetZones.length >= 10} onClick={addWetZone}>{t(locale, 'addWetZone')}</Button></div>}
      <ul className="opening-list">{room.wetZones.map((zone) => {
        const expanded = expandedId === zone.id
        return <li key={zone.id} className={expanded ? 'opening-open' : ''}>
          <div className="opening-row"><span>{zone.label}</span><span>{(zone.rect.maxX - zone.rect.minX) / 10} × {(zone.rect.maxY - zone.rect.minY) / 10} {t(locale, 'unitCm')}</span><Button type="button" variant="outline" aria-expanded={expanded} aria-label={`${t(locale, expanded ? 'doneEditing' : 'editOpening')}: ${zone.label}`} onClick={() => toggle(zone.id)}>{t(locale, expanded ? 'doneEditing' : 'editOpening')}</Button></div>
          {expanded && <WetZoneEditor zone={zone} room={room} locale={locale} editable={editable} onChange={(updated) => updateRoom((value) => ({ ...value, wetZones: value.wetZones.map((candidate) => candidate.id === updated.id ? updated : candidate) }))} onRemove={() => { setOpenId(null); updateRoom((value) => ({ ...value, wetZones: value.wetZones.filter((candidate) => candidate.id !== zone.id) })) }} />}
        </li>
      })}</ul>
    </>}
  </section>
}
