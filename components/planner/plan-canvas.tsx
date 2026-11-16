'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { getDoorSwing, getFixtureSpan, getFootprint, type DoorSector } from '@/lib/planner/geometry'
import { getPrimaryFloor, getPrimaryRoom, toRoomPoint } from '@/lib/planner/layout-access'
import type { FallRecord, FurnitureItem, Layout, Locale, PointMm, Wall } from '@/lib/planner/types'
import { t } from '@/lib/planner/i18n'

type Placement = { catalogId: string; label: string; widthMm: number; depthMm: number; heightMm: number; finish: FurnitureItem['finish']; obstruction: FurnitureItem['obstruction'] }
type OverlayTool = 'route' | 'turning' | null
type Props = {
  layout: Layout; locale: Locale; selectionId: string | null; routeTargetMm?: number | null; turningTargetMm?: number | null
  placement?: Placement | null; overlayTool?: OverlayTool
  /** Recorded falls to mark. Their points are in this room's coordinates. */
  falls?: FallRecord[]
  /** True while the user is picking where a fall happened. */
  pickingFall?: boolean
  /** Entities to outline, e.g. what a fix preview would change. */
  highlightIds?: readonly string[]
  onSelect(id: string | null): void; onCommitLayout(layout: Layout): void; onPlace(center: { xMm: number; yMm: number }): void; onCancelPlacement(): void
  onPlaceRoute(points: PointMm[]): void; onPlaceTurning(center: PointMm): void; onCancelOverlay(): void
  onPickFall?(point: PointMm): void; onCancelPickFall?(): void
  /** Clicking a wall line picks that wall, e.g. to open its elevation. */
  onSelectWall?(wall: Wall): void
}
type Preview = { id: string; xMm: number; yMm: number }

function sectorPath(sector: DoorSector): string {
  const { hinge, radiusMm, startAngleDeg, sweepDeg } = sector
  const radians1 = startAngleDeg * Math.PI / 180
  const radians2 = (startAngleDeg + sweepDeg) * Math.PI / 180
  const endX = hinge.xMm + radiusMm * Math.cos(radians2)
  const endY = hinge.yMm + radiusMm * Math.sin(radians2)
  const startX = hinge.xMm + radiusMm * Math.cos(radians1)
  const startY = hinge.yMm + radiusMm * Math.sin(radians1)
  return `M ${hinge.xMm} ${hinge.yMm} L ${startX} ${startY} A ${radiusMm} ${radiusMm} 0 0 ${sweepDeg > 0 ? 1 : 0} ${endX} ${endY} Z`
}

function FurnitureShape({ item, selected, highlighted, xMm, yMm, scale, onPointerDown, onKeyDown, label }: {
  item: FurnitureItem; selected: boolean; highlighted: boolean; xMm: number; yMm: number; scale: number; onPointerDown(event: ReactPointerEvent<SVGGElement>, item: FurnitureItem): void;
  onKeyDown(event: KeyboardEvent<SVGGElement>, item: FurnitureItem): void; label: string
}) {
  const width = item.rotationDeg % 180 === 0 ? item.width.valueMm : item.depth.valueMm
  const depth = item.rotationDeg % 180 === 0 ? item.depth.valueMm : item.width.valueMm
  const className = item.obstruction === 'rug' ? 'plan-rug' : `plan-item finish-${item.finish}`
  const inset = 60 * scale
  return <g
    role="button" tabIndex={0} aria-label={label} aria-pressed={selected}
    data-item-id={item.id} data-x-mm={xMm} data-y-mm={yMm} data-rotation={item.rotationDeg}
    className={`${className} ${selected ? 'selected' : ''} ${highlighted ? 'changed' : ''}`}
    transform={`translate(${xMm} ${yMm}) rotate(${item.rotationDeg})`}
    onPointerDown={(event) => onPointerDown(event, item)} onKeyDown={(event) => onKeyDown(event, item)}
  >
    <rect x={-item.width.valueMm / 2} y={-item.depth.valueMm / 2} width={item.width.valueMm} height={item.depth.valueMm} rx={(item.obstruction === 'rug' ? 120 : 80) * scale} />
    <rect className="item-inset" x={-item.width.valueMm / 2 + inset} y={-item.depth.valueMm / 2 + inset} width={Math.max(0, item.width.valueMm - inset * 2)} height={Math.max(0, item.depth.valueMm - inset * 2)} rx={60 * scale} />
    {/* The label stays upright and below the piece whatever its rotation. */}
    <text textAnchor="middle" dominantBaseline="central" transform={`rotate(${-item.rotationDeg})`} y={depth / 2 + 140 * scale}>{item.label}</text>
    <title>{`${item.label} · ${width} × ${depth} mm`}</title>
  </g>
}

export function PlanCanvas({ layout, locale, selectionId, routeTargetMm, turningTargetMm, placement, overlayTool = null, falls = [], pickingFall = false, highlightIds = [], onSelect, onCommitLayout, onPlace, onCancelPlacement, onPlaceRoute, onPlaceTurning, onCancelOverlay, onPickFall, onCancelPickFall, onSelectWall }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; xMm: number; yMm: number } | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [overlayCursor, setOverlayCursor] = useState<PointMm | null>(null)
  const [routeDraft, setRouteDraft] = useState<{ tool: OverlayTool; points: PointMm[] }>({ tool: null, points: [] })
  const [message, setMessage] = useState('')
  const room = getPrimaryRoom(layout)
  const floor = getPrimaryFloor(layout)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  // Line weights and labels are sized for a 6 m room; smaller rooms scale them down so a bathroom stays legible.
  const scale = Math.max(0.4, Math.min(1, Math.max(width, depth) / 6000))
  const snap = (value: number) => Math.round(value / 50) * 50

  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !(dragRef.current || placement || overlayTool || pickingFall)) return
      if (dragRef.current) {
        dragRef.current = null
        setPreview(null)
        setMessage('')
      }
      if (placement) onCancelPlacement()
      if (pickingFall) onCancelPickFall?.()
      if (overlayTool) {
        setRouteDraft({ tool: null, points: [] })
        setOverlayCursor(null)
        onCancelOverlay()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [placement, overlayTool, pickingFall, onCancelPlacement, onCancelOverlay, onCancelPickFall])

  function modelPoint(event: { clientX: number; clientY: number }) {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return { xMm: 0, yMm: 0 }
    return { xMm: (event.clientX - bounds.left) / bounds.width * width, yMm: (event.clientY - bounds.top) / bounds.height * depth }
  }
  const clampToRoom = (point: PointMm): PointMm => ({ xMm: Math.min(width, Math.max(0, snap(point.xMm))), yMm: Math.min(depth, Math.max(0, snap(point.yMm))) })

  function onItemPointerDown(event: ReactPointerEvent<SVGGElement>, item: FurnitureItem) {
    if (pickingFall || placement || overlayTool) return
    event.stopPropagation()
    onSelect(item.id)
    dragRef.current = { id: item.id, xMm: item.center.xMm, yMm: item.center.yMm }
    ;(event.currentTarget as SVGGElement).setPointerCapture(event.pointerId)
    setPreview({ id: item.id, xMm: item.center.xMm, yMm: item.center.yMm })
  }

  function findItem(id: string) { return room.items.find((item) => item.id === id) }
  function commitMovedItem(moved: FurnitureItem) {
    const next = structuredClone(layout)
    const nextRoom = getPrimaryRoom(next)
    nextRoom.items = nextRoom.items.map((candidate) => candidate.id === moved.id ? moved : candidate)
    onCommitLayout(next)
  }
  function outsideRoom(item: FurnitureItem) {
    const fp = getFootprint(item)
    return fp.minX < 0 || fp.minY < 0 || fp.maxX > width || fp.maxY > depth
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (overlayTool) { setOverlayCursor(clampToRoom(modelPoint(event))); return }
    if (placement) {
      const point = modelPoint(event)
      setPreview({ id: '__placement__', xMm: snap(point.xMm), yMm: snap(point.yMm) })
      return
    }
    if (!dragRef.current) return
    const point = modelPoint(event)
    const item = findItem(dragRef.current.id)
    if (!item) return
    const xMm = snap(point.xMm)
    const yMm = snap(point.yMm)
    dragRef.current = { ...dragRef.current, xMm, yMm }
    setPreview({ id: item.id, xMm, yMm })
  }

  function onPointerUp() {
    if (!dragRef.current) return
    const dropped = dragRef.current
    const item = findItem(dragRef.current.id)
    dragRef.current = null
    setPreview(null)
    if (!item) return
    const moved = { ...item, center: { xMm: dropped.xMm, yMm: dropped.yMm } }
    if (outsideRoom(moved)) {
      setMessage(t(locale, 'outOfBounds'))
      return
    }
    commitMovedItem(moved)
    setMessage('')
  }

  function keyboardMove(event: KeyboardEvent<SVGGElement>, item: FurnitureItem) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const delta = event.shiftKey ? 50 : 10
    const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0
    const dy = event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0
    const moved = { ...item, center: { xMm: item.center.xMm + dx, yMm: item.center.yMm + dy } }
    if (outsideRoom(moved)) return
    commitMovedItem(moved)
  }

  const openingGaps = room.openings.map((opening) => {
    const horizontal = opening.wall === 'north' || opening.wall === 'south'
    const lineProps = horizontal
      ? { x1: opening.offset.valueMm, y1: opening.wall === 'north' ? 0 : depth, x2: opening.offset.valueMm + opening.width.valueMm, y2: opening.wall === 'north' ? 0 : depth }
      : { x1: opening.wall === 'west' ? 0 : width, y1: opening.offset.valueMm, x2: opening.wall === 'west' ? 0 : width, y2: opening.offset.valueMm + opening.width.valueMm }
    const swing = getDoorSwing(opening, room)
    const selected = selectionId === opening.id
    return <g key={opening.id} role="group" data-opening-id={opening.id} className={`${selected ? 'opening-selected' : ''} ${highlightIds.includes(opening.id) ? 'changed' : ''}`} aria-label={opening.kind === 'door' ? (locale === 'th' ? 'ประตู' : 'Door') : (locale === 'th' ? 'หน้าต่าง' : 'Window')}>
      {swing && <path d={sectorPath(swing.sector)} className={`door-swing ${swing.outward ? 'door-swing-out' : ''}`} />}
      <line {...lineProps} className="opening-gap" />
      <line {...lineProps} className="opening-line" />
    </g>
  })

  const wallLines: { wall: Wall; x1: number; y1: number; x2: number; y2: number }[] = [
    { wall: 'north', x1: 0, y1: 0, x2: width, y2: 0 }, { wall: 'south', x1: 0, y1: depth, x2: width, y2: depth },
    { wall: 'west', x1: 0, y1: 0, x2: 0, y2: depth }, { wall: 'east', x1: width, y1: 0, x2: width, y2: depth },
  ]
  const wallName = (wall: Wall) => t(locale, wall === 'north' ? 'wallNorth' : wall === 'south' ? 'wallSouth' : wall === 'east' ? 'wallEast' : 'wallWest')
  const busy = !!placement || !!overlayTool || pickingFall
  const style = { '--k': scale } as CSSProperties

  return <div className="canvas-wrap">
    <div className="canvas-caption"><div><p className="eyebrow">{t(locale, 'roomPlan')}</p><span>{(width / 1000).toFixed(2)} × {(depth / 1000).toFixed(2)} m</span>{placement && <span className="placement-hint"> · {t(locale, 'placingHint')}</span>}{overlayTool && <span className="placement-hint"> · {t(locale, 'drawingHint')}</span>}{pickingFall && <span className="placement-hint"> · {t(locale, 'fallPickHint')}</span>}</div>{overlayTool === 'route' ? <div className="overlay-canvas-actions"><Button type="button" onClick={() => { if (routeDraft.tool !== 'route' || routeDraft.points.length < 2) { setMessage(t(locale, 'drawingNeedTwoPoints')); return } onPlaceRoute(routeDraft.points); setRouteDraft({ tool: null, points: [] }); setOverlayCursor(null) }} disabled={routeDraft.tool !== 'route' || routeDraft.points.length < 2}>{t(locale, 'finishRoute')}</Button><Button type="button" variant="outline" onClick={() => { setRouteDraft({ tool: null, points: [] }); setOverlayCursor(null); onCancelOverlay() }}>{t(locale, 'cancelDrawing')}</Button></div> : overlayTool === 'turning' ? <Button type="button" variant="outline" onClick={onCancelOverlay}>{t(locale, 'cancelDrawing')}</Button> : pickingFall ? <Button type="button" variant="outline" onClick={() => onCancelPickFall?.()}>{t(locale, 'cancelDrawing')}</Button> : <span className="confidence-pill">{t(locale, 'estimated')}</span>}</div>
    <div className="canvas-stage">
      <svg ref={svgRef} style={style} role="group" aria-label={`${t(locale, 'roomPlan')} ${(width / 1000).toFixed(1)} × ${(depth / 1000).toFixed(1)} m`} viewBox={`0 0 ${width} ${depth}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={(event) => {
        if (pickingFall) {
          event.stopPropagation()
          const point = modelPoint(event)
          onPickFall?.({ xMm: Math.min(width, Math.max(0, Math.round(point.xMm / 10) * 10)), yMm: Math.min(depth, Math.max(0, Math.round(point.yMm / 10) * 10)) })
          return
        }
        if (placement) {
          event.stopPropagation()
          const point = modelPoint(event)
          const center = { xMm: snap(point.xMm), yMm: snap(point.yMm) }
          const footprint = getFootprint({ id: 'preview', catalogId: placement.catalogId, label: placement.label, center, width: { valueMm: placement.widthMm, confidence: 'estimated' }, depth: { valueMm: placement.depthMm, confidence: 'estimated' }, height: { valueMm: placement.heightMm, confidence: 'estimated' }, rotationDeg: 0, finish: placement.finish, obstruction: placement.obstruction })
          if (footprint.minX < 0 || footprint.minY < 0 || footprint.maxX > width || footprint.maxY > depth) { setMessage(t(locale, 'outOfBounds')); return }
          setMessage('')
          onPlace(center)
          setPreview(null)
          return
        }
        if (overlayTool) {
          const center = clampToRoom(modelPoint(event))
          if (overlayTool === 'turning') {
            onPlaceTurning(center)
            setOverlayCursor(null)
          } else {
            const points = routeDraft.tool === 'route' ? routeDraft.points : []
            setRouteDraft({ tool: 'route', points: [...points, center].slice(0, 12) })
          }
          return
        }
        if (!dragRef.current && event.target === event.currentTarget) onSelect(null)
      }}>
        <defs><pattern id="room-grid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#d9e1d5" strokeWidth={8 * scale} /></pattern><filter id="item-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy={24 * scale} stdDeviation={18 * scale} floodColor="#21382d" floodOpacity=".12" /></filter></defs>
        <rect width={width} height={depth} rx={24 * scale} className="room-floor" />
        <rect width={width} height={depth} rx={24 * scale} fill="url(#room-grid)" />
        {room.wetZones.map((zone) => <g key={zone.id} data-wet-zone-id={zone.id} className={`wet-zone ${highlightIds.includes(zone.id) ? 'changed' : ''}`} pointerEvents="none">
          <rect x={zone.rect.minX} y={zone.rect.minY} width={zone.rect.maxX - zone.rect.minX} height={zone.rect.maxY - zone.rect.minY} />
          <text x={zone.rect.minX + 60 * scale} y={zone.rect.minY + 150 * scale}>{zone.label}</text>
        </g>)}
        {floor.routes.map((route) => {
          const widthMm = route.widthMm ?? routeTargetMm ?? null
          const selected = selectionId === route.id
          const points = route.points.map((point) => toRoomPoint(room, point)).map((point) => `${point.xMm},${point.yMm}`).join(' ')
          return <g key={route.id} role="button" tabIndex={busy ? -1 : 0} aria-label={`${t(locale, 'routeOverlay')}: ${route.label}`} aria-pressed={selected} data-overlay-id={route.id} className={`route-overlay ${selected ? 'selected' : ''}`} pointerEvents={busy ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(route.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(route.id) } }}>
            <polyline points={points} fill="none" stroke={selected ? '#315f46' : '#628c72'} strokeOpacity={widthMm === null ? '.75' : '.18'} strokeWidth={widthMm ?? 28 * scale} strokeDasharray={widthMm === null ? `${100 * scale} ${70 * scale}` : undefined} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={points} fill="none" stroke={selected ? '#315f46' : '#628c72'} strokeOpacity={selected ? '.95' : '.7'} strokeWidth={(selected ? 32 : 14) * scale} strokeDasharray={widthMm === null ? `${80 * scale} ${60 * scale}` : undefined} strokeLinecap="round" strokeLinejoin="round" />
            <title>{`${route.label} · ${widthMm === null ? t(locale, 'checkNotEvaluated') : `${widthMm} mm`}`}</title>
          </g>
        })}
        {floor.turningAreas.map((area) => {
          const diameter = area.diameterMm ?? turningTargetMm ?? null
          const selected = selectionId === area.id
          const center = toRoomPoint(room, area.center)
          return <g key={area.id} role="button" tabIndex={busy ? -1 : 0} aria-label={`${t(locale, 'turningOverlay')}: ${area.label}`} aria-pressed={selected} data-overlay-id={area.id} className={`turning-overlay ${selected ? 'selected' : ''}`} pointerEvents={busy ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(area.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(area.id) } }}>
            <circle cx={center.xMm} cy={center.yMm} r={(diameter ?? 400) / 2} fill={diameter === null ? 'none' : '#75988022'} stroke={selected ? '#315f46' : '#6d9277'} strokeWidth={(selected ? 38 : 24) * scale} strokeDasharray={diameter === null ? `${90 * scale} ${48 * scale}` : undefined} />
            <title>{`${area.label} · ${diameter === null ? t(locale, 'checkNotEvaluated') : `${diameter} mm`}`}</title>
          </g>
        })}
        <rect x="0" y="0" width={width} height={depth} rx={24 * scale} className="room-outline" />
        {onSelectWall && !busy && wallLines.map(({ wall: side, ...line }) => <line key={side} {...line} className="wall-hit" data-wall={side} role="button" tabIndex={0} aria-label={`${t(locale, 'wallView')}: ${wallName(side)}`} onClick={(event) => { event.stopPropagation(); onSelectWall(side) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectWall(side) } }}><title>{`${t(locale, 'wallView')}: ${wallName(side)}`}</title></line>)}
        {openingGaps}
        {room.fixtures.map((fixture) => {
          const { footprint } = getFixtureSpan(fixture, room)
          const selected = selectionId === fixture.id
          const pad = 16 * scale
          const grabBar = fixture.kind.startsWith('grab-bar')
          return <g key={fixture.id} role="button" tabIndex={busy ? -1 : 0} aria-label={`${fixture.label}, ${wallName(fixture.wall)}, ${fixture.referenceHeight.valueMm} mm`} aria-pressed={selected} data-fixture-id={fixture.id} data-fixture-kind={fixture.kind} data-wall={fixture.wall} data-offset-mm={fixture.offset.valueMm} data-height-mm={fixture.referenceHeight.valueMm}
            className={`plan-fixture ${grabBar ? 'plan-fixture-bar' : ''} ${selected ? 'selected' : ''} ${highlightIds.includes(fixture.id) ? 'changed' : ''}`} pointerEvents={busy ? 'none' : undefined}
            onClick={(event) => { event.stopPropagation(); onSelect(fixture.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(fixture.id) } }}>
            <rect x={footprint.minX - pad} y={footprint.minY - pad} width={footprint.maxX - footprint.minX + pad * 2} height={footprint.maxY - footprint.minY + pad * 2} rx={pad} />
            <title>{`${fixture.label} · ${fixture.referenceHeight.valueMm} mm`}</title>
          </g>
        })}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.length > 0 && <polyline className="overlay-draft-route" points={[...routeDraft.points, ...(overlayCursor ? [overlayCursor] : [])].map((point) => `${point.xMm},${point.yMm}`).join(' ')} />}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.map((point, index) => <circle key={index} className="overlay-draft-point" cx={point.xMm} cy={point.yMm} r={55 * scale}><title>{`${t(locale, 'routePoint')} ${index + 1}`}</title></circle>)}
        {overlayTool === 'turning' && overlayCursor && <circle className="overlay-draft-turning" cx={overlayCursor.xMm} cy={overlayCursor.yMm} r="500" />}
        {room.items.map((item) => <FurnitureShape key={item.id} item={item} scale={scale} selected={selectionId === item.id} highlighted={highlightIds.includes(item.id)} xMm={preview?.id === item.id ? preview.xMm : item.center.xMm} yMm={preview?.id === item.id ? preview.yMm : item.center.yMm} onPointerDown={onItemPointerDown} onKeyDown={keyboardMove} label={`${item.label}, ${item.width.valueMm} by ${item.depth.valueMm} mm`} />)}
        {/* Falls use a triangle with an exclamation mark, a shape nothing else on the plan uses. */}
        {falls.filter((fall) => fall.roomId === room.id && fall.point).map((fall, index) => {
          const size = 170 * scale
          const { xMm, yMm } = fall.point!
          return <g key={fall.id} className="fall-marker" data-fall-id={fall.id} role="img" aria-label={`${t(locale, 'fallMarker')} ${index + 1}`} pointerEvents="none">
            <path d={`M ${xMm} ${yMm - size} L ${xMm + size * 0.92} ${yMm + size * 0.6} L ${xMm - size * 0.92} ${yMm + size * 0.6} Z`} />
            <text x={xMm} y={yMm + size * 0.12} textAnchor="middle" dominantBaseline="central">!</text>
          </g>
        })}
        {placement && preview?.id === '__placement__' && <g className="placement-preview" transform={`translate(${preview.xMm} ${preview.yMm})`} pointerEvents="none"><rect x={-placement.widthMm / 2} y={-placement.depthMm / 2} width={placement.widthMm} height={placement.depthMm} rx={70 * scale} /><text textAnchor="middle" dominantBaseline="central">{placement.label}</text></g>}
      </svg>
      {message && <p role="alert" className="canvas-alert">{message}</p>}
    </div>
    <div className="canvas-legend"><span><i className="legend-furniture" />{locale === 'th' ? 'สิ่งของ' : 'Furniture'}</span><span><i className="legend-route" />{locale === 'th' ? 'แนวทางเดินตัวอย่าง' : 'Illustrative movement corridor'}</span>{room.fixtures.length > 0 && <span><i className="legend-fixture" />{t(locale, 'fixtures')}</span>}{room.wetZones.length > 0 && <span><i className="legend-wet" />{t(locale, 'wetZone')}</span>}{falls.some((fall) => fall.point) && <span><i className="legend-fall" />{t(locale, 'fallMarker')}</span>}<span>{locale === 'th' ? 'กดปุ่มลูกศรเพื่อขยับ 10 มม. · Shift + ลูกศร 50 มม.' : 'Arrow keys move 10 mm · Shift + arrow moves 50 mm'}</span></div>
  </div>
}
