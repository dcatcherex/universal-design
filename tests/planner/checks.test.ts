import { describe, expect, it } from 'vitest'
import { createExampleProject } from '../../lib/planner/fixtures'
import { getDoorSector, sectorIntersectsRect, getFootprint } from '../../lib/planner/geometry'
import { evaluateLayout } from '../../lib/planner/checks'
import type { Project } from '../../lib/planner/types'

const now = '2026-09-28T00:00:00.000Z'
const projectFixture = () => createExampleProject(now)
const resultsFor = (project: Project, layoutId: 'current' | 'proposed' = 'current') => evaluateLayout(project, layoutId)

function onlyRule(project: Project, ruleId: string, layoutId: 'current' | 'proposed' = 'current') {
  return resultsFor(project, layoutId).filter((result) => result.ruleId === ruleId)
}

describe('explainable derived checks', () => {
  it('flags the fictional current corridor and clears the independent proposal', () => {
    const project = projectFixture()
    expect(onlyRule(project, 'G04', 'current')).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'attention', entityIds: expect.arrayContaining(['example-route', 'coffee-table-1']) }),
    ]))
    expect(onlyRule(project, 'G04', 'proposed')).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'clear', entityIds: ['example-route'] }),
    ]))
  })

  it('returns not-evaluated summaries when route and turning data are absent', () => {
    const project = projectFixture()
    project.current.routes = []
    project.current.turningAreas = []
    expect(onlyRule(project, 'G04')).toEqual([expect.objectContaining({ status: 'not-evaluated', entityIds: [] })])
    expect(onlyRule(project, 'G05')).toEqual([expect.objectContaining({ status: 'not-evaluated', entityIds: [] })])
  })

  it('keeps an overlay without its own or inherited target not-evaluated', () => {
    const project = projectFixture()
    project.current.routes[0].widthMm = null
    project.targets.routeWidth = null
    const result = onlyRule(project, 'G04')[0]
    expect(result.status).toBe('not-evaluated')
    expect(result.measuredMm).toBeUndefined()
    expect(result.evidence.origin).toBe('custom-overlay')
  })

  it('labels inherited widths as project targets and explicit widths as custom overlays', () => {
    const project = projectFixture()
    project.current.routes[0].widthMm = null
    project.targets.routeWidth = { valueMm: 1100, rationale: 'Discussed for this project', enteredBy: 'Advisor', enteredAt: now }
    const inherited = onlyRule(project, 'G04')[0]
    expect(inherited.evidence.origin).toBe('project-target')
    expect(inherited.targetMm).toBe(1100)
    project.current.routes[0].widthMm = 1000
    const explicit = onlyRule(project, 'G04')[0]
    expect(explicit.evidence.origin).toBe('custom-overlay')
    expect(explicit.evidence.confidence).toBe('estimated')
  })

  it('does not let an unrelated clear route cancel a blocked route', () => {
    const project = projectFixture()
    project.current.routes.push({ id: 'open-route', label: 'Separate route', points: [{ xMm: 500, yMm: 1000 }, { xMm: 5500, yMm: 1000 }], widthMm: 300 })
    const routes = onlyRule(project, 'G04')
    expect(routes).toHaveLength(2)
    expect(routes.find((result) => result.entityIds.includes('example-route'))?.status).toBe('attention')
    expect(routes.find((result) => result.entityIds.includes('open-route'))?.status).toBe('clear')
  })

  it('uses round corridor caps at corners instead of only straight rectangles', () => {
    const project = projectFixture()
    const layout = project.current
    layout.items = [
      { ...layout.items[0], id: 'corner-obstacle', catalogId: 'custom-block', center: { xMm: 2350, yMm: 2650 }, width: { valueMm: 100, confidence: 'measured' }, depth: { valueMm: 100, confidence: 'measured' } },
    ]
    layout.routes = [{ id: 'turning-route', label: 'Turn', points: [{ xMm: 1000, yMm: 3000 }, { xMm: 2000, yMm: 3000 }, { xMm: 2000, yMm: 4000 }], widthMm: 1000 }]
    expect(onlyRule(project, 'G04')[0]).toMatchObject({ status: 'attention', entityIds: ['corner-obstacle', 'turning-route'] })
  })

  it('flags a corridor that extends one millimetre beyond the room', () => {
    const project = projectFixture()
    project.current.routes = [{ id: 'edge-route', label: 'Near edge', points: [{ xMm: 500, yMm: 250 }, { xMm: 5500, yMm: 250 }], widthMm: 502 }]
    expect(onlyRule(project, 'G04')[0].status).toBe('attention')
  })

  it('treats a turning circle tangent to a wall as clear and a 1mm intrusion as attention', () => {
    const project = projectFixture()
    project.current.turningAreas = [{ id: 'turning-space', label: 'Turning area', center: { xMm: 500, yMm: 2500 }, diameterMm: 1000 }]
    expect(onlyRule(project, 'G05')[0].status).toBe('clear')
    project.current.turningAreas[0].center.xMm = 499
    expect(onlyRule(project, 'G05')[0].status).toBe('attention')
  })

  it('does not treat rugs as solid collisions but adds a manual-review reminder', () => {
    const project = projectFixture()
    const sofa = project.current.items[0]
    project.current.items = [
      sofa,
      { ...sofa, id: 'rug-1', catalogId: 'rug', obstruction: 'rug', center: { xMm: sofa.center.xMm, yMm: sofa.center.yMm } },
    ]
    expect(onlyRule(project, 'G02').some((result) => result.status === 'attention')).toBe(false)
    expect(onlyRule(project, 'M01')).toEqual([expect.objectContaining({ status: 'attention', entityIds: ['rug-1'] })])
  })

  it('creates a manual-review entry for a measured door threshold', () => {
    const project = projectFixture()
    project.current.openings[0].threshold = { valueMm: 35, confidence: 'measured' }
    expect(onlyRule(project, 'M01')[0]).toMatchObject({ status: 'attention', entityIds: ['entry-door'] })
    expect(onlyRule(project, 'M01')[0].evidence.confidence).toBe('measured')
  })

  it('does not invent a door-swing collision for a sliding opening', () => {
    const project = projectFixture()
    const door = project.current.openings.find((opening) => opening.kind === 'door')!
    door.operation = 'sliding'
    door.hinge = undefined
    project.current.items = [{ ...project.current.items[0], center: { xMm: 800, yMm: 400 } }]
    expect(onlyRule(project, 'G03').some((result) => result.status === 'attention')).toBe(false)
  })

  it.each(['north', 'east', 'south', 'west'] as const)('uses the shared hinge sector for %s-wall door hinges', (wall) => {
    for (const hinge of ['start', 'end'] as const) {
      const project = projectFixture()
      const door = project.current.openings.find((opening) => opening.kind === 'door')!
      door.wall = wall
      door.offset = { valueMm: 300, confidence: 'measured' }
      door.width = { valueMm: 900, confidence: 'measured' }
      door.hinge = hinge
      const sector = getDoorSector(door, project.current.room)!
      const radians = (sector.startAngleDeg + sector.sweepDeg / 2) * Math.PI / 180
      const item = { ...project.current.items[0], id: 'swing-obstacle', center: { xMm: Math.round(sector.hinge.xMm + Math.cos(radians) * 500), yMm: Math.round(sector.hinge.yMm + Math.sin(radians) * 500) } }
      const fp = getFootprint(item)
      expect(sectorIntersectsRect(sector, fp), `${wall} ${hinge} fixture`).toBe(true)
      project.current.items = [item]
      expect(onlyRule(project, 'G03')[0], `${wall} ${hinge} result`).toMatchObject({ status: 'attention', entityIds: expect.arrayContaining(['swing-obstacle', door.id]) })
    }
  })

  it('produces stable IDs independent of item iteration order and never implies measured certainty', () => {
    const project = projectFixture()
    const first = onlyRule(project, 'G04')[0]
    const reversed: Project = { ...project, current: { ...project.current, items: [...project.current.items].reverse() } }
    const second = onlyRule(reversed, 'G04')[0]
    expect(second.id).toBe(first.id)
    expect(first.evidence.confidence).toBe('estimated')
    expect(first.evidence.origin).toBe('custom-overlay')
    expect(first.evidence.limitationKey).toBeTruthy()
  })
})
