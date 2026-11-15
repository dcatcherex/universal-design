import { validateProject } from './schema'
import type { HouseholdBrief, Layout, LayoutId, Project, ProjectTarget, Recommendation, Result } from './types'

export type ProjectCommand =
  | { type: 'replace-layout'; layoutId: LayoutId; layout: Layout }
  | { type: 'create-proposal' }
  | { type: 'reset-proposal' }
  | { type: 'set-title'; title: string }
  | { type: 'set-household'; household: HouseholdBrief }
  | { type: 'set-targets'; targets: Project['targets'] }
  | { type: 'upsert-recommendation'; recommendation: Recommendation }
  | { type: 'delete-recommendation'; id: string }
  | { type: 'record-review'; reviewerName: string }

function error(code: string, messageKey: string, paths: string[] = []): Result<Project> {
  return { ok: false, error: { code, messageKey, paths } }
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function idsInLayout(layout: Layout): Set<string> {
  return new Set([...layout.openings, ...layout.items, ...layout.routes, ...layout.turningAreas].map((entity) => entity.id))
}

export function applyCommand(project: Project, command: ProjectCommand, now: string): Result<Project> {
  let next: Project = project
  switch (command.type) {
    case 'replace-layout': {
      if (command.layoutId === 'proposed' && !project.proposed) return error('missing-proposal', 'project.proposalRequired', ['proposed'])
      const layout = structuredClone(command.layout)
      next = command.layoutId === 'current' ? { ...project, current: layout } : { ...project, proposed: layout }
      const ids = idsInLayout(layout)
      next = {
        ...next,
        recommendations: next.recommendations.map((recommendation) => recommendation.layoutId === command.layoutId && recommendation.entityId && !ids.has(recommendation.entityId)
          ? { ...recommendation, entityId: undefined }
          : recommendation),
      }
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
    case 'set-targets':
      next = { ...project, targets: structuredClone(command.targets) }
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
    case 'record-review':
      if (!command.reviewerName.trim()) return error('reviewer-required', 'validation.reviewerRequired', ['reviewerName'])
      next = { ...project, review: { reviewerName: command.reviewerName.trim(), reviewedAt: now, projectRevision: project.revision } }
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
