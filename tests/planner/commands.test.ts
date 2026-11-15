import { describe, expect, it } from 'vitest'
import { applyCommand } from '../../lib/planner/commands'
import { createExampleProject } from '../../lib/planner/fixtures'

const now = '2026-09-28T10:00:00.000Z'

describe('project commands', () => {
  it('creates an independent proposal with matching entity identities', () => {
    const project = createExampleProject(now)
    project.proposed = null
    const result = applyCommand(project, { type: 'create-proposal' }, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.proposed?.items.map((item) => item.id)).toEqual(project.current.items.map((item) => item.id))
    expect(result.value.proposed).not.toBe(project.current)
  })
  it('isolates proposed edits and leaves current corrections independent', () => {
    let project = createExampleProject(now)
    project.proposed = null
    let result = applyCommand(project, { type: 'create-proposal' }, now)
    if (!result.ok) throw new Error(result.error.messageKey)
    project = result.value
    const proposed = structuredClone(project.proposed!)
    proposed.items[1].center.xMm = 3500
    result = applyCommand(project, { type: 'replace-layout', layoutId: 'proposed', layout: proposed }, now)
    if (!result.ok) throw new Error(result.error.messageKey)
    expect(result.value.current.items[1].center.xMm).toBe(3000)
    const corrected = structuredClone(result.value.current)
    corrected.room.width.valueMm = 6200
    result = applyCommand(result.value, { type: 'replace-layout', layoutId: 'current', layout: corrected }, now)
    expect(result.ok && result.value.proposed?.room.width.valueMm).toBe(6000)
  })
  it('reset proposal replaces proposed layout from current only', () => {
    const project = createExampleProject(now)
    const changed = structuredClone(project.current)
    changed.items[0].center.xMm = 2700
    project.proposed!.items[0].center.xMm = 3300
    const withChanges = { ...project, current: changed }
    const result = applyCommand(withChanges, { type: 'reset-proposal' }, now)
    expect(result.ok && result.value.proposed?.items[0].center.xMm).toBe(2700)
    expect(result.ok && result.value.current.items[0].center.xMm).toBe(2700)
  })
  it('rejects invalid layout changes without changing the source project', () => {
    const project = createExampleProject(now)
    const invalid = structuredClone(project.current)
    invalid.room.width.valueMm = 2000
    const result = applyCommand(project, { type: 'replace-layout', layoutId: 'current', layout: invalid }, now)
    expect(result.ok).toBe(false)
    expect(project.current.room.width.valueMm).toBe(6000)
  })
  it('does not increment revision for a no-op command', () => {
    const project = createExampleProject(now)
    const result = applyCommand(project, { type: 'set-title', title: project.title }, now)
    expect(result.ok && result.value).toBe(project)
  })
  it('records a review without changing the substantive revision', () => {
    const project = createExampleProject(now)
    const result = applyCommand(project, { type: 'record-review', reviewerName: 'Advisor' }, now)
    expect(result.ok && result.value.revision).toBe(project.revision)
    expect(result.ok && result.value.review?.projectRevision).toBe(project.revision)
  })
  it('preserves a recommendation when its linked room object is removed', () => {
    const project = createExampleProject(now)
    project.recommendations.push({
      id: 'rec-table', layoutId: 'current', entityId: 'coffee-table-1', title: 'Review table position', reason: 'The route is obstructed.',
      action: 'Discuss a new position.', priority: 'now', workType: 'rearrange', status: 'proposed', advisorNote: '', materials: null, labour: null,
    })
    const layout = structuredClone(project.current)
    layout.items = layout.items.filter((item) => item.id !== 'coffee-table-1')
    const result = applyCommand(project, { type: 'replace-layout', layoutId: 'current', layout }, now)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.recommendations[0]).toMatchObject({ title: 'Review table position', entityId: undefined })
  })
})
