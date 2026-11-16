import { describe, expect, it } from 'vitest'
import { evaluateLayout, resultNeedsProfessionalCheck, sortCheckResults } from '../../lib/planner/checks'
import { applyCommand } from '../../lib/planner/commands'
import { createBathroomExampleProject, createCatalogItem, createExampleProject } from '../../lib/planner/fixtures'
import { createFixture } from '../../lib/planner/fixtures-catalog'
import { getReviewStatus } from '../../lib/planner/history'
import { en } from '../../lib/planner/locales/en'
import { getPrimaryFloor, getPrimaryRoom } from '../../lib/planner/layout-access'
import { validateProject } from '../../lib/planner/schema'
import type { BenchmarkId, CheckResult, Measurement, Project, RuleId, WallFixture } from '../../lib/planner/types'

const now = '2026-09-28T00:00:00.000Z'
const m = (valueMm: number): Measurement => ({ valueMm, confidence: 'estimated' })
const bathroom = () => createBathroomExampleProject(now)
const living = () => createExampleProject(now)
const rule = (project: Project, ruleId: RuleId, layoutId: 'current' | 'proposed' = 'current') => evaluateLayout(project, layoutId).filter((result) => result.ruleId === ruleId)
const outcome = (result: CheckResult, key: string, benchmarkId: BenchmarkId) => result.verdicts.find((verdict) => verdict.key === key && verdict.benchmarkId === benchmarkId)?.outcome
const room = (project: Project) => getPrimaryRoom(project.current)
const door = (project: Project) => room(project).openings[0]

/** A horizontal bar on the east wall beside the example toilet, reaching `past` mm beyond the bowl's front edge. */
function eastBar(heightMm: number, past = 270): WallFixture {
  // The example toilet faces north with its front edge at y = 1075, so the bar starts `past` north of that.
  const start = 1075 - past
  return { ...createFixture('grab-bar-horizontal', 'east', room(bathroom()), 'bar-1', 'Grab bar', { offset: start + 300, length: 600, referenceHeight: heightMm }), diameter: null }
}

describe('fictional examples', () => {
  it('are valid projects and the bathroom shows the problems it was built to show', () => {
    expect(validateProject(bathroom()).ok).toBe(true)
    expect(validateProject(living()).ok).toBe(true)
    const project = bathroom()
    expect(rule(project, 'D01')[0].status).toBe('attention')
    expect(rule(project, 'D03')[0].status).toBe('attention')
    expect(rule(project, 'B01')[0].status).toBe('attention')
    expect(rule(project, 'B02')[0].status).toBe('attention')
    expect(rule(project, 'B03')[0]).toMatchObject({ status: 'attention', messageKey: 'checks.grabBarMissing' })
    expect(rule(project, 'B05')[0].status).toBe('not-evaluated')
    // Nothing on seed data is ever a definite verdict.
    const outcomes = evaluateLayout(project, 'current').flatMap((result) => result.verdicts.map((verdict) => verdict.outcome))
    expect(outcomes).not.toContain('meets')
    expect(outcomes).not.toContain('does-not-meet')
  })

  it('produces no bathroom results for a living room', () => {
    const rules = new Set(evaluateLayout(living(), 'current').map((result) => result.ruleId))
    for (const id of ['B01', 'B02', 'B03', 'B04', 'B05', 'B06'] as const) expect(rules.has(id), id).toBe(false)
  })

  it('has a translated message and limitation for every check it emits', () => {
    const fall = { id: 'fall-1', when: 'within-3-months' as const, roomId: 'room-1', point: null, activity: 'other' as const, note: '' }
    const project = bathroom()
    project.resident = { ...project.resident, reach: { posture: 'seated', low: m(400), high: m(1200) }, wheelchair: { width: m(650), length: m(1100) }, falls: [fall] }
    project.household.mobilityAids = ['Wheelchair']
    room(project).fixtures = [eastBar(680), createFixture('basin', 'north', room(project), 'basin-1', 'Basin', { offset: 1500 }), createFixture('socket', 'south', room(project), 'socket-1', 'Socket')]
    getPrimaryFloor(project.current).turningAreas = [{ id: 'turn', label: 'Turn', center: { xMm: 1000, yMm: 900 }, diameterMm: null }]
    for (const result of [...evaluateLayout(project, 'current'), ...evaluateLayout(living(), 'current')]) {
      expect(en, result.messageKey).toHaveProperty([result.messageKey])
      expect(en, result.evidence.limitationKey).toHaveProperty([result.evidence.limitationKey])
    }
  })
})

describe('door checks', () => {
  it('D01 compares the clear width with both benchmarks', () => {
    const project = living()
    expect(rule(project, 'D01')[0]).toMatchObject({ status: 'clear', measuredMm: 900, basis: 'benchmark' })
    door(project).width = m(870)
    const narrow = rule(project, 'D01')[0]
    expect(outcome(narrow, 'door.clearWidth', 'th-public-building')).toBe('likely-meets')
    expect(outcome(narrow, 'door.clearWidth', 'th-dop-home')).toBe('likely-does-not-meet')
    expect(narrow.status).toBe('attention')
    expect(resultNeedsProfessionalCheck(narrow)).toBe(true)
  })

  it('follows the primary benchmark, which is a substantive edit that outdates a review', () => {
    const project = living()
    door(project).width = m(870)
    const reviewed = applyCommand(project, { type: 'record-review', reviewerName: 'Advisor' }, now)
    if (!reviewed.ok) throw new Error('review failed')
    expect(getReviewStatus(reviewed.value)).toBe('reviewed')
    const chosen = applyCommand(reviewed.value, { type: 'set-benchmark-policy', primary: 'th-public-building', chosenBy: 'Advisor' }, now)
    if (!chosen.ok) throw new Error('policy failed')
    expect(chosen.value.revision).toBe(reviewed.value.revision + 1)
    expect(getReviewStatus(chosen.value)).toBe('outdated')
    expect(rule(chosen.value, 'D01')[0].status).toBe('clear')
    // Choosing the same benchmark again is not an edit; clearing it is.
    expect(applyCommand(chosen.value, { type: 'set-benchmark-policy', primary: 'th-public-building', chosenBy: 'Advisor' }, now)).toEqual({ ok: true, value: chosen.value })
    const cleared = applyCommand(chosen.value, { type: 'set-benchmark-policy', primary: null, chosenBy: '' }, now)
    expect(cleared.ok && cleared.value.benchmarkPolicy).toBeNull()
    expect(cleared.ok && rule(cleared.value, 'D01')[0].status).toBe('attention')
    expect(applyCommand(project, { type: 'set-benchmark-policy', primary: 'th-dop-home', chosenBy: '  ' }, now).ok).toBe(false)
  })

  it('D03 compares the size of the step, up or down', () => {
    const project = living()
    door(project).threshold = m(15)
    const step = rule(project, 'D03')[0]
    expect(outcome(step, 'door.threshold', 'th-public-building')).toBe('likely-does-not-meet')
    expect(outcome(step, 'door.threshold', 'th-dop-home')).toBe('likely-meets')
    door(project).threshold = m(-15)
    expect(rule(project, 'D03')[0].measuredMm).toBe(15)
  })

  it('D02 needs a handle record, and a knob does not meet the handle type', () => {
    const project = living()
    expect(rule(project, 'D02')[0]).toMatchObject({ status: 'not-evaluated', messageKey: 'checks.handleMissing' })
    door(project).handle = { type: 'knob', height: m(1100) }
    const knob = rule(project, 'D02')[0]
    expect(outcome(knob, 'door.handleType', 'th-public-building')).toBe('likely-does-not-meet')
    expect(outcome(knob, 'door.handleType', 'th-dop-home')).toBe('no-value')
    expect(outcome(knob, 'door.handleHeight', 'th-dop-home')).toBe('likely-meets')
    expect(knob.status).toBe('attention')
    door(project).handle = { type: 'lever', height: m(1100) }
    expect(rule(project, 'D02')[0].status).toBe('clear')
  })

  it('H03 is a physical fit against the recorded wheelchair, not a benchmark', () => {
    const project = bathroom()
    expect(rule(project, 'H03')).toEqual([])
    project.resident.wheelchair = { width: m(650), length: m(1100) }
    expect(rule(project, 'H03')[0]).toMatchObject({ status: 'clear', basis: 'resident', verdicts: [], measuredMm: 700, targetMm: 650 })
    expect(rule(project, 'H03')[0].evidence.limitationKey).toBe('checks.wheelchairFitLimit')
    door(project).width = m(640)
    expect(rule(project, 'H03')[0].status).toBe('attention')
  })

  it('does not check the swing of an outward-opening door inside the room', () => {
    const project = living()
    door(project).operation = 'hinged-out'
    expect(rule(project, 'G03')[0]).toMatchObject({ status: 'not-evaluated', messageKey: 'checks.outwardNoSwing' })
  })
})

describe('routes and turning with benchmark fallback', () => {
  it('prefers the overlay value, then the project target, then the benchmark', () => {
    const project = living()
    const route = getPrimaryFloor(project.current).routes[0]
    project.targets.routeWidth = { valueMm: 1100, rationale: 'For this project', enteredBy: 'Advisor', enteredAt: now }
    expect(rule(project, 'G04')[0]).toMatchObject({ measuredMm: 1000, evidence: { origin: 'custom-overlay' } })
    route.widthMm = null
    expect(rule(project, 'G04')[0]).toMatchObject({ measuredMm: 1100, evidence: { origin: 'project-target' } })
    project.targets.routeWidth = null
    expect(rule(project, 'G04')[0]).toMatchObject({ measuredMm: 800, evidence: { origin: 'benchmark' } })
  })

  it('tests a bathroom turning circle at the benchmark diameter', () => {
    const project = bathroom()
    getPrimaryFloor(project.current).turningAreas = [{ id: 'turn', label: 'Turn', center: { xMm: 1000, yMm: 900 }, diameterMm: null }]
    const result = rule(project, 'G05')[0]
    expect(result).toMatchObject({ measuredMm: 1500, status: 'attention', evidence: { origin: 'benchmark' } })
    expect(result.verdicts.map((verdict) => verdict.outcome)).toEqual(['likely-does-not-meet', 'likely-does-not-meet'])
  })
})

describe('bathroom checks', () => {
  it('B01 compares how the bathroom door opens', () => {
    const project = bathroom()
    expect(rule(project, 'B01')[0].verdicts.map((verdict) => verdict.outcome)).toEqual(['likely-does-not-meet', 'likely-does-not-meet'])
    for (const operation of ['sliding', 'hinged-out'] as const) {
      door(project).operation = operation
      expect(rule(project, 'B01')[0].status, operation).toBe('clear')
    }
  })

  it('B02 compares toilet type and seat height', () => {
    const project = bathroom()
    const low = rule(project, 'B02')[0]
    expect(outcome(low, 'toilet.seatHeight', 'th-public-building')).toBe('likely-does-not-meet')
    expect(outcome(low, 'toilet.seatHeight', 'th-dop-home')).toBe('no-value')
    expect(outcome(low, 'toilet.type', 'th-dop-home')).toBe('likely-meets')
    room(project).items[0].seatHeight = m(420)
    expect(rule(project, 'B02')[0].status).toBe('clear')
    room(project).items[0].seatHeight = null
    expect(rule(project, 'B02')[0].status).toBe('not-evaluated')

    const squat = bathroom()
    room(squat).items[0] = { ...createCatalogItem('toilet-squat', 'toilet-1', 'Squat toilet', 1500, 1400), rotationDeg: 180 }
    const result = rule(squat, 'B02')[0]
    expect(outcome(result, 'toilet.type', 'th-dop-home')).toBe('likely-does-not-meet')
    expect(outcome(result, 'toilet.seatHeight', 'th-public-building')).toBe('no-value')
    expect(outcome(result, 'toilet.seatHeight', 'th-dop-home')).toBe('no-value')
    expect(result.status).toBe('attention')
  })

  it('B03 finds a bar beside the toilet and checks its height and reach past the bowl', () => {
    const project = bathroom()
    room(project).fixtures = [eastBar(680, 270)]
    const good = rule(project, 'B03')[0]
    expect(good).toMatchObject({ status: 'clear', entityIds: ['bar-1', 'toilet-1'] })
    expect(outcome(good, 'grabBar.projectionPastBowl', 'th-public-building')).toBe('likely-meets')
    // The diameter is not recorded, so it is not compared at all.
    expect(good.verdicts.some((verdict) => verdict.key === 'grabBar.diameter')).toBe(false)

    room(project).fixtures = [eastBar(720, 270)]
    const high = rule(project, 'B03')[0]
    expect(outcome(high, 'grabBar.horizontalHeight', 'th-public-building')).toBe('likely-does-not-meet')
    expect(high.status).toBe('attention')

    room(project).fixtures = [{ ...eastBar(680, 270), diameter: m(50) }]
    expect(outcome(rule(project, 'B03')[0], 'grabBar.diameter', 'th-public-building')).toBe('likely-does-not-meet')
  })

  it('B03 ignores a bar that is not beside the toilet', () => {
    const project = bathroom()
    // On the west wall, 1300 mm from the toilet's side: too far to serve it.
    room(project).fixtures = [{ ...eastBar(680), wall: 'west' }]
    expect(rule(project, 'B03')[0].messageKey).toBe('checks.grabBarMissing')
    // On the east wall but entirely north of the toilet.
    room(project).fixtures = [{ ...eastBar(680), offset: m(350), length: m(400) }]
    expect(rule(project, 'B03')[0].messageKey).toBe('checks.grabBarMissing')
  })

  it('B03 follows the toilet when it is turned', () => {
    const project = bathroom()
    // Turned to back onto the east wall (rotation 90): its sides now face north and south, and it faces west.
    const toilet = room(project).items[0]
    toilet.rotationDeg = 90
    toilet.center = { xMm: 1600, yMm: 1500 }
    // Footprint: x 1275-1925, y 1300-1700. The south wall is 100 mm from its side; the front edge is x = 1275.
    const bar = createFixture('grab-bar-horizontal', 'south', room(project), 'bar-1', 'Grab bar', { offset: 1005 + 300, length: 600, referenceHeight: 680 })
    room(project).fixtures = [{ ...bar, diameter: null }]
    const result = rule(project, 'B03')[0]
    expect(result.status).toBe('clear')
    expect(result.verdicts.find((verdict) => verdict.key === 'grabBar.projectionPastBowl')?.measuredMm).toBe(270)
  })

  it('B04 compares the basin rim and knee space', () => {
    const project = bathroom()
    const basin = createFixture('basin', 'north', room(project), 'basin-1', 'Basin', { offset: 1500, referenceHeight: 850 })
    room(project).fixtures = [basin]
    expect(outcome(rule(project, 'B04')[0], 'basin.rimHeight', 'th-public-building')).toBe('likely-does-not-meet')
    room(project).fixtures = [{ ...basin, referenceHeight: m(780) }]
    // The rim is fine but the knee space is not recorded: a gap, not a pass.
    expect(rule(project, 'B04')[0].status).toBe('not-evaluated')
    room(project).fixtures = [{ ...basin, referenceHeight: m(780), kneeClearanceDepth: m(460) }]
    expect(rule(project, 'B04')[0].status).toBe('clear')
  })

  it('B05 never reads an unknown floor as acceptable', () => {
    const project = bathroom()
    expect(rule(project, 'B05')[0].status).toBe('not-evaluated')
    expect(resultNeedsProfessionalCheck(rule(project, 'B05')[0])).toBe(true)
    room(project).floor.slipResistance = 'not-slip-resistant'
    expect(rule(project, 'B05')[0].verdicts.map((verdict) => verdict.outcome)).toEqual(['likely-does-not-meet', 'likely-does-not-meet'])
    room(project).floor.slipResistance = 'slip-resistant'
    expect(rule(project, 'B05')[0].status).toBe('clear')
  })

  it('B06 reminds about things standing in the wet area, except shower seats and toilets', () => {
    const project = bathroom()
    expect(rule(project, 'B06')[0]).toMatchObject({ status: 'attention', basis: 'manual', entityIds: ['water-jar-1', 'wet-zone-1'] })
    room(project).items = [room(project).items[0], createCatalogItem('shower-seat', 'seat-1', 'Shower seat', 400, 1300)]
    expect(rule(project, 'B06')).toEqual([])
  })
})

describe('resident-based checks and fall proximity', () => {
  it('H01 compares switches, sockets and shelves with the recorded reach', () => {
    const project = living()
    room(project).fixtures = [createFixture('switch', 'east', room(project), 'switch-1', 'Switch', { referenceHeight: 1300 })]
    expect(rule(project, 'H01')).toEqual([])
    project.resident.reach = { posture: 'seated', low: m(400), high: m(1200) }
    expect(rule(project, 'H01')[0]).toMatchObject({ status: 'attention', basis: 'resident', measuredMm: 1300, targetMm: 1200, verdicts: [] })
    project.resident.reach.high = m(1300)
    expect(rule(project, 'H01')[0].status).toBe('clear')
  })

  it('H02 compares socket height only when the household uses a wheelchair', () => {
    const project = living()
    room(project).fixtures = [createFixture('socket', 'east', room(project), 'socket-1', 'Socket', { referenceHeight: 300 })]
    expect(rule(project, 'H02')).toEqual([])
    project.household.mobilityAids = ['รถเข็น']
    const result = rule(project, 'H02')[0]
    expect(outcome(result, 'socket.height', 'th-dop-home')).toBe('likely-does-not-meet')
    expect(outcome(result, 'socket.height', 'th-public-building')).toBe('no-value')
  })

  it('marks results near a recorded fall and lists them first', () => {
    const project = bathroom()
    project.resident.falls = [{ id: 'fall-1', when: 'within-3-months', roomId: 'room-1', point: { xMm: 1500, yMm: 1200 }, activity: 'toileting', note: '' }]
    expect(validateProject(project).ok).toBe(true)
    const results = evaluateLayout(project, 'current')
    const near = (ruleId: RuleId) => results.find((result) => result.ruleId === ruleId)!.nearFall
    expect(near('B02')).toBe(true)
    expect(near('B03')).toBe(true)
    // The door is about 1.3 m away, and the "everything is inside the room" summary is not a location.
    expect(near('D01')).toBe(false)
    expect(near('G01')).toBe(false)
    const sorted = sortCheckResults(results)
    const firstFar = sorted.findIndex((result) => !result.nearFall)
    expect(sorted.slice(0, firstFar).every((result) => result.nearFall)).toBe(true)
    expect(sorted.slice(firstFar).some((result) => result.nearFall)).toBe(false)
    // Then problems, then gaps, then what is clear.
    const order = sorted.slice(firstFar).map((result) => result.status)
    expect(order).toEqual([...order].sort((a, b) => ['attention', 'not-evaluated', 'clear'].indexOf(a) - ['attention', 'not-evaluated', 'clear'].indexOf(b)))
  })

  it('treats a fall with a room but no point as near everything in that room', () => {
    const project = bathroom()
    project.resident.falls = [{ id: 'fall-1', when: '3-to-12-months', roomId: 'room-1', point: null, activity: 'bathing', note: '' }]
    const results = evaluateLayout(project, 'current').filter((result) => result.status !== 'clear')
    expect(results.every((result) => result.nearFall)).toBe(true)
  })

  it('keeps a fall record but clears its location when the room no longer contains the point', () => {
    const project = bathroom()
    const withFall = applyCommand(project, { type: 'set-resident', resident: { ...project.resident, falls: [{ id: 'fall-1', when: 'within-3-months', roomId: 'room-1', point: { xMm: 1900, yMm: 1700 }, activity: 'toileting', note: 'night' }] } }, now)
    if (!withFall.ok) throw new Error('set-resident failed')
    const smaller = structuredClone(withFall.value.current)
    getPrimaryRoom(smaller).items = []
    getPrimaryRoom(smaller).wetZones = []
    getPrimaryRoom(smaller).shape.width = m(1800)
    const resized = applyCommand(withFall.value, { type: 'replace-layout', layoutId: 'current', layout: smaller }, now)
    if (!resized.ok) throw new Error(resized.error.paths.join(', '))
    expect(resized.value.resident.falls).toEqual([{ id: 'fall-1', when: 'within-3-months', roomId: 'room-1', point: null, activity: 'toileting', note: 'night' }])
  })
})
