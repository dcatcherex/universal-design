import { getFixtureSpan, getFootprint } from '../geometry'
import { getPrimaryFloor, getPrimaryRoom } from '../layout-access'
import { buildPlanDrawing, PLAN_WALL_THICKNESS_MM, planSymbol } from '../plan-drawing'
import { buildPlanDimensions, PLAN_DIMENSION_MARGIN_MM } from '../plan-dimensions'
import { buildPlanAnnotations } from '../plan-annotations'
import { PLAN_PALETTE } from '../plan-palette'
import { buildPlanSchedule } from '../plan-schedule'
import type { EntityCheckStatus } from '../checks'
import { t } from '../i18n'
import type { CheckResult, Layout, Locale, PointMm } from '../types'

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

function symbolMarkup(marks: ReturnType<typeof planSymbol>): string {
  return marks.map((mark) => mark.kind === 'rect'
    ? `<rect x="${mark.x}" y="${mark.y}" width="${mark.width}" height="${mark.height}"${mark.rx === undefined ? '' : ` rx="${mark.rx}"`} vector-effect="non-scaling-stroke"/>`
    : mark.kind === 'ellipse'
      ? `<ellipse cx="${mark.cx}" cy="${mark.cy}" rx="${mark.rx}" ry="${mark.ry}" vector-effect="non-scaling-stroke"/>`
      : mark.kind === 'line'
        ? `<line x1="${mark.x1}" y1="${mark.y1}" x2="${mark.x2}" y2="${mark.y2}" vector-effect="non-scaling-stroke"/>`
        : `<path d="${mark.d}" vector-effect="non-scaling-stroke"/>`).join('')
}

function confidence(locale: Locale, value: string) {
  if (locale === 'th') return value === 'advisor-verified' ? 'ผู้ให้คำปรึกษาตรวจสอบ' : value === 'measured' ? 'วัดแล้ว' : 'ประมาณการ'
  return value === 'advisor-verified' ? 'Advisor verified' : value === 'measured' ? 'Measured' : 'Estimated'
}

function checkOutline(status: EntityCheckStatus | undefined, x: number, y: number, width: number, height: number, scale: number, radius = 0): string {
  if (!status || status.status === 'clear') return ''
  const attention = status.status === 'attention'
  const color = attention ? '#8e2f21' : '#175d91'
  const dash = attention ? '' : ` stroke-dasharray="${9 * scale} ${6 * scale}"`
  return `<rect class="check-marker-outline check-marker-outline-${status.status}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" stroke="${color}" stroke-width="${attention ? 32 * scale : 26 * scale}"${dash} vector-effect="non-scaling-stroke"/>`
}

function checkBadge(status: EntityCheckStatus | undefined, entityId: string, x: number, y: number, label: string, locale: Locale, scale: number): string {
  if (!status || status.status === 'clear' || !status.resultIds[0]) return ''
  const attention = status.status === 'attention'
  const count = attention ? status.attentionCount : status.notEvaluatedCount
  const summary = t(locale, attention ? 'checkMarkerAttentionSummary' : 'checkMarkerNotEvaluatedSummary')
  const accessibleLabel = escapeXml(`${label}: ${count} ${summary}`)
  const size = 400 * scale
  const shape = attention
    ? '<path d="M50 4 97 91H3Z" fill="#8e2f21"/>'
    : '<rect x="8" y="8" width="84" height="84" rx="18" fill="#175d91" stroke-dasharray="5 3"/>'
  return `<g class="check-marker-badge check-marker-badge-${status.status}" transform="translate(${x} ${y}) scale(${size / 100})" role="img" aria-label="${accessibleLabel}" data-check-mark="${status.status}" data-check-entity-id="${escapeXml(entityId)}" data-result-id="${escapeXml(status.resultIds[0])}">${shape}<text x="50" y="${attention ? 69 : 72}" text-anchor="middle" fill="#fffefa" font-size="64" font-weight="800">${attention ? '!' : '?'}</text><title>${accessibleLabel}</title></g>`
}

export function createPlanSvg(layout: Layout, options: {
  locale: Locale; layoutLabel: string; showOverlays: boolean; showDimensions?: boolean; showCheckMarks?: boolean
  checkStatuses?: ReadonlyMap<string, EntityCheckStatus>; roomCheckResults?: CheckResult[]; selectedItemId?: string | null
}): string {
  const room = getPrimaryRoom(layout)
  const floor = getPrimaryFloor(layout)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  const annotations = buildPlanAnnotations(room, {
    roomType: t(options.locale, room.type === 'bathroom' ? 'roomBathroom' : 'roomLiving'),
    planNorth: t(options.locale, 'planNorth'),
    scaleBar: t(options.locale, 'scaleBar'),
  })
  const drawing = buildPlanDrawing(room)
  const schedule = buildPlanSchedule(room)
  const itemNumbers = new Map(schedule.items.map((entry) => [entry.id, entry.number]))
  // Small rooms need proportionally smaller labels and strokes.
  const scale = Math.max(0.4, Math.min(1, Math.max(width, depth) / 6000))
  const showCheckMarks = options.showCheckMarks !== false
  const checkStatuses = showCheckMarks ? options.checkStatuses : undefined
  const wetHatch = `<pattern id="plan-wet-zone-hatch" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" fill="#e8f0f3"/><path d="M -40 40 L40 -40 M0 160 L160 0 M120 200 L200 120" fill="none" stroke="${PLAN_PALETTE.wet}" stroke-width="${18 * scale}"/></pattern>`
  const wetZones = room.wetZones.map((zone) => `<g data-wet-zone-id="${escapeXml(zone.id)}"><rect x="${zone.rect.minX}" y="${zone.rect.minY}" width="${zone.rect.maxX - zone.rect.minX}" height="${zone.rect.maxY - zone.rect.minY}" fill="url(#plan-wet-zone-hatch)" stroke="${PLAN_PALETTE.wet}" stroke-width="${14 * scale}" stroke-dasharray="${60 * scale} ${40 * scale}"/><title>${escapeXml(zone.label)}</title></g>`).join('')
  const itemMarkup = room.items.map((item) => {
    const itemNumber = itemNumbers.get(item.id) ?? 0
    const bounds = getFootprint(item)
    const foot = `${bounds.minX} ${bounds.minY} ${bounds.maxX} ${bounds.maxY}`
    const x = -item.width.valueMm / 2, y = -item.depth.valueMm / 2
    const depth = item.rotationDeg % 180 === 0 ? item.depth.valueMm : item.width.valueMm
    const label = escapeXml(item.label)
    const dimensions = `${item.width.valueMm} × ${item.depth.valueMm} mm · ${confidence(options.locale, item.width.confidence)} / ${confidence(options.locale, item.depth.confidence)}`
    const marks = symbolMarkup(planSymbol(item.catalogId))
    const rug = item.obstruction === 'rug'
    const selected = item.id === options.selectedItemId
    const status = checkStatuses?.get(item.id)
    const itemStroke = selected ? PLAN_PALETTE.selection : PLAN_PALETTE.symbol
    const numberY = -item.depth.valueMm / 2 - 100 * scale
    const check = checkOutline(status, x - 45 * scale, y - 45 * scale, item.width.valueMm + 90 * scale, item.depth.valueMm + 90 * scale, scale, 24 * scale)
      + `<g transform="rotate(${-item.rotationDeg} ${item.width.valueMm / 2} ${-item.depth.valueMm / 2})">${checkBadge(status, item.id, item.width.valueMm / 2, -item.depth.valueMm / 2, item.label, options.locale, scale)}</g>`
    return `<g class="${selected ? 'selected' : ''}" data-item-id="${escapeXml(item.id)}" data-item-number="${itemNumber}" data-footprint="${foot}" data-entity-check-status="${status?.status ?? ''}" transform="translate(${item.center.xMm} ${item.center.yMm}) rotate(${item.rotationDeg})"><rect class="item-footprint" x="${x}" y="${y}" width="${item.width.valueMm}" height="${item.depth.valueMm}" fill="none" stroke="${itemStroke}" stroke-width="${(selected ? 48 : 28) * scale}"${rug ? ` stroke-dasharray="${60 * scale} ${36 * scale}"` : ''}/>${check}<g transform="translate(${x} ${y}) scale(${item.width.valueMm} ${item.depth.valueMm})" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${18 * scale}" vector-effect="non-scaling-stroke">${marks}</g><text class="plan-item-number" x="0" y="${numberY}" text-anchor="middle" dominant-baseline="central" font-size="${125 * scale}" font-weight="700" fill="${PLAN_PALETTE.dimension}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${24 * scale}" paint-order="stroke" transform="rotate(${-item.rotationDeg} 0 ${numberY})">${itemNumber}</text><text x="0" y="${depth / 2 + 100 * scale}" text-anchor="middle" dominant-baseline="central" font-size="${150 * scale}" transform="rotate(${-item.rotationDeg})">${label}</text><title>${label} · ${dimensions} · ${item.rotationDeg}°</title></g>`
  }).join('')
  const fixtures = room.fixtures.map((fixture) => {
    const { footprint } = getFixtureSpan(fixture, room)
    const label = escapeXml(fixture.label)
    const grabBar = fixture.kind.startsWith('grab-bar')
    const width = Math.max(footprint.maxX - footprint.minX, 30 * scale)
    const height = Math.max(footprint.maxY - footprint.minY, 30 * scale)
    const basin = fixture.kind === 'basin' ? `<g transform="translate(${footprint.minX} ${footprint.minY}) scale(${width} ${height})" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${3 * scale}">${symbolMarkup(planSymbol('basin'))}</g>` : ''
    const status = checkStatuses?.get(fixture.id)
    const check = checkOutline(status, footprint.minX - 28 * scale, footprint.minY - 28 * scale, width + 56 * scale, height + 56 * scale, scale, 28 * scale)
      + checkBadge(status, fixture.id, footprint.maxX, footprint.minY, fixture.label, options.locale, scale)
    return `<g data-fixture-id="${escapeXml(fixture.id)}" data-fixture-kind="${fixture.kind}" data-entity-check-status="${status?.status ?? ''}">${check}<rect x="${footprint.minX}" y="${footprint.minY}" width="${width}" height="${height}" rx="${12 * scale}" fill="${grabBar ? '#2f6f8f' : '#8a7a5c'}" stroke="#21382d" stroke-width="${8 * scale}"/>${basin}<title>${label} · ${fixture.referenceHeight.valueMm} mm</title></g>`
  }).join('')
  const openings = drawing.openings.map(({ opening, windowLines, doorLeaf, swingPath, outward, slidingArrow }) => {
    const windows = windowLines.map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${PLAN_PALETTE.symbol}" stroke-width="${24 * scale}"/>`).join('')
    const leaf = doorLeaf ? `<line x1="${doorLeaf.x1}" y1="${doorLeaf.y1}" x2="${doorLeaf.x2}" y2="${doorLeaf.y2}" stroke="${PLAN_PALETTE.symbol}" stroke-width="${26 * scale}"${outward ? ` stroke-dasharray="${20 * scale} ${20 * scale}"` : ''}/>` : ''
    const swing = swingPath ? `<path d="${swingPath}" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${12 * scale}" stroke-dasharray="${20 * scale} ${18 * scale}"/>` : ''
    const arrow = slidingArrow ? `<path d="${slidingArrow}" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${18 * scale}"/>` : ''
    const status = checkStatuses?.get(opening.id)
    const label = t(options.locale, opening.kind)
    const start = opening.offset.valueMm, end = start + opening.width.valueMm
    const box = opening.wall === 'north' ? { x: start, y: -PLAN_WALL_THICKNESS_MM, width: opening.width.valueMm, height: PLAN_WALL_THICKNESS_MM }
      : opening.wall === 'south' ? { x: start, y: depth, width: opening.width.valueMm, height: PLAN_WALL_THICKNESS_MM }
        : opening.wall === 'west' ? { x: -PLAN_WALL_THICKNESS_MM, y: start, width: PLAN_WALL_THICKNESS_MM, height: opening.width.valueMm }
          : { x: width, y: start, width: PLAN_WALL_THICKNESS_MM, height: opening.width.valueMm }
    const badgePoint = opening.wall === 'north' ? { x: end, y: -PLAN_WALL_THICKNESS_MM }
      : opening.wall === 'south' ? { x: end, y: depth + PLAN_WALL_THICKNESS_MM }
        : opening.wall === 'west' ? { x: -PLAN_WALL_THICKNESS_MM, y: end }
          : { x: width + PLAN_WALL_THICKNESS_MM, y: start }
    const check = checkOutline(status, box.x, box.y, box.width, box.height, scale)
      + checkBadge(status, opening.id, badgePoint.x, badgePoint.y, label, options.locale, scale)
    return `<g data-opening-id="${escapeXml(opening.id)}" data-entity-check-status="${status?.status ?? ''}">${check}${windows}${leaf}${swing}${arrow}<title>${escapeXml(label)} · ${opening.width.valueMm} × ${opening.height.valueMm} mm</title></g>`
  }).join('')
  // Overlays are stored in floor coordinates; this drawing is in room coordinates.
  const shift = (point: PointMm) => `${point.xMm - room.origin.xMm},${point.yMm - room.origin.yMm}`
  const overlays = options.showOverlays ? [
    ...floor.routes.map((route) => `<g data-overlay-id="${escapeXml(route.id)}"><polyline points="${route.points.map(shift).join(' ')}" fill="none" stroke="${PLAN_PALETTE.route}" stroke-opacity="${route.widthMm === null ? '.75' : '.16'}" stroke-width="${route.widthMm ?? 28 * scale}" ${route.widthMm === null ? `stroke-dasharray="${100 * scale} ${70 * scale}"` : ''} stroke-linecap="round" stroke-linejoin="round"/><polyline points="${route.points.map(shift).join(' ')}" fill="none" stroke="${PLAN_PALETTE.route}" stroke-opacity=".9" stroke-width="${14 * scale}" stroke-dasharray="${80 * scale} ${60 * scale}" stroke-linecap="round" stroke-linejoin="round"/><title>${escapeXml(route.label)} · ${route.widthMm === null ? (options.locale === 'th' ? 'ไม่ระบุความกว้าง' : 'Width not set') : `${route.widthMm} mm`}</title></g>`),
    ...floor.turningAreas.map((area) => `<g data-overlay-id="${escapeXml(area.id)}"><circle cx="${area.center.xMm - room.origin.xMm}" cy="${area.center.yMm - room.origin.yMm}" r="${(area.diameterMm ?? 800) / 2}" fill="${area.diameterMm === null ? 'none' : '#75988022'}" stroke="${PLAN_PALETTE.turning}" stroke-width="${24 * scale}" stroke-dasharray="${90 * scale} ${48 * scale}"/><title>${escapeXml(area.label)} · ${area.diameterMm === null ? (options.locale === 'th' ? 'ไม่ระบุเส้นผ่านศูนย์กลาง' : 'Diameter not set') : `${area.diameterMm} mm`}</title></g>`),
  ].join('') : ''
  const checkOverlay = showCheckMarks && options.showOverlays ? [
    ...floor.routes.map((route) => {
      const points = route.points.map((point) => ({ xMm: point.xMm - room.origin.xMm, yMm: point.yMm - room.origin.yMm }))
      const pointText = points.map((point) => `${point.xMm},${point.yMm}`).join(' ')
      const first = points[0] ?? { xMm: 0, yMm: 0 }
      const status = checkStatuses?.get(route.id)
      const outline = status && status.status !== 'clear'
        ? `<polyline points="${pointText}" fill="none" stroke="${status.status === 'attention' ? '#8e2f21' : '#175d91'}" stroke-width="${64 * scale}"${status.status === 'not-evaluated' ? ` stroke-dasharray="${9 * scale} ${6 * scale}"` : ''} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
        : ''
      return `<g data-overlay-id="${escapeXml(route.id)}" data-entity-check-status="${status?.status ?? ''}">${outline}${checkBadge(status, route.id, first.xMm, first.yMm, route.label, options.locale, scale)}</g>`
    }),
    ...floor.turningAreas.map((area) => {
      const cx = area.center.xMm - room.origin.xMm, cy = area.center.yMm - room.origin.yMm
      const radius = (area.diameterMm ?? 800) / 2
      const status = checkStatuses?.get(area.id)
      const outline = status && status.status !== 'clear'
        ? `<circle cx="${cx}" cy="${cy}" r="${radius + 70 * scale}" fill="none" stroke="${status.status === 'attention' ? '#8e2f21' : '#175d91'}" stroke-width="${status.status === 'attention' ? 32 * scale : 26 * scale}"${status.status === 'not-evaluated' ? ` stroke-dasharray="${9 * scale} ${6 * scale}"` : ''} vector-effect="non-scaling-stroke"/>`
        : ''
      return `<g data-overlay-id="${escapeXml(area.id)}" data-entity-check-status="${status?.status ?? ''}">${outline}${checkBadge(status, area.id, cx + radius, cy - radius, area.label, options.locale, scale)}</g>`
    }),
  ].join('') : ''
  const title = escapeXml(options.layoutLabel)
  const dimensionLabel = `${(width / 1000).toFixed(2)} × ${(depth / 1000).toFixed(2)} m`
  const walls = drawing.walls.map((wall) => `<rect class="plan-wall" x="${wall.x}" y="${wall.y}" width="${wall.width}" height="${wall.height}" fill="${PLAN_PALETTE.wall}"/>`).join('')
  const selectedItem = room.items.find((item) => item.id === options.selectedItemId)
  const dimensions = options.showDimensions === false ? '' : buildPlanDimensions(room, selectedItem).map((dimension) => {
    const x = dimension.labelPoint.xMm, y = dimension.labelPoint.yMm
    const transform = dimension.labelRotationDeg ? ` transform="rotate(${dimension.labelRotationDeg} ${x} ${y})"` : ''
    const wall = dimension.kind === 'chain' ? ` data-dimension-wall="${dimension.wall}"` : ''
    const ticks = dimension.ticks.map((tick) => `<line x1="${tick.x1}" y1="${tick.y1}" x2="${tick.x2}" y2="${tick.y2}"/>`).join('')
    return `<g class="plan-dimension plan-dimension-${dimension.kind}" data-dimension-id="${dimension.id}" data-dimension-kind="${dimension.kind}"${wall} fill="none" stroke="${PLAN_PALETTE.dimension}" stroke-width="${14 * scale}" stroke-linecap="square" font-family="Arial, sans-serif" font-size="${90 * scale}"><line x1="${dimension.line.x1}" y1="${dimension.line.y1}" x2="${dimension.line.x2}" y2="${dimension.line.y2}"/>${ticks}<text x="${x}" y="${y}" fill="${PLAN_PALETTE.dimension}" stroke="none" text-anchor="middle" dominant-baseline="central"${transform}>${dimension.label}</text></g>`
  }).join('')
  const roomLabel = `<g class="plan-room-annotation" data-plan-annotation="room-label" data-label-x-mm="${annotations.roomLabel.point.xMm}" data-label-y-mm="${annotations.roomLabel.point.yMm}" role="img" aria-label="${escapeXml(`${annotations.roomLabel.typeLabel}, ${annotations.roomLabel.areaLabel}`)}"><text class="plan-room-label-type" x="${annotations.roomLabel.point.xMm}" y="${annotations.roomLabel.point.yMm - 75 * scale}" text-anchor="middle" dominant-baseline="central" fill="${PLAN_PALETTE.symbol}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${24 * scale}" paint-order="stroke" font-size="${150 * scale}" font-weight="700">${escapeXml(annotations.roomLabel.typeLabel)}</text><text class="plan-room-label-area" x="${annotations.roomLabel.point.xMm}" y="${annotations.roomLabel.point.yMm + 95 * scale}" text-anchor="middle" dominant-baseline="central" fill="${PLAN_PALETTE.areaLabel}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${20 * scale}" paint-order="stroke" font-size="${125 * scale}">${escapeXml(annotations.roomLabel.areaLabel)}</text></g>`
  const scaleBar = `<g class="plan-scale-bar" data-plan-annotation="scale-bar" data-length-mm="${annotations.scaleBar.lengthMm}" role="img" aria-label="${escapeXml(annotations.scaleBar.label)}" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${18 * scale}" stroke-linecap="square" font-family="Arial, sans-serif" font-size="${110 * scale}"><line x1="${annotations.scaleBar.line.x1}" y1="${annotations.scaleBar.line.y1}" x2="${annotations.scaleBar.line.x2}" y2="${annotations.scaleBar.line.y2}"/>${annotations.scaleBar.ticks.map((tick) => `<line x1="${tick.x1}" y1="${tick.y1}" x2="${tick.x2}" y2="${tick.y2}"/>`).join('')}<text x="${annotations.scaleBar.labelPoint.xMm}" y="${annotations.scaleBar.labelPoint.yMm}" text-anchor="middle" dominant-baseline="central" fill="${PLAN_PALETTE.symbol}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${20 * scale}" paint-order="stroke">${escapeXml(annotations.scaleBar.label)}</text></g>`
  const northArrow = `<g class="plan-north-arrow" data-plan-annotation="north-arrow" role="img" aria-label="${escapeXml(annotations.northArrow.label)}" fill="none" stroke="${PLAN_PALETTE.dimension}" stroke-width="${18 * scale}" stroke-linecap="round" font-family="Arial, sans-serif" font-size="${105 * scale}"><line x1="${annotations.northArrow.shaft.x1}" y1="${annotations.northArrow.shaft.y1}" x2="${annotations.northArrow.shaft.x2}" y2="${annotations.northArrow.shaft.y2}"/>${annotations.northArrow.head.map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"/>`).join('')}<text x="${annotations.northArrow.labelPoint.xMm}" y="${annotations.northArrow.labelPoint.yMm}" text-anchor="end" dominant-baseline="central" fill="${PLAN_PALETTE.dimension}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${20 * scale}" paint-order="stroke">${escapeXml(annotations.northArrow.label)}</text></g>`
  const roomAttention = options.roomCheckResults?.filter((result) => result.status === 'attention').length ?? 0
  const roomPending = options.roomCheckResults?.filter((result) => result.status === 'not-evaluated').length ?? 0
  const legendY = depth + PLAN_DIMENSION_MARGIN_MM - 35
  const checkLegend = showCheckMarks
    ? `<g class="check-mark-legend" role="img" aria-label="${escapeXml(`${t(options.locale, 'checkMarkerLegendAttention')}; ${t(options.locale, 'checkMarkerLegendNotEvaluated')}`)}" font-family="Arial, sans-serif" font-size="${70 * scale}" font-weight="700"><path d="M-330 ${legendY - 48 * scale} l38 ${72 * scale} h-76 z" fill="#8e2f21" stroke="#fffefa" stroke-width="${5 * scale}"/><text x="-275" y="${legendY}" fill="#8e2f21">${escapeXml(t(options.locale, 'checkMarkerLegendAttention'))}</text><rect x="${260 * scale}" y="${legendY - 45 * scale}" width="${56 * scale}" height="${56 * scale}" rx="${12 * scale}" fill="#175d91" stroke="#fffefa" stroke-width="${5 * scale}" stroke-dasharray="${5 * scale} ${3 * scale}"/><text x="${330 * scale}" y="${legendY}" fill="#175d91">${escapeXml(t(options.locale, 'checkMarkerLegendNotEvaluated'))}</text>${roomAttention || roomPending ? `<text x="${820 * scale}" y="${legendY}" fill="${PLAN_PALETTE.symbol}">${escapeXml(t(options.locale, 'roomCheckMarkers'))}: ${roomAttention ? `! ${roomAttention}` : ''}${roomAttention && roomPending ? ' · ' : ''}${roomPending ? `? ${roomPending}` : ''}</text>` : ''}</g>`
    : ''
  const viewBox = `${-PLAN_DIMENSION_MARGIN_MM} ${-PLAN_DIMENSION_MARGIN_MM} ${width + PLAN_DIMENSION_MARGIN_MM * 2} ${depth + PLAN_DIMENSION_MARGIN_MM * 2}`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-labelledby="plan-title plan-description" viewBox="${viewBox}" width="${width + PLAN_DIMENSION_MARGIN_MM * 2}" height="${depth + PLAN_DIMENSION_MARGIN_MM * 2}"><title id="plan-title">${title}</title><desc id="plan-description">${escapeXml(dimensionLabel)} · ${title}</desc><defs>${wetHatch}</defs><rect x="${-PLAN_DIMENSION_MARGIN_MM}" y="${-PLAN_DIMENSION_MARGIN_MM}" width="${width + PLAN_DIMENSION_MARGIN_MM * 2}" height="${depth + PLAN_DIMENSION_MARGIN_MM * 2}" fill="${PLAN_PALETTE.sheet}"/>${walls}<rect width="${width}" height="${depth}" fill="${PLAN_PALETTE.floor}"/>${wetZones}${overlays}${checkOverlay}${openings}${itemMarkup}${fixtures}${roomLabel}${scaleBar}${northArrow}${dimensions}${checkLegend}</svg>`
}
