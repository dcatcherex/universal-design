'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { getDoorSector, getFootprint, type DoorSector } from '@/lib/planner/geometry'
import type { FurnitureItem, Layout, Locale, PointMm } from '@/lib/planner/types'
import { t } from '@/lib/planner/i18n'

type Placement = { catalogId: string; label: string; widthMm: number; depthMm: number; heightMm: number; finish: FurnitureItem['finish']; obstruction: FurnitureItem['obstruction'] }
type OverlayTool = 'route' | 'turning' | null
type Props = { layout: Layout; locale: Locale; selectionId: string | null; routeTargetMm?: number | null; turningTargetMm?: number | null; placement?: Placement | null; overlayTool?: OverlayTool; onSelect(id: string | null): void; onCommitLayout(layout: Layout): void; onPlace(center: { xMm: number; yMm: number }): void; onCancelPlacement(): void; onPlaceRoute(points: PointMm[]): void; onPlaceTurning(center: PointMm): void; onCancelOverlay(): void }
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

function FurnitureShape({ item, selected, xMm, yMm, onPointerDown, onKeyDown, label }: {
  item: FurnitureItem; selected: boolean; xMm: number; yMm: number; onPointerDown(event: ReactPointerEvent<SVGGElement>, item: FurnitureItem): void;
  onKeyDown(event: KeyboardEvent<SVGGElement>, item: FurnitureItem): void; label: string
}) {
  const width = item.rotationDeg % 180 === 0 ? item.width.valueMm : item.depth.valueMm
  const depth = item.rotationDeg % 180 === 0 ? item.depth.valueMm : item.width.valueMm
  const className = item.obstruction === 'rug' ? 'plan-rug' : `plan-item finish-${item.finish}`
  return <g
    role="button" tabIndex={0} aria-label={label} aria-pressed={selected}
    data-item-id={item.id} data-x-mm={xMm} data-y-mm={yMm} data-rotation={item.rotationDeg}
    className={`${className} ${selected ? 'selected' : ''}`}
    transform={`translate(${xMm} ${yMm}) rotate(${item.rotationDeg})`}
    onPointerDown={(event) => onPointerDown(event, item)} onKeyDown={(event) => onKeyDown(event, item)}
  >
    <rect x={-item.width.valueMm / 2} y={-item.depth.valueMm / 2} width={item.width.valueMm} height={item.depth.valueMm} rx={item.obstruction === 'rug' ? 120 : 80} />
    <rect className="item-inset" x={-item.width.valueMm / 2 + 60} y={-item.depth.valueMm / 2 + 60} width={Math.max(0, item.width.valueMm - 120)} height={Math.max(0, item.depth.valueMm - 120)} rx={60} />
    <text textAnchor="middle" dominantBaseline="central" y={depth / 2 + 140}>{item.label}</text>
    <title>{`${item.label} · ${width} × ${depth} mm`}</title>
  </g>
}

export function PlanCanvas({ layout, locale, selectionId, routeTargetMm, turningTargetMm, placement, overlayTool = null, onSelect, onCommitLayout, onPlace, onCancelPlacement, onPlaceRoute, onPlaceTurning, onCancelOverlay }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; xMm: number; yMm: number } | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [overlayCursor, setOverlayCursor] = useState<PointMm | null>(null)
  const [routeDraft, setRouteDraft] = useState<{ tool: OverlayTool; points: PointMm[] }>({ tool: null, points: [] })
  const [message, setMessage] = useState('')
  const { width, depth } = { width: layout.room.width.valueMm, depth: layout.room.depth.valueMm }

  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && (dragRef.current || placement || overlayTool)) {
        if (dragRef.current) {
          dragRef.current = null
          setPreview(null)
          setMessage('')
        }
        if (placement) onCancelPlacement()
        if (overlayTool) {
          setRouteDraft({ tool: null, points: [] })
          setOverlayCursor(null)
          onCancelOverlay()
        }
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [placement, overlayTool, onCancelPlacement, onCancelOverlay])

  function modelPoint(event: ReactPointerEvent<SVGSVGElement>) {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return { xMm: 0, yMm: 0 }
    return { xMm: (event.clientX - bounds.left) / bounds.width * width, yMm: (event.clientY - bounds.top) / bounds.height * depth }
  }

  function onItemPointerDown(event: ReactPointerEvent<SVGGElement>, item: FurnitureItem) {
    event.stopPropagation()
    onSelect(item.id)
    dragRef.current = { id: item.id, xMm: item.center.xMm, yMm: item.center.yMm }
    ;(event.currentTarget as SVGGElement).setPointerCapture(event.pointerId)
    setPreview({ id: item.id, xMm: item.center.xMm, yMm: item.center.yMm })
  }

  function findItem(id: string) { return layout.items.find((item) => item.id === id) }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (overlayTool) {
      const point = modelPoint(event)
      setOverlayCursor({ xMm: Math.min(width, Math.max(0, Math.round(point.xMm / 50) * 50)), yMm: Math.min(depth, Math.max(0, Math.round(point.yMm / 50) * 50)) })
      return
    }
    if (placement) {
      const point = modelPoint(event)
      setPreview({ id: '__placement__', xMm: Math.round(point.xMm / 50) * 50, yMm: Math.round(point.yMm / 50) * 50 })
      return
    }
    if (!dragRef.current) return
    const point = modelPoint(event)
    const item = findItem(dragRef.current.id)
    if (!item) return
    const snap = (value: number) => Math.round(value / 50) * 50
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
    const fp = getFootprint(moved)
    if (fp.minX < 0 || fp.minY < 0 || fp.maxX > width || fp.maxY > depth) {
      setMessage(t(locale, 'outOfBounds'))
      return
    }
    const next = structuredClone(layout)
    next.items = next.items.map((candidate) => candidate.id === item.id ? moved : candidate)
    onCommitLayout(next)
    setMessage('')
  }

  function keyboardMove(event: KeyboardEvent<SVGGElement>, item: FurnitureItem) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const delta = event.shiftKey ? 50 : 10
    const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0
    const dy = event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0
    const moved = { ...item, center: { xMm: item.center.xMm + dx, yMm: item.center.yMm + dy } }
    const fp = getFootprint(moved)
    if (fp.minX < 0 || fp.minY < 0 || fp.maxX > width || fp.maxY > depth) return
    const next = structuredClone(layout)
    next.items = next.items.map((candidate) => candidate.id === item.id ? moved : candidate)
    onCommitLayout(next)
  }

  const openingGaps = layout.openings.map((opening) => {
    const horizontal = opening.wall === 'north' || opening.wall === 'south'
    const lineProps = horizontal
      ? { x1: opening.offset.valueMm, y1: opening.wall === 'north' ? 0 : depth, x2: opening.offset.valueMm + opening.width.valueMm, y2: opening.wall === 'north' ? 0 : depth }
      : { x1: opening.wall === 'west' ? 0 : width, y1: opening.offset.valueMm, x2: opening.wall === 'west' ? 0 : width, y2: opening.offset.valueMm + opening.width.valueMm }
    const sector = getDoorSector(opening, layout.room)
    return <g key={opening.id} role="group" aria-label={opening.kind === 'door' ? (locale === 'th' ? 'ประตู' : 'Door') : (locale === 'th' ? 'หน้าต่าง' : 'Window')}>
      {sector && <path d={sectorPath(sector)} className="door-swing" />}
      <line {...lineProps} className="opening-gap" />
      <line {...lineProps} className="opening-line" />
    </g>
  })

  return <div className="canvas-wrap">
    <div className="canvas-caption"><div><p className="eyebrow">{t(locale, 'roomPlan')}</p><span>{(width / 1000).toFixed(2)} × {(depth / 1000).toFixed(2)} m</span>{placement && <span className="placement-hint"> · {t(locale, 'placingHint')}</span>}{overlayTool && <span className="placement-hint"> · {t(locale, 'drawingHint')}</span>}</div>{overlayTool === 'route' ? <div className="overlay-canvas-actions"><Button type="button" onClick={() => { if (routeDraft.tool !== 'route' || routeDraft.points.length < 2) { setMessage(t(locale, 'drawingNeedTwoPoints')); return } onPlaceRoute(routeDraft.points); setRouteDraft({ tool: null, points: [] }); setOverlayCursor(null) }} disabled={routeDraft.tool !== 'route' || routeDraft.points.length < 2}>{t(locale, 'finishRoute')}</Button><Button type="button" variant="outline" onClick={() => { setRouteDraft({ tool: null, points: [] }); setOverlayCursor(null); onCancelOverlay() }}>{t(locale, 'cancelDrawing')}</Button></div> : overlayTool === 'turning' ? <Button type="button" variant="outline" onClick={onCancelOverlay}>{t(locale, 'cancelDrawing')}</Button> : <span className="confidence-pill">{t(locale, 'estimated')}</span>}</div>
    <div className="canvas-stage">
      <svg ref={svgRef} role="group" aria-label={`${t(locale, 'roomPlan')} ${(width / 1000).toFixed(1)} × ${(depth / 1000).toFixed(1)} m`} viewBox={`0 0 ${width} ${depth}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={(event) => {
        if (placement) {
          event.stopPropagation()
          const point = modelPoint(event as unknown as ReactPointerEvent<SVGSVGElement>)
          const center = { xMm: Math.round(point.xMm / 50) * 50, yMm: Math.round(point.yMm / 50) * 50 }
          const footprint = getFootprint({ id: 'preview', catalogId: placement.catalogId, label: placement.label, center, width: { valueMm: placement.widthMm, confidence: 'estimated' }, depth: { valueMm: placement.depthMm, confidence: 'estimated' }, height: { valueMm: placement.heightMm, confidence: 'estimated' }, rotationDeg: 0, finish: placement.finish, obstruction: placement.obstruction })
          if (footprint.minX < 0 || footprint.minY < 0 || footprint.maxX > width || footprint.maxY > depth) { setMessage(t(locale, 'outOfBounds')); return }
          setMessage('')
          onPlace(center)
          setPreview(null)
          return
        }
        if (overlayTool) {
          const point = modelPoint(event as unknown as ReactPointerEvent<SVGSVGElement>)
          const center = { xMm: Math.min(width, Math.max(0, Math.round(point.xMm / 50) * 50)), yMm: Math.min(depth, Math.max(0, Math.round(point.yMm / 50) * 50)) }
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
        <defs><pattern id="room-grid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#d9e1d5" strokeWidth="8" /></pattern><filter id="item-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="18" floodColor="#21382d" floodOpacity=".12" /></filter></defs>
        <rect width={width} height={depth} rx={24} className="room-floor" />
        <rect width={width} height={depth} rx={24} fill="url(#room-grid)" />
        {layout.routes.map((route) => {
          const widthMm = route.widthMm ?? routeTargetMm ?? null
          const selected = selectionId === route.id
          return <g key={route.id} role="button" tabIndex={overlayTool ? -1 : 0} aria-label={`${t(locale, 'routeOverlay')}: ${route.label}`} aria-pressed={selected} data-overlay-id={route.id} className={`route-overlay ${selected ? 'selected' : ''}`} pointerEvents={overlayTool ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(route.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(route.id) } }}>
            <polyline points={route.points.map((point) => `${point.xMm},${point.yMm}`).join(' ')} fill="none" stroke={selected ? '#315f46' : '#628c72'} strokeOpacity={widthMm === null ? '.75' : '.18'} strokeWidth={widthMm ?? 28} strokeDasharray={widthMm === null ? '100 70' : undefined} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={route.points.map((point) => `${point.xMm},${point.yMm}`).join(' ')} fill="none" stroke={selected ? '#315f46' : '#628c72'} strokeOpacity={selected ? '.95' : '.7'} strokeWidth={selected ? 32 : 14} strokeDasharray={widthMm === null ? '80 60' : undefined} strokeLinecap="round" strokeLinejoin="round" />
            <title>{`${route.label} · ${widthMm === null ? t(locale, 'checkNotEvaluated') : `${widthMm} mm`}`}</title>
          </g>
        })}
        {layout.turningAreas.map((area) => {
          const diameter = area.diameterMm ?? turningTargetMm ?? null
          const selected = selectionId === area.id
          return <g key={area.id} role="button" tabIndex={overlayTool ? -1 : 0} aria-label={`${t(locale, 'turningOverlay')}: ${area.label}`} aria-pressed={selected} data-overlay-id={area.id} className={`turning-overlay ${selected ? 'selected' : ''}`} pointerEvents={overlayTool ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(area.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(area.id) } }}>
            <circle cx={area.center.xMm} cy={area.center.yMm} r={(diameter ?? 400) / 2} fill={diameter === null ? 'none' : '#75988022'} stroke={selected ? '#315f46' : '#6d9277'} strokeWidth={selected ? 38 : 24} strokeDasharray={diameter === null ? '90 48' : undefined} />
            <title>{`${area.label} · ${diameter === null ? t(locale, 'checkNotEvaluated') : `${diameter} mm`}`}</title>
          </g>
        })}
        <rect x="0" y="0" width={width} height={depth} rx={24} className="room-outline" />
        {openingGaps}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.length > 0 && <polyline className="overlay-draft-route" points={[...routeDraft.points, ...(overlayCursor ? [overlayCursor] : [])].map((point) => `${point.xMm},${point.yMm}`).join(' ')} />}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.map((point, index) => <circle key={index} className="overlay-draft-point" cx={point.xMm} cy={point.yMm} r="55"><title>{`${t(locale, 'routePoint')} ${index + 1}`}</title></circle>)}
        {overlayTool === 'turning' && overlayCursor && <circle className="overlay-draft-turning" cx={overlayCursor.xMm} cy={overlayCursor.yMm} r="500" />}
        {layout.items.map((item) => <FurnitureShape key={item.id} item={item} selected={selectionId === item.id} xMm={preview?.id === item.id ? preview.xMm : item.center.xMm} yMm={preview?.id === item.id ? preview.yMm : item.center.yMm} onPointerDown={onItemPointerDown} onKeyDown={keyboardMove} label={`${item.label}, ${item.width.valueMm} by ${item.depth.valueMm} mm`} />)}
        {placement && preview?.id === '__placement__' && <g className="placement-preview" transform={`translate(${preview.xMm} ${preview.yMm})`} pointerEvents="none"><rect x={-placement.widthMm / 2} y={-placement.depthMm / 2} width={placement.widthMm} height={placement.depthMm} rx={70} /><text textAnchor="middle" dominantBaseline="central">{placement.label}</text></g>}
      </svg>
      {message && <p role="alert" className="canvas-alert">{message}</p>}
    </div>
    <div className="canvas-legend"><span><i className="legend-furniture" />{locale === 'th' ? 'สิ่งของ' : 'Furniture'}</span><span><i className="legend-route" />{locale === 'th' ? 'แนวทางเดินตัวอย่าง' : 'Illustrative movement corridor'}</span><span>{locale === 'th' ? 'กดปุ่มลูกศรเพื่อขยับ 10 มม. · Shift + ลูกศร 50 มม.' : 'Arrow keys move 10 mm · Shift + arrow moves 50 mm'}</span></div>
  </div>
}
