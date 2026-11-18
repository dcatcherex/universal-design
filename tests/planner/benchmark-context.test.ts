import { describe, expect, it } from 'vitest'
import { evaluateLayout } from '../../lib/planner/checks'
import { buildElevation } from '../../lib/planner/elevation'
import { buildReportData } from '../../lib/planner/exports/report-data'
import { createBathroomExampleProject } from '../../lib/planner/fixtures'
import { createFixture } from '../../lib/planner/fixtures-catalog'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { benchmarkContextFor } from '../../lib/planner/resident-needs'
import { previewFix } from '../../lib/planner/standards/fixes'

const now = '2026-09-28T00:00:00.000Z'

/** A wheelchair user recorded through the need presets only; the legacy mobility-aid labels stay empty. */
function wheelchairProject() {
  const project = createBathroomExampleProject(now)
  project.resident.needs = ['wheelchair']
  project.household.mobilityAids = []
  return project
}

describe('benchmark context', () => {
  it('derives verdicts, fix targets, wall bands and report context from the same merged needs', () => {
    const project = wheelchairProject()
    const room = getPrimaryRoom(project.current)
    const socket = createFixture('socket', 'north', room, 'socket-1', 'Socket', { offset: 1200, referenceHeight: 400 })
    room.fixtures.push(socket)

    // The H02 verdict sees the wheelchair need even though the household aid list is empty.
    const verdict = evaluateLayout(project, 'current')
      .find((result) => result.ruleId === 'H02')?.verdicts
      .find((entry) => entry.key === 'socket.height' && entry.benchmarkId === 'th-dop-home')
    expect(verdict?.outcome).toContain('does-not-meet')

    // The fix must aim at the same benchmark the verdict reported, not a no-benchmark failure.
    const preview = previewFix(project, 'socket-height', { entityId: socket.id }, now)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.value.used).toMatchObject({ key: 'socket.height', benchmarkId: verdict!.benchmarkId, valueMm: 850 })

    // The wall elevation must draw the same wheelchair band the verdict used.
    const model = buildElevation(room, 'north', project.resident, socket.id, benchmarkContextFor(project, room))
    expect(model.benchmarkBands).toEqual([expect.objectContaining({ benchmarkId: verdict!.benchmarkId, key: 'socket.height', minMm: 800, maxMm: 900 })])

    // The report must evaluate clauses against the same merged needs.
    expect(buildReportData(project, 'en').plans.current.context.mobilityAids).toContain('wheelchair')
  })
})
