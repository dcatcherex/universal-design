import { buildPlanScene, type PlanScenePrimitive } from '../plan-scene'
import { PLAN_PALETTE } from '../plan-palette'
import type { EntityCheckStatus } from '../checks'
import { t } from '../i18n'
import type { Layout, Locale, PointMm } from '../types'

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

function symbolMarkup(marks: Extract<PlanScenePrimitive, { kind: 'item' }>['symbol']): string {
  return marks.map((mark) => mark.kind === 'rect'
    ? `<rect x="${mark.x}" y="${mark.y}" width="${mark.width}" height="${mark.height}"${mark.rx === undefined ? '' : ` rx="${mark.rx}"`} vector-effect="non-scaling-stroke"/>`
    : mark.kind === 'ellipse'
      ? `<ellipse cx="${mark.cx}" cy="${mark.cy}" rx="${mark.rx}" ry="${mark.ry}" vector-effect="non-scaling-stroke"/>`
      : mark.kind === 'line'
        ? `<line x1="${mark.x1}" y1="${mark.y1}" x2="${mark.x2}" y2="${mark.y2}" vector-effect="non-scaling-stroke"/>`
        : `<path d="${mark.d}" vector-effect="non-scaling-stroke"/>`).join('')
}

function checkBadge(status: EntityCheckStatus | undefined, entityId: string, point: PointMm, label: string, locale: Locale, sizeMm: number): string {
  if (!status || status.status === 'clear' || !status.resultIds[0]) return ''
  const attention = status.status === 'attention'
  const count = attention ? status.attentionCount : status.notEvaluatedCount
  const summary = t(locale, attention ? 'checkMarkerAttentionSummary' : 'checkMarkerNotEvaluatedSummary')
  const accessibleLabel = escapeXml(`${label}: ${count} ${summary}`)
  const shape = attention
    ? '<path d="M50 4 97 91H3Z" fill="#8e2f21"/>'
    : '<rect x="8" y="8" width="84" height="84" rx="18" fill="#175d91" stroke-dasharray="5 3"/>'
  return `<g class="check-marker-badge check-marker-badge-${status.status}" transform="translate(${point.xMm} ${point.yMm}) scale(${sizeMm / 100})" role="img" aria-label="${accessibleLabel}" data-check-mark="${status.status}" data-check-entity-id="${escapeXml(entityId)}" data-result-id="${escapeXml(status.resultIds[0])}">${shape}<text x="50" y="${attention ? 69 : 72}" text-anchor="middle" fill="#fffefa" font-size="64" font-weight="800">${attention ? '!' : '?'}</text><title>${accessibleLabel}</title></g>`
}

export function createPlanSvg(layout: Layout, options: {
  locale: Locale; layoutLabel: string; showOverlays: boolean; showDimensions?: boolean; showCheckMarks?: boolean
  checkStatuses?: ReadonlyMap<string, EntityCheckStatus>; roomCheckResults?: import('../types').CheckResult[]; selectedItemId?: string | null
}): string {
  const scene = buildPlanScene(layout, options)
  const { widthMm: width, depthMm: depth, scale } = scene
  const walls = scene.primitives.filter((primitive) => primitive.kind === 'wall')
  const wetZones = scene.primitives.filter((primitive) => primitive.kind === 'wet-zone')
  const routes = scene.primitives.filter((primitive) => primitive.kind === 'route')
  const turningAreas = scene.primitives.filter((primitive) => primitive.kind === 'turning-area')
  const openings = scene.primitives.filter((primitive) => primitive.kind === 'opening')
  const items = scene.primitives.filter((primitive) => primitive.kind === 'item')
  const fixtures = scene.primitives.filter((primitive) => primitive.kind === 'fixture')
  const dimensions = scene.primitives.filter((primitive) => primitive.kind === 'dimension')
  const annotations = scene.primitives.find((primitive) => primitive.kind === 'annotation')!.geometry
  const wetHatch = `<pattern id="plan-wet-zone-hatch" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" fill="#e8f0f3"/><path d="M -40 40 L40 -40 M0 160 L160 0 M120 200 L200 120" fill="none" stroke="${PLAN_PALETTE.wet}" stroke-width="${18 * scale}"/></pattern>`
  const wetZoneMarkup = wetZones.map((primitive) => {
    if (primitive.kind !== 'wet-zone') return ''
    const { geometry, entityId, label } = primitive
    return `<g data-wet-zone-id="${escapeXml(entityId)}"><rect x="${geometry.x}" y="${geometry.y}" width="${geometry.width}" height="${geometry.height}" fill="url(#plan-wet-zone-hatch)" stroke="${PLAN_PALETTE.wet}" stroke-width="${14 * scale}" stroke-dasharray="${60 * scale} ${40 * scale}"/><title>${escapeXml(label)}</title></g>`
  }).join('')
  const itemMarkup = items.map((primitive) => {
    if (primitive.kind !== 'item') return ''
    const { entity: item, geometry, itemNumber, selected, styleToken, symbol, checkStatus, dimensionsLabel } = primitive
    const { localFootprint, footprint, badgePoints, checkOutline, numberY, labelY } = geometry
    const foot = `${footprint.minX} ${footprint.minY} ${footprint.maxX} ${footprint.maxY}`
    const label = escapeXml(item.label)
    const marks = symbolMarkup(symbol)
    const rug = styleToken === 'rug'
    const itemStroke = selected ? PLAN_PALETTE.selection : PLAN_PALETTE.symbol
    const check = checkOutlineMarkup(checkStatus, checkOutline, scale, 24 * scale)
      + `<g transform="rotate(${-item.rotationDeg} ${badgePoints.local.xMm} ${badgePoints.local.yMm})">${checkBadge(checkStatus, item.id, badgePoints.local, item.label, options.locale, scene.badgeSizeMm)}</g>`
    return `<g class="${selected ? 'selected' : ''}" data-item-id="${escapeXml(item.id)}" data-item-number="${itemNumber}" data-footprint="${foot}" data-entity-check-status="${checkStatus?.status ?? ''}" transform="translate(${geometry.center.xMm} ${geometry.center.yMm}) rotate(${item.rotationDeg})"><rect class="item-footprint" x="${localFootprint.x}" y="${localFootprint.y}" width="${localFootprint.width}" height="${localFootprint.height}" fill="none" stroke="${itemStroke}" stroke-width="${(selected ? 48 : 28) * scale}"${rug ? ` stroke-dasharray="${60 * scale} ${36 * scale}"` : ''}/>${check}<g transform="translate(${localFootprint.x} ${localFootprint.y}) scale(${localFootprint.width} ${localFootprint.height})" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${18 * scale}" vector-effect="non-scaling-stroke">${marks}</g><text class="plan-item-number" x="0" y="${numberY}" text-anchor="middle" dominant-baseline="central" font-size="${125 * scale}" font-weight="700" fill="${PLAN_PALETTE.dimension}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${24 * scale}" paint-order="stroke" transform="rotate(${-item.rotationDeg} 0 ${numberY})">${itemNumber}</text><text x="0" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-size="${150 * scale}" transform="rotate(${-item.rotationDeg})">${label}</text><title>${label} · ${dimensionsLabel} · ${item.rotationDeg}°</title></g>`
  }).join('')
  const fixtureMarkup = fixtures.map((primitive) => {
    if (primitive.kind !== 'fixture') return ''
    const { entity: fixture, geometry, styleToken, symbol, checkStatus } = primitive
    const { footprint, width: fixtureWidth, height: fixtureHeight, checkOutline } = geometry
    const label = escapeXml(fixture.label)
    const basin = symbol.length ? `<g transform="translate(${footprint.minX} ${footprint.minY}) scale(${fixtureWidth} ${fixtureHeight})" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${3 * scale}">${symbolMarkup(symbol)}</g>` : ''
    const check = checkOutlineMarkup(checkStatus, checkOutline, scale, 28 * scale)
      + checkBadge(checkStatus, fixture.id, geometry.badge, fixture.label, options.locale, scene.badgeSizeMm)
    return `<g data-fixture-id="${escapeXml(fixture.id)}" data-fixture-kind="${fixture.kind}" data-entity-check-status="${checkStatus?.status ?? ''}">${check}<rect x="${footprint.minX}" y="${footprint.minY}" width="${fixtureWidth}" height="${fixtureHeight}" rx="${12 * scale}" fill="${styleToken === 'grab-bar' ? '#2f6f8f' : '#8a7a5c'}" stroke="#21382d" stroke-width="${8 * scale}"/>${basin}<title>${label} · ${fixture.referenceHeight.valueMm} mm</title></g>`
  }).join('')
  const openingMarkup = openings.map((primitive) => {
    if (primitive.kind !== 'opening') return ''
    const { entity: opening, geometry, label, checkStatus } = primitive
    const { drawing, outline, badge } = geometry
    const windows = drawing.windowLines.map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${PLAN_PALETTE.symbol}" stroke-width="${24 * scale}"/>`).join('')
    const leaf = drawing.doorLeaf ? `<line x1="${drawing.doorLeaf.x1}" y1="${drawing.doorLeaf.y1}" x2="${drawing.doorLeaf.x2}" y2="${drawing.doorLeaf.y2}" stroke="${PLAN_PALETTE.symbol}" stroke-width="${26 * scale}"${drawing.outward ? ` stroke-dasharray="${20 * scale} ${20 * scale}"` : ''}/>` : ''
    const swing = drawing.swingPath ? `<path d="${drawing.swingPath}" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${12 * scale}" stroke-dasharray="${20 * scale} ${18 * scale}"/>` : ''
    const arrow = drawing.slidingArrow ? `<path d="${drawing.slidingArrow}" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${18 * scale}"/>` : ''
    const check = checkOutlineMarkup(checkStatus, outline, scale)
      + checkBadge(checkStatus, opening.id, badge, label, options.locale, scene.badgeSizeMm)
    return `<g data-opening-id="${escapeXml(opening.id)}" data-entity-check-status="${checkStatus?.status ?? ''}">${check}${windows}${leaf}${swing}${arrow}<title>${escapeXml(label)} · ${opening.width.valueMm} × ${opening.height.valueMm} mm</title></g>`
  }).join('')
  const overlayMarkup = [
    ...routes.map((primitive) => {
      if (primitive.kind !== 'route') return ''
      const { entity, geometry, label, checkStatus } = primitive
      const points = geometry.points.map((point) => `${point.xMm},${point.yMm}`).join(' ')
      const outline = checkStatus && checkStatus.status !== 'clear'
        ? `<polyline points="${points}" fill="none" stroke="${checkStatus.status === 'attention' ? '#8e2f21' : '#175d91'}" stroke-width="${geometry.checkWidthMm}"${checkStatus.status === 'not-evaluated' ? ` stroke-dasharray="${9 * scale} ${6 * scale}"` : ''} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
        : ''
      const check = outline + checkBadge(checkStatus, entity.id, geometry.badge, entity.label, options.locale, scene.badgeSizeMm)
      return `<g data-overlay-id="${escapeXml(entity.id)}" data-entity-check-status="${checkStatus?.status ?? ''}">${check}<polyline points="${points}" fill="none" stroke="${PLAN_PALETTE.route}" stroke-opacity="${geometry.opacity.export}" stroke-width="${geometry.widthMm.export}" ${!geometry.widthKnown.export ? `stroke-dasharray="${100 * scale} ${70 * scale}"` : ''} stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points}" fill="none" stroke="${PLAN_PALETTE.route}" stroke-opacity=".9" stroke-width="${14 * scale}" stroke-dasharray="${80 * scale} ${60 * scale}" stroke-linecap="round" stroke-linejoin="round"/><title>${escapeXml(entity.label)} · ${escapeXml(label.export)}</title></g>`
    }),
    ...turningAreas.map((primitive) => {
      if (primitive.kind !== 'turning-area') return ''
      const { entity, geometry, hasDiameter, checkStatus } = primitive
      const { center, radiusMm, badge } = geometry
      const radius = radiusMm.export
      const outline = checkStatus && checkStatus.status !== 'clear'
        ? `<circle cx="${center.xMm}" cy="${center.yMm}" r="${geometry.checkRadiusMm.export}" fill="none" stroke="${checkStatus.status === 'attention' ? '#8e2f21' : '#175d91'}" stroke-width="${checkStatus.status === 'attention' ? 32 * scale : 26 * scale}"${checkStatus.status === 'not-evaluated' ? ` stroke-dasharray="${9 * scale} ${6 * scale}"` : ''} vector-effect="non-scaling-stroke"/>`
        : ''
      const check = outline + checkBadge(checkStatus, entity.id, badge.export, entity.label, options.locale, scene.badgeSizeMm)
      return `<g data-overlay-id="${escapeXml(entity.id)}" data-entity-check-status="${checkStatus?.status ?? ''}">${check}<circle cx="${center.xMm}" cy="${center.yMm}" r="${radius}" fill="${hasDiameter.export ? '#75988022' : 'none'}" stroke="${PLAN_PALETTE.turning}" stroke-width="${24 * scale}" stroke-dasharray="${90 * scale} ${48 * scale}"/><title>${escapeXml(entity.label)} · ${hasDiameter.export ? `${radius * 2} mm` : (options.locale === 'th' ? 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹€à¸ªà¹‰à¸™à¸œà¹ˆà¸²à¸™à¸¨à¸¹à¸™à¸¢à¹Œà¸à¸¥à¸²à¸‡' : 'Diameter not set')}</title></g>`
    }),
  ].join('')
  const dimensionLabel = `${(width / 1000).toFixed(2)} × ${(depth / 1000).toFixed(2)} m`
  const wallMarkup = walls.map((primitive) => primitive.kind === 'wall'
    ? `<rect class="plan-wall" x="${primitive.geometry.x}" y="${primitive.geometry.y}" width="${primitive.geometry.width}" height="${primitive.geometry.height}" fill="${PLAN_PALETTE.wall}"/>`
    : '').join('')
  const dimensionsMarkup = dimensions.map((primitive) => {
    if (primitive.kind !== 'dimension') return ''
    const dimension = primitive.geometry
    const x = dimension.labelPoint.xMm, y = dimension.labelPoint.yMm
    const transform = dimension.labelRotationDeg ? ` transform="rotate(${dimension.labelRotationDeg} ${x} ${y})"` : ''
    const wall = dimension.kind === 'chain' ? ` data-dimension-wall="${dimension.wall}"` : ''
    const ticks = dimension.ticks.map((tick) => `<line x1="${tick.x1}" y1="${tick.y1}" x2="${tick.x2}" y2="${tick.y2}"/>`).join('')
    return `<g class="plan-dimension plan-dimension-${dimension.kind}" data-dimension-id="${dimension.id}" data-dimension-kind="${dimension.kind}"${wall} fill="none" stroke="${PLAN_PALETTE.dimension}" stroke-width="${14 * scale}" stroke-linecap="square" font-family="Arial, sans-serif" font-size="${90 * scale}"><line x1="${dimension.line.x1}" y1="${dimension.line.y1}" x2="${dimension.line.x2}" y2="${dimension.line.y2}"/>${ticks}<text x="${x}" y="${y}" fill="${PLAN_PALETTE.dimension}" stroke="none" text-anchor="middle" dominant-baseline="central"${transform}>${dimension.label}</text></g>`
  }).join('')
  const roomLabel = `<g class="plan-room-annotation" data-plan-annotation="room-label" data-label-x-mm="${annotations.roomLabel.point.xMm}" data-label-y-mm="${annotations.roomLabel.point.yMm}" role="img" aria-label="${escapeXml(`${annotations.roomLabel.typeLabel}, ${annotations.roomLabel.areaLabel}`)}"><text class="plan-room-label-type" x="${annotations.roomLabel.point.xMm}" y="${annotations.roomLabel.typeY}" text-anchor="middle" dominant-baseline="central" fill="${PLAN_PALETTE.symbol}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${24 * scale}" paint-order="stroke" font-size="${150 * scale}" font-weight="700">${escapeXml(annotations.roomLabel.typeLabel)}</text><text class="plan-room-label-area" x="${annotations.roomLabel.point.xMm}" y="${annotations.roomLabel.areaY}" text-anchor="middle" dominant-baseline="central" fill="${PLAN_PALETTE.areaLabel}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${20 * scale}" paint-order="stroke" font-size="${125 * scale}">${escapeXml(annotations.roomLabel.areaLabel)}</text></g>`
  const scaleBar = `<g class="plan-scale-bar" data-plan-annotation="scale-bar" data-length-mm="${annotations.scaleBar.lengthMm}" role="img" aria-label="${escapeXml(annotations.scaleBar.label)}" fill="none" stroke="${PLAN_PALETTE.symbol}" stroke-width="${18 * scale}" stroke-linecap="square" font-family="Arial, sans-serif" font-size="${110 * scale}"><line x1="${annotations.scaleBar.line.x1}" y1="${annotations.scaleBar.line.y1}" x2="${annotations.scaleBar.line.x2}" y2="${annotations.scaleBar.line.y2}"/>${annotations.scaleBar.ticks.map((tick) => `<line x1="${tick.x1}" y1="${tick.y1}" x2="${tick.x2}" y2="${tick.y2}"/>`).join('')}<text x="${annotations.scaleBar.labelPoint.xMm}" y="${annotations.scaleBar.labelPoint.yMm}" text-anchor="middle" dominant-baseline="central" fill="${PLAN_PALETTE.symbol}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${20 * scale}" paint-order="stroke">${escapeXml(annotations.scaleBar.label)}</text></g>`
  const northArrow = `<g class="plan-north-arrow" data-plan-annotation="north-arrow" role="img" aria-label="${escapeXml(annotations.northArrow.label)}" fill="none" stroke="${PLAN_PALETTE.dimension}" stroke-width="${18 * scale}" stroke-linecap="round" font-family="Arial, sans-serif" font-size="${105 * scale}"><line x1="${annotations.northArrow.shaft.x1}" y1="${annotations.northArrow.shaft.y1}" x2="${annotations.northArrow.shaft.x2}" y2="${annotations.northArrow.shaft.y2}"/>${annotations.northArrow.head.map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"/>`).join('')}<text x="${annotations.northArrow.labelPoint.xMm}" y="${annotations.northArrow.labelPoint.yMm}" text-anchor="end" dominant-baseline="central" fill="${PLAN_PALETTE.dimension}" stroke="${PLAN_PALETTE.sheet}" stroke-width="${20 * scale}" paint-order="stroke">${escapeXml(annotations.northArrow.label)}</text></g>`
  const { attention: roomAttention, notEvaluated: roomPending } = scene.roomCheckCounts
  const checkLegend = options.showCheckMarks === false ? '' : `<g class="check-mark-legend" role="img" aria-label="${escapeXml(`${t(options.locale, 'checkMarkerLegendAttention')}; ${t(options.locale, 'checkMarkerLegendNotEvaluated')}`)}" font-family="Arial, sans-serif" font-size="${70 * scale}" font-weight="700"><path d="M-330 ${scene.legendY - 48 * scale} l38 ${72 * scale} h-76 z" fill="#8e2f21" stroke="#fffefa" stroke-width="${5 * scale}"/><text x="-275" y="${scene.legendY}" fill="#8e2f21">${escapeXml(t(options.locale, 'checkMarkerLegendAttention'))}</text><rect x="${260 * scale}" y="${scene.legendY - 45 * scale}" width="${56 * scale}" height="${56 * scale}" rx="${12 * scale}" fill="#175d91" stroke="#fffefa" stroke-width="${5 * scale}" stroke-dasharray="${5 * scale} ${3 * scale}"/><text x="${330 * scale}" y="${scene.legendY}" fill="#175d91">${escapeXml(t(options.locale, 'checkMarkerLegendNotEvaluated'))}</text>${roomAttention || roomPending ? `<text x="${820 * scale}" y="${scene.legendY}" fill="${PLAN_PALETTE.symbol}">${escapeXml(t(options.locale, 'roomCheckMarkers'))}: ${roomAttention ? `! ${roomAttention}` : ''}${roomAttention && roomPending ? ' · ' : ''}${roomPending ? `? ${roomPending}` : ''}</text>` : ''}</g>`
  const title = escapeXml(options.layoutLabel)
  const { x, y, width: viewWidth, height: viewHeight } = scene.viewBox
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-labelledby="plan-title plan-description" viewBox="${x} ${y} ${viewWidth} ${viewHeight}" width="${viewWidth}" height="${viewHeight}"><title id="plan-title">${title}</title><desc id="plan-description">${escapeXml(dimensionLabel)} · ${title}</desc><defs>${wetHatch}</defs><rect x="${x}" y="${y}" width="${viewWidth}" height="${viewHeight}" fill="${PLAN_PALETTE.sheet}"/>${wallMarkup}<rect width="${width}" height="${depth}" fill="${PLAN_PALETTE.floor}"/>${wetZoneMarkup}${overlayMarkup}${openingMarkup}${itemMarkup}${fixtureMarkup}${roomLabel}${scaleBar}${northArrow}${dimensionsMarkup}${checkLegend}</svg>`
}

function checkOutlineMarkup(status: EntityCheckStatus | undefined, rect: { x: number; y: number; width: number; height: number }, scale: number, radius = 0): string {
  if (!status || status.status === 'clear') return ''
  const attention = status.status === 'attention'
  const color = attention ? '#8e2f21' : '#175d91'
  const dash = attention ? '' : ` stroke-dasharray="${9 * scale} ${6 * scale}"`
  return `<rect class="check-marker-outline check-marker-outline-${status.status}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="none" stroke="${color}" stroke-width="${attention ? 32 * scale : 26 * scale}"${dash} vector-effect="non-scaling-stroke"/>`
}
