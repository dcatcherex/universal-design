'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { parseLength, formatLength } from '@/lib/planner/units'
import { t } from '@/lib/planner/i18n'
import { getPrimaryFloor, getPrimaryRoom, withPrimaryFloor } from '@/lib/planner/layout-access'
import type { Layout, Locale, PointMm, RoomSpace, RouteOverlay, TurningOverlay } from '@/lib/planner/types'

function parseCoordinate(value: string): number | null {
  const normalized = value.replace(/[๐-๙]/g, (digit) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit))).trim()
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null
  const sign = normalized.startsWith('-') ? -1 : 1
  const magnitude = parseLength(normalized.replace(/^-/, ''), 'cm')
  if (!magnitude.ok) return null
  const result = magnitude.value * sign
  return result < -15000 || result > 30000 ? null : result
}

function toPointDraft(points: PointMm[], locale: Locale) {
  return points.map((point) => ({ x: formatLength(point.xMm, 'cm', locale), y: formatLength(point.yMm, 'cm', locale) }))
}

function PointFields({ point, index, locale, onChange, onRemove, canRemove, editable }: {
  point: { x: string; y: string }; index: number; locale: Locale
  onChange(point: { x: string; y: string }): void; onRemove(): void; canRemove: boolean
  editable: boolean
}) {
  return <fieldset className="overlay-point">
    <legend>{t(locale, 'routePoint')} {index + 1}</legend>
    <div className="field-grid">
      <label className="field-label">{t(locale, 'pointX')}<input type="text" inputMode="decimal" value={point.x} onChange={(event) => onChange({ ...point, x: event.target.value })} disabled={!editable} /></label>
      <label className="field-label">{t(locale, 'pointY')}<input type="text" inputMode="decimal" value={point.y} onChange={(event) => onChange({ ...point, y: event.target.value })} disabled={!editable} /></label>
    </div>
    {canRemove && <Button type="button" variant="ghost" onClick={onRemove} disabled={!editable}>{t(locale, 'removeRoutePoint')}</Button>}
  </fieldset>
}

function RouteEditor({ route, room, locale, editable, onSave, onRemove }: {
  route: RouteOverlay; room: RoomSpace; locale: Locale; editable: boolean; onSave(route: RouteOverlay): void; onRemove(): void
}) {
  const [label, setLabel] = useState(route.label)
  const [width, setWidth] = useState(route.widthMm === null ? '' : formatLength(route.widthMm, 'cm', locale))
  const [points, setPoints] = useState(() => toPointDraft(route.points, locale))
  const [error, setError] = useState(false)
  function save() {
    const converted = points.map((point) => ({ xMm: parseCoordinate(point.x), yMm: parseCoordinate(point.y) }))
    const parsedWidth = width.trim() ? parseLength(width, 'cm') : null
    if (!label.trim() || label.trim().length > 160 || converted.some((point) => point.xMm === null || point.yMm === null)
      || points.length < 2 || points.length > 12 || converted.some((point, index) => index > 0 && point.xMm === converted[index - 1].xMm && point.yMm === converted[index - 1].yMm)
      || (parsedWidth && (!parsedWidth.ok || parsedWidth.value < 100 || parsedWidth.value > 3000))) {
      setError(true)
      return
    }
    const next: RouteOverlay = {
      ...route,
      label: label.trim(),
      widthMm: parsedWidth ? parsedWidth.value : null,
      points: converted.map((point) => ({ xMm: point.xMm!, yMm: point.yMm! })),
    }
    if (next.points.some((point) => point.xMm < -15000 || point.xMm > 30000 || point.yMm < -15000 || point.yMm > 30000)) {
      setError(true)
      return
    }
    setError(false)
    onSave(next)
  }
  function addPoint() {
    if (points.length >= 12) return
    const last = points[points.length - 1]
    const lastX = parseCoordinate(last.x) ?? Math.min(room.shape.width.valueMm, 1000)
    const lastY = parseCoordinate(last.y) ?? Math.min(room.shape.depth.valueMm, 1000)
    const nextX = lastX + 250
    setPoints([...points, { x: formatLength(nextX, 'cm', locale), y: formatLength(lastY, 'cm', locale) }])
  }
  return <article className="overlay-card">
    <header><strong>{t(locale, 'routeOverlay')}</strong><Button type="button" variant="ghost" onClick={onRemove} disabled={!editable}>{t(locale, 'removeOverlay')}</Button></header>
    {!editable && <p className="helper-text">{t(locale, 'currentReadOnly')}</p>}
    <label className="field-label">{t(locale, 'routeLabel')}<input value={label} onChange={(event) => setLabel(event.target.value)} disabled={!editable} /></label>
    <label className="field-label">{t(locale, 'routeWidthCm')}<input data-need-focus="walking-route" inputMode="decimal" value={width} onChange={(event) => setWidth(event.target.value)} placeholder="—" disabled={!editable} /></label>
    <div className="overlay-points">{points.map((point, index) => <PointFields key={index} point={point} index={index} locale={locale}
      onChange={(next) => setPoints(points.map((value, pointIndex) => pointIndex === index ? next : value))}
      onRemove={() => setPoints(points.filter((_, pointIndex) => pointIndex !== index))} canRemove={points.length > 2} editable={editable} />)}</div>
    <div className="overlay-actions"><Button type="button" variant="outline" onClick={addPoint} disabled={!editable || points.length >= 12}>{t(locale, 'addRoutePoint')}</Button><Button type="button" onClick={save} disabled={!editable}>{t(locale, 'saveOverlay')}</Button></div>
    {error && <p role="alert" className="field-error">{t(locale, 'overlayInputError')}</p>}
  </article>
}

function TurningEditor({ area, locale, editable, onSave, onRemove }: {
  area: TurningOverlay; locale: Locale; editable: boolean; onSave(area: TurningOverlay): void; onRemove(): void
}) {
  const [label, setLabel] = useState(area.label)
  const [x, setX] = useState(formatLength(area.center.xMm, 'cm', locale))
  const [y, setY] = useState(formatLength(area.center.yMm, 'cm', locale))
  const [diameter, setDiameter] = useState(area.diameterMm === null ? '' : formatLength(area.diameterMm, 'cm', locale))
  const [error, setError] = useState(false)
  function save() {
    const xMm = parseCoordinate(x), yMm = parseCoordinate(y)
    const size = diameter.trim() ? parseLength(diameter, 'cm') : null
    if (!label.trim() || label.trim().length > 160 || xMm === null || yMm === null
      || (size && (!size.ok || size.value < 100 || size.value > 4000))) { setError(true); return }
    setError(false)
    onSave({ ...area, label: label.trim(), center: { xMm, yMm }, diameterMm: size ? size.value : null })
  }
  return <article className="overlay-card">
    <header><strong>{t(locale, 'turningOverlay')}</strong><Button type="button" variant="ghost" onClick={onRemove} disabled={!editable}>{t(locale, 'removeOverlay')}</Button></header>
    {!editable && <p className="helper-text">{t(locale, 'currentReadOnly')}</p>}
    <label className="field-label">{t(locale, 'routeLabel')}<input value={label} onChange={(event) => setLabel(event.target.value)} disabled={!editable} /></label>
    <div className="field-grid">
      <label className="field-label">{t(locale, 'pointX')}<input inputMode="decimal" value={x} onChange={(event) => setX(event.target.value)} disabled={!editable} /></label>
      <label className="field-label">{t(locale, 'pointY')}<input inputMode="decimal" value={y} onChange={(event) => setY(event.target.value)} disabled={!editable} /></label>
    </div>
    <label className="field-label">{t(locale, 'turningDiameterCm')}<input data-need-focus="turning-area" inputMode="decimal" value={diameter} onChange={(event) => setDiameter(event.target.value)} placeholder="—" disabled={!editable} /></label>
    <Button type="button" onClick={save} disabled={!editable}>{t(locale, 'saveOverlay')}</Button>
    {error && <p role="alert" className="field-error">{t(locale, 'overlayInputError')}</p>}
  </article>
}

export function OverlayEditor({ layout, locale, editable, onCommit, onStartDrawing }: { layout: Layout; locale: Locale; editable: boolean; onCommit(layout: Layout): void; onStartDrawing(type: 'route' | 'turning'): void }) {
  // Overlays belong to the floor and use floor coordinates. With one room at the origin these equal room coordinates.
  const floor = getPrimaryFloor(layout)
  const room = getPrimaryRoom(layout)
  const roomWidth = room.shape.width.valueMm, roomDepth = room.shape.depth.valueMm
  const setRoutes = (update: (routes: RouteOverlay[]) => RouteOverlay[]) => onCommit(withPrimaryFloor(layout, (value) => ({ ...value, routes: update(value.routes) })))
  const setTurning = (update: (areas: TurningOverlay[]) => TurningOverlay[]) => onCommit(withPrimaryFloor(layout, (value) => ({ ...value, turningAreas: update(value.turningAreas) })))
  const saveRoute = (updated: RouteOverlay) => setRoutes((routes) => routes.map((route) => route.id === updated.id ? updated : route))
  const removeRoute = (id: string) => setRoutes((routes) => routes.filter((route) => route.id !== id))
  function addRoute() {
    if (floor.routes.length >= 20) return
    const insetX = Math.min(500, Math.floor(roomWidth / 4))
    const insetY = Math.min(500, Math.floor(roomDepth / 4))
    const route: RouteOverlay = {
      id: `route-${crypto.randomUUID()}`, label: t(locale, 'routeOverlay'),
      points: [{ xMm: room.origin.xMm + insetX, yMm: room.origin.yMm + insetY }, { xMm: room.origin.xMm + roomWidth - insetX, yMm: room.origin.yMm + insetY }], widthMm: null,
    }
    setRoutes((routes) => [...routes, route])
  }
  function addTurning() {
    if (floor.turningAreas.length >= 20) return
    const area: TurningOverlay = {
      id: `turning-${crypto.randomUUID()}`, label: t(locale, 'turningOverlay'),
      center: { xMm: room.origin.xMm + Math.round(roomWidth / 2), yMm: room.origin.yMm + Math.round(roomDepth / 2) }, diameterMm: null,
    }
    setTurning((areas) => [...areas, area])
  }
  const saveTurning = (updated: TurningOverlay) => setTurning((areas) => areas.map((area) => area.id === updated.id ? updated : area))
  const removeTurning = (id: string) => setTurning((areas) => areas.filter((area) => area.id !== id))
  return <section className="overlay-editor" id="overlay-instructions" tabIndex={-1} aria-labelledby="overlay-editor-title">
    <header><h2 id="overlay-editor-title">{t(locale, 'overlayTitle')}</h2></header>
    {!editable && <p className="helper-text">{t(locale, 'currentReadOnly')}</p>}
    <div className="overlay-add-actions"><Button type="button" variant="outline" onClick={() => onStartDrawing('route')} disabled={!editable || floor.routes.length >= 20}>{t(locale, 'drawRoute')}</Button><Button type="button" variant="outline" onClick={addRoute} disabled={!editable || floor.routes.length >= 20}>{t(locale, 'addRoute')}</Button><Button type="button" variant="outline" onClick={() => onStartDrawing('turning')} disabled={!editable || floor.turningAreas.length >= 20}>{t(locale, 'drawTurning')}</Button><Button type="button" variant="outline" onClick={addTurning} disabled={!editable || floor.turningAreas.length >= 20}>{t(locale, 'addTurning')}</Button></div>
    {!floor.routes.length && <p className="helper-text">{t(locale, 'noRoutes')}</p>}
    {floor.routes.map((route) => <RouteEditor key={`${route.id}-${JSON.stringify(route)}`} route={route} room={room} locale={locale} editable={editable} onSave={saveRoute} onRemove={() => removeRoute(route.id)} />)}
    {!floor.turningAreas.length && <p className="helper-text">{t(locale, 'noTurningAreas')}</p>}
    {floor.turningAreas.map((area) => <TurningEditor key={`${area.id}-${JSON.stringify(area)}`} area={area} locale={locale} editable={editable} onSave={saveTurning} onRemove={() => removeTurning(area.id)} />)}
  </section>
}
