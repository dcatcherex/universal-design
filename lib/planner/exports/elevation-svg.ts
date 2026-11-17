import { t, type MessageKey } from '../i18n'
import type { ElevationModel } from '../elevation'
import type { EntityCheckStatus } from '../checks'
import type { Locale, Wall } from '../types'

const WALL_LABELS: Record<Wall, MessageKey> = { north: 'wallNorth', east: 'wallEast', south: 'wallSouth', west: 'wallWest' }
const BENCHMARK_LABELS = { 'th-public-building': 'benchmarkPublicShort', 'th-dop-home': 'benchmarkHomeShort' } as const

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

function centimetres(valueMm: number): string {
  return String(valueMm / 10)
}

function checkMark(status: EntityCheckStatus | undefined, entityId: string, x: number, y: number, label: string, locale: Locale, scale: number): string {
  if (!status || status.status === 'clear' || !status.resultIds[0]) return ''
  const attention = status.status === 'attention'
  const count = attention ? status.attentionCount : status.notEvaluatedCount
  const summary = t(locale, attention ? 'checkMarkerAttentionSummary' : 'checkMarkerNotEvaluatedSummary')
  const accessibleLabel = escapeXml(`${label}: ${count} ${summary}`)
  const badge = attention
    ? '<path d="M50 4 97 91H3Z" fill="#8e2f21" stroke="#fffefa" stroke-width="7"/>'
    : '<rect x="8" y="8" width="84" height="84" rx="18" fill="#175d91" stroke="#fffefa" stroke-width="7" stroke-dasharray="5 3"/>'
  return `<g transform="translate(${x} ${y}) scale(${4 * scale})" role="img" aria-label="${accessibleLabel}" data-check-mark="${status.status}" data-check-entity-id="${escapeXml(entityId)}" data-result-id="${escapeXml(status.resultIds[0])}">${badge}<text x="50" y="${attention ? 69 : 72}" text-anchor="middle" fill="#fffefa" font-size="64" font-weight="800">${attention ? '!' : '?'}</text><title>${accessibleLabel}</title></g>`
}

export function createElevationSvg(model: ElevationModel, locale: Locale, options: { checkStatuses?: ReadonlyMap<string, EntityCheckStatus>; showCheckMarks?: boolean } = {}): string {
  const wallX = 320, wallY = 120, right = 100, bottom = 120
  const wallBottom = wallY + model.heightMm
  const viewWidth = wallX + model.lengthMm + right
  const viewHeight = wallBottom + bottom
  const y = (heightMm: number) => wallBottom - heightMm
  const ticks = model.ticks.export
  const wallLabel = t(locale, WALL_LABELS[model.wall])
  const title = escapeXml(`${t(locale, 'wallView')}: ${wallLabel}`)
  const description = escapeXml(`${centimetres(model.lengthMm)} × ${centimetres(model.heightMm)} ${t(locale, 'unitCm')}`)
  const showCheckMarks = options.showCheckMarks !== false
  const reach = model.reachBand?.drawing.export.visible ? `<g data-reach-band="true"><rect x="${wallX}" y="${y(model.reachBand.drawing.export.highMm)}" width="${model.lengthMm}" height="${model.reachBand.drawing.export.highMm - model.reachBand.drawing.export.lowMm}" fill="#75a9c4" fill-opacity=".22"/><text x="${wallX + 20}" y="${model.reachBand.drawing.export.labelYmm}" font-family="sans-serif" font-size="80">${escapeXml(t(locale, 'reachBand'))} ${centimetres(model.reachBand.drawing.export.lowMm)}–${centimetres(model.reachBand.drawing.export.highMm)} ${escapeXml(t(locale, 'unitCm'))}</text><title>${escapeXml(t(locale, 'reachBand'))}: ${centimetres(model.reachBand.lowMm)}–${centimetres(model.reachBand.highMm)} ${escapeXml(t(locale, 'unitCm'))} · ${escapeXml(t(locale, model.reachBand.posture === 'standing' ? 'postureStanding' : 'postureSeated'))}</title></g>` : ''
  const benchmarks = model.benchmarkBands.map((band) => {
    const { highMm: high, rectHeightMm, labelYmm, visible } = band.drawing.export
    if (!visible) return ''
    const label = `${t(locale, BENCHMARK_LABELS[band.benchmarkId])} ${centimetres(band.minMm)}–${centimetres(band.maxMm)} ${t(locale, 'unitCm')}`
    const details = `${label} · ${band.clause}${band.pendingReview ? ` · ${t(locale, 'benchmarkPending')}` : ''}`
    return `<g data-benchmark-id="${escapeXml(band.benchmarkId)}"><rect x="${wallX}" y="${y(high)}" width="${model.lengthMm}" height="${rectHeightMm}" fill="${band.benchmarkId === 'th-public-building' ? '#d4b86a' : '#92aa8d'}" fill-opacity=".24"/><text x="${wallX + 20}" y="${labelYmm}" font-family="sans-serif" font-size="80">${escapeXml(label)}</text><title>${escapeXml(details)}</title></g>`
  }).join('')
  const openings = model.openings.map((opening) => {
    const label = t(locale, opening.kind)
    const width = opening.endMm - opening.startMm
    const height = opening.topMm - opening.bottomMm
    const status = showCheckMarks ? options.checkStatuses?.get(opening.id) : undefined
    const outline = status && status.status !== 'clear'
      ? `<rect x="${wallX + opening.checkOutline.startMm}" y="${y(opening.checkOutline.topMm)}" width="${opening.checkOutline.endMm - opening.checkOutline.startMm}" height="${opening.checkOutline.topMm - opening.checkOutline.bottomMm}" fill="none" stroke="${status.status === 'attention' ? '#8e2f21' : '#175d91'}" stroke-width="${status.status === 'attention' ? 32 : 26}"${status.status === 'not-evaluated' ? ' stroke-dasharray="9 6"' : ''}/>`
      : ''
    return `<g data-opening-id="${escapeXml(opening.id)}" data-entity-check-status="${status?.status ?? ''}">${outline}<rect x="${wallX + opening.startMm}" y="${y(opening.topMm)}" width="${width}" height="${height}" fill="${opening.kind === 'window' ? '#c9dce5' : '#fffefa'}" stroke="#628c72" stroke-width="14"/><text x="${wallX + opening.startMm + width / 2}" y="${y(opening.topMm) + height / 2}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="90">${escapeXml(label)}</text>${showCheckMarks ? checkMark(status, opening.id, wallX + opening.badgePoint.alongMm, y(opening.badgePoint.heightMm), label, locale, 1) : ''}<title>${escapeXml(label)} · ${width} × ${height} mm</title></g>`
  }).join('')
  const silhouettes = model.silhouettes.map((item) => {
    const { startMm: start, endMm: end, centerMm, visible } = item.drawing.export
    if (!visible) return ''
    return `<g data-silhouette-id="${escapeXml(item.id)}"><rect x="${wallX + start}" y="${y(item.topMm)}" width="${end - start}" height="${item.topMm}" rx="30" fill="#718078" fill-opacity=".18" stroke="#587064" stroke-width="12" stroke-dasharray="50 34"/><text x="${wallX + centerMm}" y="${y(item.topMm / 2)}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="80">${escapeXml(item.label)}</text><title>${escapeXml(item.label)}</title></g>`
  }).join('')
  const fixtures = model.fixtures.map((fixture) => {
    const width = fixture.endMm - fixture.startMm
    const height = fixture.topMm - fixture.bottomMm
    const label = escapeXml(fixture.label)
    const status = showCheckMarks ? options.checkStatuses?.get(fixture.id) : undefined
    const outline = status && status.status !== 'clear'
      ? `<rect x="${wallX + fixture.checkOutline.startMm}" y="${y(fixture.checkOutline.topMm)}" width="${fixture.checkOutline.endMm - fixture.checkOutline.startMm}" height="${fixture.checkOutline.topMm - fixture.checkOutline.bottomMm}" fill="none" stroke="${status.status === 'attention' ? '#8e2f21' : '#175d91'}" stroke-width="${status.status === 'attention' ? 32 : 26}"${status.status === 'not-evaluated' ? ' stroke-dasharray="9 6"' : ''}/>`
      : ''
    return `<g data-fixture-id="${escapeXml(fixture.id)}" data-entity-check-status="${status?.status ?? ''}">${outline}<rect x="${wallX + fixture.startMm}" y="${y(fixture.topMm)}" width="${width}" height="${height}" rx="12" fill="#2f6f8f" fill-opacity=".82" stroke="#21382d" stroke-width="10"/><text x="${wallX + (fixture.startMm + fixture.endMm) / 2}" y="${y(fixture.topMm) - 35}" text-anchor="middle" font-family="sans-serif" font-size="80">${label}</text>${showCheckMarks ? checkMark(status, fixture.id, wallX + fixture.badgePoint.alongMm, y(fixture.badgePoint.heightMm), fixture.label, locale, 1) : ''}<title>${label} · ${fixture.referenceHeightMm} mm</title></g>`
  }).join('')
  const heightScale = `<g class="elevation-height-scale">${ticks.map((mm) => `<g><line x1="${wallX - 18}" y1="${y(mm)}" x2="${wallX + model.lengthMm}" y2="${y(mm)}" stroke="#68705a" stroke-opacity=".22" stroke-width="5"/><line x1="${wallX - 18}" y1="${y(mm)}" x2="${wallX + 8}" y2="${y(mm)}" stroke="#68705a" stroke-width="8"/><text x="${wallX - 35}" y="${y(mm)}" text-anchor="end" dominant-baseline="central" font-family="sans-serif" font-size="90">${centimetres(mm)}</text></g>`).join('')}<text x="${wallX - 190}" y="${wallY + model.heightMm / 2}" transform="rotate(-90 ${wallX - 190} ${wallY + model.heightMm / 2})" text-anchor="middle" font-family="sans-serif" font-size="80">${escapeXml(t(locale, 'unitCm'))}</text></g>`
  const checkLegend = showCheckMarks ? `<g class="check-mark-legend" font-family="sans-serif" font-size="52" font-weight="700"><path d="M${wallX} ${wallBottom + 78} l28 52 h-56 z" fill="#8e2f21"/><text x="${wallX + 42}" y="${wallBottom + 120}" fill="#8e2f21">${escapeXml(t(locale, 'checkMarkerLegendAttention'))}</text><rect x="${wallX + 470}" y="${wallBottom + 72}" width="48" height="48" rx="10" fill="#175d91" stroke-dasharray="5 3"/><text x="${wallX + 530}" y="${wallBottom + 120}" fill="#175d91">${escapeXml(t(locale, 'checkMarkerLegendNotEvaluated'))}</text></g>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="elevation-title elevation-description" viewBox="0 0 ${viewWidth} ${viewHeight}" width="${viewWidth}" height="${viewHeight}"><title id="elevation-title">${title}</title><desc id="elevation-description">${description}</desc><defs><clipPath id="elevation-wall-clip"><rect x="${wallX}" y="${wallY}" width="${model.lengthMm}" height="${model.heightMm}"/></clipPath></defs><rect width="${viewWidth}" height="${viewHeight}" fill="#fffefa"/><rect x="${wallX}" y="${wallY}" width="${model.lengthMm}" height="${model.heightMm}" fill="#f4f1e6" stroke="#68705a" stroke-width="24"/><g clip-path="url(#elevation-wall-clip)">${reach}${benchmarks}${openings}${silhouettes}${fixtures}</g>${heightScale}<line x1="${wallX - 24}" y1="${wallBottom}" x2="${wallX + model.lengthMm + 24}" y2="${wallBottom}" stroke="#68705a" stroke-width="28"/>${checkLegend}</svg>`
}
