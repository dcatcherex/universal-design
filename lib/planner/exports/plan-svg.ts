import { getDoorSector, getFootprint } from '../geometry'
import type { Layout, Locale, Opening, PointMm } from '../types'

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

function sectorPath(opening: Opening, layout: Layout): string | null {
  const sector = getDoorSector(opening, layout.room)
  if (!sector) return null
  const angle = (degrees: number) => degrees * Math.PI / 180
  const start = { xMm: sector.hinge.xMm + Math.cos(angle(sector.startAngleDeg)) * sector.radiusMm, yMm: sector.hinge.yMm + Math.sin(angle(sector.startAngleDeg)) * sector.radiusMm }
  const endAngle = sector.startAngleDeg + sector.sweepDeg
  const end = { xMm: sector.hinge.xMm + Math.cos(angle(endAngle)) * sector.radiusMm, yMm: sector.hinge.yMm + Math.sin(angle(endAngle)) * sector.radiusMm }
  return `M ${sector.hinge.xMm} ${sector.hinge.yMm} L ${start.xMm} ${start.yMm} A ${sector.radiusMm} ${sector.radiusMm} 0 0 ${sector.sweepDeg > 0 ? 1 : 0} ${end.xMm} ${end.yMm} Z`
}

function openingLines(opening: Opening, layout: Layout) {
  const width = layout.room.width.valueMm, depth = layout.room.depth.valueMm
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
  const width = layout.room.width.valueMm, depth = layout.room.depth.valueMm
  const itemMarkup = layout.items.map((item) => {
    const bounds = getFootprint(item)
    const foot = `${bounds.minX} ${bounds.minY} ${bounds.maxX} ${bounds.maxY}`
    const x = -item.width.valueMm / 2, y = -item.depth.valueMm / 2
    const label = escapeXml(item.label)
    const dimensions = `${item.width.valueMm} × ${item.depth.valueMm} mm · ${confidence(options.locale, item.width.confidence)} / ${confidence(options.locale, item.depth.confidence)}`
    const fill = item.obstruction === 'rug' ? '#d4cbb0' : item.finish === 'sage' ? '#9eaf9d' : item.finish === 'cream' ? '#d8c29f' : item.finish === 'charcoal' ? '#69736c' : '#b39872'
    return `<g data-item-id="${escapeXml(item.id)}" data-footprint="${foot}" transform="translate(${item.center.xMm} ${item.center.yMm}) rotate(${item.rotationDeg})"><rect x="${x}" y="${y}" width="${item.width.valueMm}" height="${item.depth.valueMm}" rx="70" fill="${fill}" stroke="#496654" stroke-width="28"/><text text-anchor="middle" dominant-baseline="central" font-size="150">${label}</text><title>${label} · ${dimensions} · ${item.rotationDeg}°</title></g>`
  }).join('')
  const openings = layout.openings.map((opening) => {
    const lines = openingLines(opening, layout)
    const swing = sectorPath(opening, layout)
    return `<g data-opening-id="${escapeXml(opening.id)}"><line x1="${lines.x1}" y1="${lines.y1}" x2="${lines.x2}" y2="${lines.y2}" stroke="#fffefa" stroke-width="100"/><line x1="${lines.x1}" y1="${lines.y1}" x2="${lines.x2}" y2="${lines.y2}" stroke="#739681" stroke-width="26"/><title>${escapeXml(opening.kind === 'door' ? (options.locale === 'th' ? 'ประตู' : 'Door') : (options.locale === 'th' ? 'หน้าต่าง' : 'Window'))} · ${opening.width.valueMm} × ${opening.height.valueMm} mm</title>${swing ? `<path d="${swing}" fill="#92aa8d" fill-opacity=".12" stroke="#92aa8d" stroke-width="12" stroke-dasharray="85 50"/>` : ''}</g>`
  }).join('')
  const overlays = options.showOverlays ? [
    ...layout.routes.map((route) => `<g data-overlay-id="${escapeXml(route.id)}"><polyline points="${route.points.map((point: PointMm) => `${point.xMm},${point.yMm}`).join(' ')}" fill="none" stroke="#628c72" stroke-opacity="${route.widthMm === null ? '.75' : '.2'}" stroke-width="${route.widthMm ?? 28}" ${route.widthMm === null ? 'stroke-dasharray="100 70"' : ''} stroke-linecap="round" stroke-linejoin="round"/><title>${escapeXml(route.label)} · ${route.widthMm === null ? (options.locale === 'th' ? 'ไม่ระบุความกว้าง' : 'Width not set') : `${route.widthMm} mm`}</title></g>`),
    ...layout.turningAreas.map((area) => `<g data-overlay-id="${escapeXml(area.id)}"><circle cx="${area.center.xMm}" cy="${area.center.yMm}" r="${(area.diameterMm ?? 800) / 2}" fill="${area.diameterMm === null ? 'none' : '#75988022'}" stroke="#6d9277" stroke-width="24" ${area.diameterMm === null ? 'stroke-dasharray="90 48"' : ''}/><title>${escapeXml(area.label)} · ${area.diameterMm === null ? (options.locale === 'th' ? 'ไม่ระบุเส้นผ่านศูนย์กลาง' : 'Diameter not set') : `${area.diameterMm} mm`}</title></g>`),
  ].join('') : ''
  const title = escapeXml(options.layoutLabel)
  const dimensionLabel = `${(width / 1000).toFixed(2)} × ${(depth / 1000).toFixed(2)} m`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-labelledby="plan-title plan-description" viewBox="0 0 ${width} ${depth}" width="${width}" height="${depth}"><title id="plan-title">${title}</title><desc id="plan-description">${escapeXml(dimensionLabel)} · ${title}</desc><rect width="${width}" height="${depth}" fill="#f4f1e6"/><path d="M 0 0 H ${width} V ${depth} H 0 Z" fill="none" stroke="#68705a" stroke-width="55"/>${overlays}${openings}${itemMarkup}</svg>`
}
