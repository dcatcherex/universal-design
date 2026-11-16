import { layoutEntityIds } from './layout-access'
import { validateProject } from './schema'
import { BENCHMARKS } from './standards/benchmarks'
import { previewFix, type FixParams } from './standards/fixes'
import type { BenchmarkId, HouseholdBrief, Layout, LayoutId, Project, ProjectTarget, Recommendation, ResidentProfile, Result } from './types'

export type ProjectCommand =
  | { type: 'replace-layout'; layoutId: LayoutId; layout: Layout }
  | { type: 'create-proposal' }
  | { type: 'reset-proposal' }
  | { type: 'set-title'; title: string }
  | { type: 'set-household'; household: HouseholdBrief }
  | { type: 'set-resident'; resident: ResidentProfile }
  | { type: 'set-targets'; targets: Project['targets'] }
  /** `primary: null` clears the policy. */
  | { type: 'set-benchmark-policy'; primary: BenchmarkId | null; chosenBy: string }
  | { type: 'set-report-options'; includeFallHistory: boolean }
  | { type: 'upsert-recommendation'; recommendation: Recommendation }
  | { type: 'delete-recommendation'; id: string }
  | { type: 'record-review'; reviewerName: string }
  /**
   * One undoable step for a fix from the library: Proposed is created from Current when it does
   * not exist yet, the fix's effect is applied to it, and a linked recommendation is added.
   * Show the user `previewFix` first; nothing should be applied without that preview.
   */
  | { type: 'apply-fix'; fixId: string; params: FixParams }

function error(code: string, messageKey: string, paths: string[] = []): Result<Project> {
  return { ok: false, error: { code, messageKey, paths } }
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Recommendations keep their text when the entity they pointed at is deleted; only the link is cleared. */
function clearStaleRecommendationLinks(recommendations: Recommendation[], layoutId: LayoutId, layout: Layout): Recommendation[] {
  const ids = layoutEntityIds(layout)
  return recommendations.map((recommendation) => recommendation.layoutId === layoutId && recommendation.entityId && !ids.has(recommendation.entityId)
    ? { ...recommendation, entityId: undefined }
    : recommendation)
}

/** Falls are located in the CURRENT layout. If the room goes or the point ends up outside it, keep the record and clear the location. */
function clearStaleFallLocations(resident: ResidentProfile, current: Layout): ResidentProfile {
  const rooms = new Map(current.floors.flatMap((floor) => floor.rooms).map((room) => [room.id, room]))
  return {
    ...resident,
    falls: resident.falls.map((fall) => {
      if (fall.roomId === null) return fall
      const room = rooms.get(fall.roomId)
      if (!room) return { ...fall, roomId: null, point: null }
      if (fall.point && (fall.point.xMm < 0 || fall.point.yMm < 0 || fall.point.xMm > room.shape.width.valueMm || fall.point.yMm > room.shape.depth.valueMm)) return { ...fall, point: null }
      return fall
    }),
  }
}

export function applyCommand(project: Project, command: ProjectCommand, now: string): Result<Project> {
  let next: Project = project
  switch (command.type) {
    case 'replace-layout': {
      if (command.layoutId === 'proposed' && !project.proposed) return error('missing-proposal', 'project.proposalRequired', ['proposed'])
      const layout = structuredClone(command.layout)
      next = command.layoutId === 'current' ? { ...project, current: layout } : { ...project, proposed: layout }
      next = { ...next, recommendations: clearStaleRecommendationLinks(next.recommendations, command.layoutId, layout) }
      if (command.layoutId === 'current') next = { ...next, resident: clearStaleFallLocations(next.resident, layout) }
      break
    }
    case 'create-proposal':
      if (project.proposed) return error('proposal-exists', 'project.proposalAlreadyExists', ['proposed'])
      next = { ...project, proposed: structuredClone(project.current) }
      break
    case 'reset-proposal':
      if (!project.proposed) return error('missing-proposal', 'project.proposalRequired', ['proposed'])
      next = { ...project, proposed: structuredClone(project.current) }
      break
    case 'set-title':
      next = { ...project, title: command.title }
      break
    case 'set-household':
      next = { ...project, household: structuredClone(command.household) }
      break
    case 'set-resident':
      next = { ...project, resident: structuredClone(command.resident) }
      break
    case 'set-targets':
      next = { ...project, targets: structuredClone(command.targets) }
      break
    case 'set-benchmark-policy': {
      if (command.primary === null) {
        next = { ...project, benchmarkPolicy: null }
        break
      }
      const chosenBy = command.chosenBy.trim()
      if (!chosenBy) return error('chooser-required', 'validation.chooserRequired', ['chosenBy'])
      if (project.benchmarkPolicy?.primary === command.primary && project.benchmarkPolicy.chosenBy === chosenBy) return { ok: true, value: project }
      next = { ...project, benchmarkPolicy: { primary: command.primary, chosenBy, chosenAt: now } }
      break
    }
    case 'set-report-options':
      next = { ...project, report: { includeFallHistory: command.includeFallHistory } }
      break
    case 'upsert-recommendation': {
      const recommendation = structuredClone(command.recommendation)
      const exists = project.recommendations.some((item) => item.id === recommendation.id)
      next = {
        ...project,
        recommendations: exists
          ? project.recommendations.map((item) => item.id === recommendation.id ? recommendation : item)
          : [...project.recommendations, recommendation],
      }
      break
    }
    case 'delete-recommendation':
      next = { ...project, recommendations: project.recommendations.filter((item) => item.id !== command.id) }
      break
    case 'apply-fix': {
      const preview = previewFix(project, command.fixId, command.params, now)
      if (!preview.ok) return preview
      const proposed = preview.value.project.proposed!
      next = { ...preview.value.project, updatedAt: project.updatedAt, recommendations: clearStaleRecommendationLinks(preview.value.project.recommendations, 'proposed', proposed) }
      break
    }
    case 'record-review':
      if (!command.reviewerName.trim()) return error('reviewer-required', 'validation.reviewerRequired', ['reviewerName'])
      next = { ...project, review: { reviewerName: command.reviewerName.trim(), reviewedAt: now, projectRevision: project.revision, benchmarkDatasetVersion: BENCHMARKS.datasetVersion } }
      if (same(next.review, project.review)) return { ok: true, value: project }
      next = { ...next, updatedAt: now }
      break
  }

  if (same(next, project)) return { ok: true, value: project }
  next = { ...next, updatedAt: now }
  if (command.type !== 'record-review') next = { ...next, revision: project.revision + 1 }
  const validation = validateProject(next)
  if (!validation.ok) return { ok: false, error: validation.error }
  return validation
}

export type { ProjectTarget }
