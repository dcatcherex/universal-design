import { getDoorSector, getFixtureSpan, getFootprint } from '../geometry'
import { getPrimaryFloor, getPrimaryRoom } from '../layout-access'
import type { Layout, Locale, Opening, PointMm, RoomSpace } from '../types'

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

function sectorPath(opening: Opening, room: RoomSpace): string | null {
  const sector = getDoorSector(opening, room)
  if (!sector) return null
  const angle = (degrees: number) => degrees * Math.PI / 180
  const start = { xMm: sector.hinge.xMm + Math.cos(angle(sector.startAngleDeg)) * sector.radiusMm, yMm: sector.hinge.yMm + Math.sin(angle(sector.startAngleDeg)) * sector.radiusMm }
  const endAngle = sector.startAngleDeg + sector.sweepDeg
  const end = { xMm: sector.hinge.xMm + Math.cos(angle(endAngle)) * sector.radiusMm, yMm: sector.hinge.yMm + Math.sin(angle(endAngle)) * sector.radiusMm }
  return `M ${sector.hinge.xMm} ${sector.hinge.yMm} L ${start.xMm} ${start.yMm} A ${sector.radiusMm} ${sector.radiusMm} 0 0 ${sector.sweepDeg > 0 ? 1 : 0} ${end.xMm} ${end.yMm} Z`
}

function openingLines(opening: Opening, room: RoomSpace) {
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  if (opening.wall === 'north' || opening.wall === 'south') {
    const y = opening.wall === 'north' ? 0 : depth
    return { x1: opening.offset.valueMm, y1: y, x2: opening.offset.valueMm + opening.width.valueMm, y2: y }
  }
  const x = opening.wall === 'west' ? 0 : width
  return { x1: x, y1: opening.offset.valueMm, x2: x, y2: opening.offset.valueMm + opening.width.valueMm }
}

function confidence(locale: Locale, value: string) {
  if (locale === 'th') return value === 'advisor-verified' ? 'ผู้ให้คำปรึกษาตรวจสอบ' : value === 'measured' ? 'วัดแล้ว' : 'ประมาณการ'
  return value === 'advisor-verified' ? 'Advisor verified' : value === 'measured' ? 'Measured' : 'Estimated'
}

export function createPlanSvg(layout: Layout, options: { locale: Locale; layoutLabel: string; showOverlays: boolean }): string {
  const room = getPrimaryRoom(layout)
  const floor = getPrimaryFloor(layout)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  // Small rooms need proportionally smaller labels and strokes.
  const scale = Math.max(0.4, Math.min(1, Math.max(width, depth) / 6000))
  const wetZones = room.wetZones.map((zone) => `<g data-wet-zone-id="${escapeXml(zone.id)}"><rect x="${zone.rect.minX}" y="${zone.rect.minY}" width="${zone.rect.maxX - zone.rect.minX}" height="${zone.rect.maxY - zone.rect.minY}" fill="#7fa9c4" fill-opacity=".18" stroke="#5f8aa6" stroke-width="${14 * scale}" stroke-dasharray="${60 * scale} ${40 * scale}"/><title>${escapeXml(zone.label)}</title></g>`).join('')
  const itemMarkup = room.items.map((item) => {
    const bounds = getFootprint(item)
    const foot = `${bounds.minX} ${bounds.minY} ${bounds.maxX} ${bounds.maxY}`
    const x = -item.width.valueMm / 2, y = -item.depth.valueMm / 2
    const label = escapeXml(item.label)
    const dimensions = `${item.width.valueMm} × ${item.depth.valueMm} mm · ${confidence(options.locale, item.width.confidence)} / ${confidence(options.locale, item.depth.confidence)}`
    const fill = item.obstruction === 'rug' ? '#d4cbb0' : item.finish === 'sage' ? '#9eaf9d' : item.finish === 'cream' ? '#d8c29f' : item.finish === 'charcoal' ? '#69736c' : '#b39872'
    return `<g data-item-id="${escapeXml(item.id)}" data-footprint="${foot}" transform="translate(${item.center.xMm} ${item.center.yMm}) rotate(${item.rotationDeg})"><rect x="${x}" y="${y}" width="${item.width.valueMm}" height="${item.depth.valueMm}" rx="${70 * scale}" fill="${fill}" stroke="#496654" stroke-width="${28 * scale}"/><text text-anchor="middle" dominant-baseline="central" font-size="${150 * scale}" transform="rotate(${-item.rotationDeg})">${label}</text><title>${label} · ${dimensions} · ${item.rotationDeg}°</title></g>`
  }).join('')
  const fixtures = room.fixtures.map((fixture) => {
    const { footprint } = getFixtureSpan(fixture, room)
    const label = escapeXml(fixture.label)
    const grabBar = fixture.kind.startsWith('grab-bar')
    return `<g data-fixture-id="${escapeXml(fixture.id)}" data-fixture-kind="${fixture.kind}"><rect x="${footprint.minX}" y="${footprint.minY}" width="${Math.max(footprint.maxX - footprint.minX, 30 * scale)}" height="${Math.max(footprint.maxY - footprint.minY, 30 * scale)}" rx="${12 * scale}" fill="${grabBar ? '#2f6f8f' : '#8a7a5c'}" stroke="#21382d" stroke-width="${8 * scale}"/><title>${label} · ${fixture.referenceHeight.valueMm} mm</title></g>`
  }).join('')
  const openings = room.openings.map((opening) => {
    const lines = openingLines(opening, room)
    const swing = sectorPath(opening, room)
    return `<g data-opening-id="${escapeXml(opening.id)}"><line x1="${lines.x1}" y1="${lines.y1}" x2="${lines.x2}" y2="${lines.y2}" stroke="#fffefa" stroke-width="${100 * scale}"/><line x1="${lines.x1}" y1="${lines.y1}" x2="${lines.x2}" y2="${lines.y2}" stroke="#739681" stroke-width="${26 * scale}"/><title>${escapeXml(opening.kind === 'door' ? (options.locale === 'th' ? 'ประตู' : 'Door') : (options.locale === 'th' ? 'หน้าต่าง' : 'Window'))} · ${opening.width.valueMm} × ${opening.height.valueMm} mm</title>${swing ? `<path d="${swing}" fill="#92aa8d" fill-opacity=".12" stroke="#92aa8d" stroke-width="${12 * scale}" stroke-dasharray="${85 * scale} ${50 * scale}"/>` : ''}</g>`
  }).join('')
  // Overlays are stored in floor coordinates; this drawing is in room coordinates.
  const shift = (point: PointMm) => `${point.xMm - room.origin.xMm},${point.yMm - room.origin.yMm}`
  const overlays = options.showOverlays ? [
    ...floor.routes.map((route) => `<g data-overlay-id="${escapeXml(route.id)}"><polyline points="${route.points.map(shift).join(' ')}" fill="none" stroke="#628c72" stroke-opacity="${route.widthMm === null ? '.75' : '.2'}" stroke-width="${route.widthMm ?? 28}" ${route.widthMm === null ? 'stroke-dasharray="100 70"' : ''} stroke-linecap="round" stroke-linejoin="round"/><title>${escapeXml(route.label)} · ${route.widthMm === null ? (options.locale === 'th' ? 'ไม่ระบุความกว้าง' : 'Width not set') : `${route.widthMm} mm`}</title></g>`),
    ...floor.turningAreas.map((area) => `<g data-overlay-id="${escapeXml(area.id)}"><circle cx="${area.center.xMm - room.origin.xMm}" cy="${area.center.yMm - room.origin.yMm}" r="${(area.diameterMm ?? 800) / 2}" fill="${area.diameterMm === null ? 'none' : '#75988022'}" stroke="#6d9277" stroke-width="24" ${area.diameterMm === null ? 'stroke-dasharray="90 48"' : ''}/><title>${escapeXml(area.label)} · ${area.diameterMm === null ? (options.locale === 'th' ? 'ไม่ระบุเส้นผ่านศูนย์กลาง' : 'Diameter not set') : `${area.diameterMm} mm`}</title></g>`),
  ].join('') : ''
  const title = escapeXml(options.layoutLabel)
  const dimensionLabel = `${(width / 1000).toFixed(2)} × ${(depth / 1000).toFixed(2)} m`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-labelledby="plan-title plan-description" viewBox="0 0 ${width} ${depth}" width="${width}" height="${depth}"><title id="plan-title">${title}</title><desc id="plan-description">${escapeXml(dimensionLabel)} · ${title}</desc><rect width="${width}" height="${depth}" fill="#f4f1e6"/>${wetZones}<path d="M 0 0 H ${width} V ${depth} H 0 Z" fill="none" stroke="#68705a" stroke-width="${55 * scale}"/>${overlays}${openings}${itemMarkup}${fixtures}</svg>`
}
