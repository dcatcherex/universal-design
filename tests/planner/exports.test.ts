import { describe, expect, it } from 'vitest'
import { getFootprint } from '../../lib/planner/geometry'
import { buildElevation } from '../../lib/planner/elevation'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { benchmarkContextFor } from '../../lib/planner/resident-needs'
import { createElevationSvg } from '../../lib/planner/exports/elevation-svg'
import { buildReportData } from '../../lib/planner/exports/report-data'
import { createPlanSvg } from '../../lib/planner/exports/plan-svg'
import { buildPlanDrawing, PLAN_WALL_THICKNESS_MM, planSymbol } from '../../lib/planner/plan-drawing'
import { buildDimensionChains, buildPlanDimensions, PLAN_DIMENSION_MARGIN_MM } from '../../lib/planner/plan-dimensions'
import { buildPlanAnnotations, PLAN_SCALE_BAR_LENGTH_MM } from '../../lib/planner/plan-annotations'
import { PLAN_PALETTE } from '../../lib/planner/plan-palette'
import { buildPlanSchedule } from '../../lib/planner/plan-schedule'
import { createBathroomExampleProject, createExampleProject } from '../../lib/planner/fixtures'
import { checkViewFromResults, evaluateLayout } from '../../lib/planner/checks'
import { createFixture } from '../../lib/planner/fixtures-catalog'
import { CATALOG } from '../../lib/planner/catalog'
import type { CheckResult, Layout } from '../../lib/planner/types'

const now = '2026-09-28T10:00:00.000Z'

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('plan and report exports', () => {
  it('keeps semantic plan colors above WCAG AA non-text contrast', () => {
    const nonTextColors = [
      PLAN_PALETTE.wall, PLAN_PALETTE.symbol, PLAN_PALETTE.dimension,
      PLAN_PALETTE.selection, PLAN_PALETTE.changed, PLAN_PALETTE.route,
      PLAN_PALETTE.turning, PLAN_PALETTE.wet, PLAN_PALETTE.fall,
    ]
    for (const color of nonTextColors) {
      expect(contrastRatio(color, PLAN_PALETTE.sheet), `${color} on plan sheet`).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(color, PLAN_PALETTE.floor), `${color} on room floor`).toBeGreaterThanOrEqual(3)
    }
    for (const color of [PLAN_PALETTE.symbol, PLAN_PALETTE.areaLabel, PLAN_PALETTE.dimension, PLAN_PALETTE.changed, PLAN_PALETTE.fall]) {
      expect(contrastRatio(color, PLAN_PALETTE.floor), `${color} as plan text`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('exports millimetre furniture geometry, rotation, and visible overlays', () => {
    const project = createExampleProject(now)
    getPrimaryRoom(project.current).items[0].rotationDeg = 90
    const svg = createPlanSvg(project.current, { locale: 'th', layoutLabel: 'แผนปัจจุบัน', showOverlays: true })
    expect(svg).toContain(`viewBox="-${PLAN_DIMENSION_MARGIN_MM} -${PLAN_DIMENSION_MARGIN_MM} 6720 5720"`)
    expect(svg).toContain('data-footprint="2550 3150 3450 5250"')
    expect(svg).toContain('rotate(90)')
    expect(svg).toContain('แนวทางเดินตัวอย่าง')
    expect(svg).toContain('class="plan-wall"')
    expect(svg).toContain('data-dimension-id="overall-width"')
    expect(svg).toContain('6.00 m')
    expect(svg).toContain('data-dimension-kind="chain"')
    expect(svg).toContain('data-item-number="1"')
    expect(svg).toContain('<text class="plan-item-number"')
    expect(svg).toContain(`stroke="${PLAN_PALETTE.route}"`)
    expect(svg).toContain('stroke-dasharray="80 60"')
    expect(createPlanSvg(project.current, { locale: 'th', layoutLabel: 'ปัจจุบัน', showOverlays: false, showDimensions: false })).not.toContain('data-dimension-id')
    const selectedSvg = createPlanSvg(createBathroomExampleProject(now, 'th').current, { locale: 'th', layoutLabel: 'ห้องน้ำ', showOverlays: false, selectedItemId: 'toilet-1' })
    expect(selectedSvg.match(/data-dimension-kind="clearance"/g)).toHaveLength(4)
    expect(selectedSvg).toContain(`class="selected" data-item-id="toilet-1"`)
    expect(selectedSvg).toContain(`stroke="${PLAN_PALETTE.selection}"`)
    const bathroom = createPlanSvg(createBathroomExampleProject(now, 'th').current, { locale: 'th', layoutLabel: 'ห้องน้ำ', showOverlays: true })
    expect(bathroom).toContain('<ellipse')
    expect(bathroom).toContain('id="plan-wet-zone-hatch"')
    expect(bathroom).toContain('fill="url(#plan-wet-zone-hatch)"')
    expect(createPlanSvg(project.current, { locale: 'th', layoutLabel: 'ปัจจุบัน', showOverlays: false })).not.toContain('data-overlay-id="example-route"')
  })

  it('exports check marks with the same attention and not-evaluated semantics as the plan', () => {
    const project = createBathroomExampleProject(now, 'en')
    const results = evaluateLayout(project, 'current')
    const checkView = checkViewFromResults(results)
    const room = getPrimaryRoom(project.current)
    const svg = createPlanSvg(project.current, {
      locale: 'en',
      layoutLabel: 'Current plan',
      showOverlays: true,
      showCheckMarks: true,
      checkView,
    })

    expect(svg).toContain('data-opening-id="bathroom-door"')
    expect(svg).toContain('data-item-id="toilet-1"')
    expect(svg).toContain('data-check-mark="attention"')
    expect(svg).toContain('Room-level checks: ? 3')
    expect(svg).toContain('Solid outline + !: needs attention')
    expect(svg).toContain('Dashed outline + ?: not evaluated')

    const pendingResult: CheckResult = {
      id: 'pending-toilet-result', ruleId: 'B02', layoutId: 'current', roomId: room.id, entityIds: ['toilet-1'],
      status: 'not-evaluated', messageKey: 'checks.toiletNotEvaluated', verdicts: [], basis: 'benchmark', nearFall: false,
      evidence: { confidence: 'estimated', origin: 'benchmark', limitationKey: 'checks.toiletLimit' },
    }
    const pendingSvg = createPlanSvg(project.current, {
      locale: 'en', layoutLabel: 'Current plan', showOverlays: true, checkView: checkViewFromResults([pendingResult]),
    })
    expect(pendingSvg).toContain('data-check-mark="not-evaluated"')
    expect(pendingSvg).toContain('data-check-entity-id="toilet-1"')

    const jar = room.items.find((item) => item.id === 'water-jar-1')!
    jar.center = { xMm: 1500, yMm: 400 }
    const outsideWetView = checkViewFromResults(evaluateLayout(project, 'current'))
    expect(outsideWetView.byEntity.get(jar.id)?.status).not.toBe('attention')
    const outsideWetSvg = createPlanSvg(project.current, {
      locale: 'en', layoutLabel: 'Current plan', showOverlays: true,
      checkView: outsideWetView,
    })
    expect(outsideWetSvg).not.toContain('data-check-entity-id="water-jar-1"')

    const hiddenMarks = createPlanSvg(project.current, {
      locale: 'en', layoutLabel: 'Current plan', showOverlays: true, showCheckMarks: false, checkView,
    })
    expect(hiddenMarks).not.toContain('data-check-mark=')
  })

  it('escapes Thai labels and script-like project text instead of inserting markup', () => {
    const layout = createExampleProject(now).current
    getPrimaryRoom(layout).items[0].label = '<script>alert("x")</script>'
    const svg = createPlanSvg(layout, { locale: 'en', layoutLabel: 'Before <room>', showOverlays: true })
    expect(svg).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(svg).toContain('Before &lt;room&gt;')
    expect(svg).not.toContain('<script>')
  })

  it('cuts openings from 100 mm wall bands and draws hinged, sliding, and window symbols', () => {
    const project = createBathroomExampleProject(now, 'en')
    const room = getPrimaryRoom(project.current)
    const drawing = buildPlanDrawing(room)
    const north = drawing.walls.filter((wall) => wall.y === -PLAN_WALL_THICKNESS_MM)
    expect(north).toEqual([
      { x: 0, y: -100, width: 200, height: 100 },
      { x: 900, y: -100, width: 1100, height: 100 },
    ])

    const door = drawing.openings.find((entry) => entry.opening.id === 'bathroom-door')
    expect(door).toMatchObject({ doorLeaf: { x1: 200, y1: 0 }, outward: false })
    expect(door?.swingPath).toContain('A 700 700')

    const sliding = buildPlanDrawing({ ...room, openings: [{ ...room.openings[0], operation: 'sliding' }] }).openings[0]
    expect(sliding.doorLeaf).not.toBeNull()
    expect(sliding.slidingArrow).toContain('L')

    const window = buildPlanDrawing({ ...room, openings: [{ ...room.openings[0], kind: 'window' }] }).openings[0]
    expect(window.windowLines).toHaveLength(2)

    const eastDoor = { ...room.openings[0], id: 'east-door', wall: 'east' as const, operation: 'hinged-out' as const }
    const eastDrawing = buildPlanDrawing({ ...room, openings: [eastDoor] })
    expect(eastDrawing.walls.filter((wall) => wall.x === room.shape.width.valueMm).map(({ y, height }) => [y, height])).toEqual([[0, 200], [900, 900]])
    expect(eastDrawing.openings[0].outward).toBe(true)
  })

  it('keeps every catalog symbol inside its normalized footprint and provides an unknown fallback', () => {
    const inside = (value: number) => value >= 0 && value <= 1
    for (const id of [...CATALOG.map((entry) => entry.id), 'bed']) {
      for (const mark of planSymbol(id)) {
        if (mark.kind === 'rect') expect([mark.x, mark.y, mark.x + mark.width, mark.y + mark.height].every(inside), id).toBe(true)
        if (mark.kind === 'ellipse') expect([mark.cx - mark.rx, mark.cy - mark.ry, mark.cx + mark.rx, mark.cy + mark.ry].every(inside), id).toBe(true)
        if (mark.kind === 'line') expect([mark.x1, mark.y1, mark.x2, mark.y2].every(inside), id).toBe(true)
      }
    }
    expect(planSymbol('from-a-newer-file').some((mark) => mark.kind === 'line')).toBe(true)
    expect(planSymbol('basin').filter((mark) => mark.kind === 'ellipse')).toHaveLength(2)
    expect(planSymbol('bed').filter((mark) => mark.kind === 'rect')).toHaveLength(3)
  })

  it('builds complete opening chains and rotated-item clearances in millimetres', () => {
    const room = getPrimaryRoom(createBathroomExampleProject(now, 'en').current)
    const single = buildDimensionChains(room).find((chain) => chain.wall === 'north')!
    expect(single.segments.map((segment) => segment.lengthMm)).toEqual([200, 700, 1100])
    expect(single.segments.reduce((sum, segment) => sum + segment.lengthMm, 0)).toBe(single.lengthMm)

    const secondOpening = { ...room.openings[0], id: 'north-window', kind: 'window' as const, offset: { ...room.openings[0].offset, valueMm: 1200 }, width: { ...room.openings[0].width, valueMm: 500 } }
    const double = buildDimensionChains({ ...room, openings: [...room.openings, secondOpening] }).find((chain) => chain.wall === 'north')!
    expect(double.segments.map((segment) => segment.lengthMm)).toEqual([200, 700, 300, 500, 300])
    expect(double.segments.reduce((sum, segment) => sum + segment.lengthMm, 0)).toBe(double.lengthMm)

    const toilet = { ...room.items[0], rotationDeg: 90 as const }
    const clearances = buildPlanDimensions(room, toilet).filter((dimension) => dimension.kind === 'clearance')
    expect(clearances.map((dimension) => [dimension.side, dimension.valueMm, dimension.label])).toEqual([
      ['north', 1200, '1.20 m'], ['east', 175, '0.18 m'], ['south', 200, '0.20 m'], ['west', 1175, '1.18 m'],
    ])
  })

  it('places the room label clear of furniture and builds a metre scale and north arrow', () => {
    const room = getPrimaryRoom(createBathroomExampleProject(now, 'en').current)
    room.items = []
    const labels = { roomType: 'Bathroom', planNorth: 'Plan north', scaleBar: '1 m' }
    const centered = buildPlanAnnotations(room, labels)
    expect(centered.roomLabel.point).toEqual({ xMm: 1000, yMm: 900 })
    expect(centered.roomLabel.areaLabel).toBe('3.60 m²')
    expect(centered.scaleBar.line.x2 - centered.scaleBar.line.x1).toBe(PLAN_SCALE_BAR_LENGTH_MM)
    expect(centered.scaleBar.label).toBe('1 m')
    expect(centered.northArrow.shaft.y2).toBeLessThan(centered.northArrow.shaft.y1)
    expect(centered.northArrow.label).toBe('Plan north')

    const item = getPrimaryRoom(createBathroomExampleProject(now, 'en').current).items[0]
    room.items = [{ ...item, center: { xMm: 1000, yMm: 900 }, width: { ...item.width, valueMm: 700 }, depth: { ...item.depth, valueMm: 600 } }]
    const shifted = buildPlanAnnotations(room, labels)
    const footprint = getFootprint(room.items[0])
    const bounds = shifted.roomLabel.bounds
    expect(shifted.roomLabel.point).not.toEqual({ xMm: 1000, yMm: 900 })
    expect(bounds.minX < footprint.maxX && bounds.maxX > footprint.minX && bounds.minY < footprint.maxY && bounds.maxY > footprint.minY).toBe(false)
  })

  it('numbers schedule items in layout order and lists wall fixture heights above the floor', () => {
    const room = getPrimaryRoom(createBathroomExampleProject(now, 'en').current)
    const item = room.items[0]
    room.items = [
      { ...item, id: 'second-id', label: 'Second row', width: { ...item.width, valueMm: 750 }, depth: { ...item.depth, valueMm: 900 } },
      { ...item, id: 'first-id', label: 'First row', width: { ...item.width, valueMm: 1100 }, depth: { ...item.depth, valueMm: 600 } },
    ]
    room.fixtures = [createFixture('grab-bar-horizontal', 'north', room, 'schedule-bar', 'Grab bar', { referenceHeight: 750 })]

    const schedule = buildPlanSchedule(room)

    expect(schedule.items.map(({ number, id, label, widthLabel, depthLabel }) => [number, id, label, widthLabel, depthLabel])).toEqual([
      [1, 'second-id', 'Second row', '0.75 m', '0.90 m'],
      [2, 'first-id', 'First row', '1.10 m', '0.60 m'],
    ])
    expect(schedule.fixtures[0]).toMatchObject({ id: 'schedule-bar', wall: 'north', referenceHeightMm: 750, heightLabel: '0.75 m' })
  })

  it('exports the selected wall fixtures, openings and centimetre height scale with escaped labels', () => {
    const project = createBathroomExampleProject(now, 'en')
    const room = getPrimaryRoom(project.current)
    const fixture = createFixture('grab-bar-horizontal', 'north', room, 'export-bar', '<script>alert("x")</script>', { offset: 1300 })
    room.fixtures = [fixture]
    const model = buildElevation(room, 'north', project.resident, fixture.id, benchmarkContextFor(project, room))
    const svg = createElevationSvg(model, 'en')

    expect(svg).toContain('data-fixture-id="export-bar"')
    expect(svg).toContain('data-opening-id="bathroom-door"')
    expect(svg).toContain('class="elevation-height-scale"')
    expect(svg).toContain('>250</text>')
    expect(svg).toContain('cm</text>')
    expect(svg).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(svg).not.toContain('<script>')
  })

  it('builds fresh checks after layout edits and labels a missing proposed plan', () => {
    const project = createExampleProject(now)
    project.proposed = null
    const before = buildReportData(project, 'en')
    const edited: Layout = structuredClone(project.current)
    getPrimaryRoom(edited).items.find((item) => item.id === 'coffee-table-1')!.center.yMm = 1800
    project.current = edited
    project.revision += 1
    const after = buildReportData(project, 'en')
    expect(before.projectRevision).toBe(0)
    expect(after.projectRevision).toBe(1)
    expect(after.plans.current.checks.find((check) => check.ruleId === 'G04')?.status).toBe('clear')
    expect(after.plans.proposed.layout).toBeNull()
    expect(after.plans.proposed.label).toBe('Proposed plan not created')
  })

  it('includes review revision, confidence, recommendations, and unknown costs in a consistent snapshot', () => {
    const project = createExampleProject(now)
    project.review = { reviewerName: 'Advisor', reviewedAt: now, projectRevision: 0, benchmarkDatasetVersion: '2026.10-draft' }
    project.recommendations.push({ id: 'estimate-1', layoutId: 'current', title: 'Keep costs unknown', reason: 'No quote', action: 'Ask later', priority: 'later', workType: 'site-review', status: 'accepted', advisorNote: '', materials: null, labour: null })
    const report = buildReportData(project, 'th')
    expect(report.review).toMatchObject({ status: 'reviewed', receipt: { projectRevision: 0, reviewerName: 'Advisor' } })
    expect(getPrimaryRoom(report.plans.current.layout!).shape.width.confidence).toBe('estimated')
    expect(report.costs).toEqual({ lowSatang: 0, highSatang: 0, missingComponents: 2, includedCount: 1 })
    expect(report.recommendations[0].materials).toBeNull()
  })
})
