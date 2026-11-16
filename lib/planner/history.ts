import { applyCommand, type ProjectCommand } from './commands'
import { BENCHMARKS } from './standards/benchmarks'
import type { Project, Result } from './types'

export type HistoryState = { present: Project; past: Project[]; future: Project[] }
const HISTORY_LIMIT = 50

export function createHistory(project: Project): HistoryState {
  return { present: project, past: [], future: [] }
}

export function commitCommand(state: HistoryState, command: ProjectCommand, now: string): Result<HistoryState> {
  const result = applyCommand(state.present, command, now)
  if (!result.ok) return result
  if (result.value === state.present) return { ok: true, value: state }
  if (command.type === 'record-review') return { ok: true, value: { ...state, present: result.value } }
  return {
    ok: true,
    value: {
      present: result.value,
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      future: [],
    },
  }
}

function restore(snapshot: Project, current: Project, now: string): Project {
  return {
    ...structuredClone(snapshot),
    revision: current.revision + 1,
    updatedAt: now,
    review: current.review,
  }
}

export function undo(state: HistoryState, now: string): HistoryState {
  if (state.past.length === 0) return state
  const snapshot = state.past[state.past.length - 1]
  return {
    present: restore(snapshot, state.present, now),
    past: state.past.slice(0, -1),
    future: [state.present, ...state.future],
  }
}

export function redo(state: HistoryState, now: string): HistoryState {
  if (state.future.length === 0) return state
  const snapshot = state.future[0]
  return {
    present: restore(snapshot, state.present, now),
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    future: state.future.slice(1),
  }
}

/** A review is current only for the exact project revision and benchmark dataset it covered. */
export function getReviewStatus(project: Project, datasetVersion: string = BENCHMARKS.datasetVersion): 'not-reviewed' | 'reviewed' | 'outdated' {
  if (!project.review) return 'not-reviewed'
  return project.review.projectRevision === project.revision && project.review.benchmarkDatasetVersion === datasetVersion ? 'reviewed' : 'outdated'
}
