import { describe, expect, it } from 'vitest'
import { createExampleProject } from '../../lib/planner/fixtures'
import { commitCommand, createHistory, getReviewStatus, redo, undo } from '../../lib/planner/history'

const now = '2026-09-28T10:00:00.000Z'

describe('project history', () => {
  it('caps undo history at 50 committed edits', () => {
    let state = createHistory(createExampleProject(now))
    for (let index = 0; index < 55; index++) {
      const result = commitCommand(state, { type: 'set-title', title: `Project ${index}` }, now)
      if (!result.ok) throw new Error(result.error.messageKey)
      state = result.value
    }
    expect(state.past).toHaveLength(50)
  })
  it('clears redo after a new command following undo', () => {
    let state = createHistory(createExampleProject(now))
    const first = commitCommand(state, { type: 'set-title', title: 'First' }, now)
    if (!first.ok) throw new Error(first.error.messageKey)
    state = undo(first.value, now)
    expect(state.future).toHaveLength(1)
    const second = commitCommand(state, { type: 'set-title', title: 'Second' }, now)
    expect(second.ok && second.value.future).toHaveLength(0)
  })
  it('treats one committed layout drag as one undo entry', () => {
    const state = createHistory(createExampleProject(now))
    const layout = structuredClone(state.present.current)
    layout.items[0].center.xMm += 50
    const moved = commitCommand(state, { type: 'replace-layout', layoutId: 'current', layout }, now)
    expect(moved.ok && moved.value.past).toHaveLength(1)
    expect(moved.ok && undo(moved.value, now).present.current.items[0].center.xMm).toBe(3000)
  })
  it('does not add history for no-op edits or review metadata', () => {
    const state = createHistory(createExampleProject(now))
    const noOp = commitCommand(state, { type: 'set-title', title: state.present.title }, now)
    expect(noOp.ok && noOp.value.past).toHaveLength(0)
    const reviewed = commitCommand(state, { type: 'record-review', reviewerName: 'Reviewer' }, now)
    expect(reviewed.ok && reviewed.value.past).toHaveLength(0)
  })
  it('keeps revisions monotonic and marks a reviewed revision outdated after edit and undo', () => {
    const project = createExampleProject(now)
    project.review = { reviewerName: 'Advisor', reviewedAt: now, projectRevision: 0 }
    expect(getReviewStatus(project)).toBe('reviewed')
    let state = createHistory(project)
    const edited = commitCommand(state, { type: 'set-title', title: 'Revised' }, now)
    if (!edited.ok) throw new Error(edited.error.messageKey)
    state = edited.value
    expect(getReviewStatus(state.present)).toBe('outdated')
    const undone = undo(state, now)
    expect(undone.present.revision).toBeGreaterThan(state.present.revision)
    expect(getReviewStatus(undone.present)).toBe('outdated')
    expect(undone.present.review).toEqual(project.review)
  })
  it('redo also preserves the current receipt and advances revision', () => {
    let state = createHistory(createExampleProject(now))
    const edited = commitCommand(state, { type: 'set-title', title: 'Revised' }, now)
    if (!edited.ok) throw new Error(edited.error.messageKey)
    const beforeUndoRevision = edited.value.present.revision
    state = redo(undo(edited.value, now), now)
    expect(state.present.title).toBe('Revised')
    expect(state.present.revision).toBeGreaterThan(beforeUndoRevision)
  })
})
