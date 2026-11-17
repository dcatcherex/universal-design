import { describe, expect, it } from 'vitest'
import { evaluateLayout, getEntityStatuses } from '../../lib/planner/checks'
import { createBathroomExampleProject, createExampleProject } from '../../lib/planner/fixtures'
import { createFixture } from '../../lib/planner/fixtures-catalog'
import { getPrimaryFloor, getPrimaryRoom } from '../../lib/planner/layout-access'
import { buildPlanScene } from '../../lib/planner/plan-scene'

const now = '2026-09-28T10:00:00.000Z'
const baseOptions = {
  locale: 'en' as const,
  showOverlays: false,
  showDimensions: false,
  showCheckMarks: false,
}

describe('buildPlanScene', () => {
  it('derives item selection, check marks, and clearance dimensions from one scene', () => {
    const project = createBathroomExampleProject(now, 'en')
    const statuses = getEntityStatuses(evaluateLayout(project, 'current'))
    const scene = buildPlanScene(project.current, {
      ...baseOptions,
      showDimensions: true,
      showCheckMarks: true,
      selectedItemId: 'toilet-1',
      checkStatuses: statuses,
    })

    const toilet = scene.primitives.find((primitive) => primitive.kind === 'item' && primitive.entity.id === 'toilet-1')
    expect(toilet).toMatchObject({ selected: true, checkStatus: { status: 'attention' } })
    if (toilet?.kind !== 'item') throw new Error('Expected the toilet scene primitive')
    expect(toilet.geometry.badgePoints.world).toEqual({
      xMm: toilet.entity.center.xMm - toilet.entity.width.valueMm / 2,
      yMm: toilet.entity.center.yMm + toilet.entity.depth.valueMm / 2,
    })
    expect(scene.primitives.filter((primitive) => primitive.kind === 'dimension' && primitive.geometry.kind === 'clearance')).toHaveLength(4)
  })

  it('omits check state and dimensions when their options are disabled', () => {
    const project = createBathroomExampleProject(now, 'en')
    const statuses = getEntityStatuses(evaluateLayout(project, 'current'))
    const scene = buildPlanScene(project.current, {
      ...baseOptions,
      checkStatuses: statuses,
    })

    const toilet = scene.primitives.find((primitive) => primitive.kind === 'item' && primitive.entity.id === 'toilet-1')
    expect(toilet?.kind === 'item' && toilet.checkStatus).toBeUndefined()
    expect(scene.primitives.some((primitive) => primitive.kind === 'dimension')).toBe(false)
  })

  it('includes floor overlays only when requested and records renderer-specific unresolved route styling', () => {
    const layout = createExampleProject(now, 'en').current
    const withoutOverlays = buildPlanScene(layout, baseOptions)
    const withOverlays = buildPlanScene(layout, { ...baseOptions, showOverlays: true })
    const route = withOverlays.primitives.find((primitive) => primitive.kind === 'route')

    expect(withoutOverlays.primitives.some((primitive) => primitive.kind === 'route')).toBe(false)
    expect(route).toMatchObject({ kind: 'route', geometry: { opacity: { canvas: 0.18, export: 0.16 } } })
  })

  it('builds bathroom primitives and preserves both documented defaults for an unknown turning diameter', () => {
    const layout = createBathroomExampleProject(now, 'en').current
    const room = getPrimaryRoom(layout)
    room.fixtures.push(createFixture('grab-bar-horizontal', 'north', room, 'scene-fixture', 'Grab bar'))
    const floor = getPrimaryFloor(layout)
    floor.turningAreas.push({
      id: 'unknown-turning-area',
      label: 'Unmeasured turning area',
      center: { xMm: 1000, yMm: 900 },
      diameterMm: null,
    })
    const scene = buildPlanScene(layout, { ...baseOptions, showOverlays: true })

    expect(scene.primitives.some((primitive) => primitive.kind === 'wet-zone')).toBe(true)
    expect(scene.primitives.some((primitive) => primitive.kind === 'fixture')).toBe(true)
    expect(scene.primitives.some((primitive) => primitive.kind === 'opening')).toBe(true)
    expect(scene.primitives.find((primitive) => primitive.kind === 'turning-area')).toMatchObject({
      geometry: { radiusMm: { canvas: 200, export: 400 } },
    })
  })

  it('uses a move preview for the item primitive and selected clearance dimensions', () => {
    const layout = createExampleProject(now, 'en').current
    const room = getPrimaryRoom(layout)
    const item = room.items[0]
    const scene = buildPlanScene(layout, {
      ...baseOptions,
      showDimensions: true,
      selectedItemId: item.id,
      movePreview: { id: item.id, xMm: 2000, yMm: 2500 },
    })

    expect(scene.primitives.find((primitive) => primitive.kind === 'item' && primitive.entity.id === item.id))
      .toMatchObject({ kind: 'item', geometry: { center: { xMm: 2000, yMm: 2500 } } })
    expect(scene.primitives.find((primitive) => primitive.kind === 'dimension' && primitive.geometry.id === 'clearance-north'))
      .toMatchObject({ kind: 'dimension', geometry: { valueMm: 2050 } })
  })
})
