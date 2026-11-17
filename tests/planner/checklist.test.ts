import { describe, expect, it } from 'vitest'
import { applyCommand } from '../../lib/planner/commands'
import { createEmptyProject } from '../../lib/planner/fixtures'
import { getReviewStatus } from '../../lib/planner/history'
import { projectSchema } from '../../lib/planner/schema'
import { CHECKLIST, getChecklistQuestions, getWalkthrough } from '../../lib/planner/standards/checklist'
import { checklistDatasetSchema } from '../../lib/planner/standards/schema'
import { buildReportData } from '../../lib/planner/exports/report-data'

const now = '2026-11-17T00:00:00.000Z'

describe('walk-through checklist', () => {
  it('validates the versioned dataset and requires a source reference on every pending question', () => {
    expect(checklistDatasetSchema.safeParse(CHECKLIST).success).toBe(true)
    expect(CHECKLIST.questions.length).toBeGreaterThanOrEqual(15)
    expect(CHECKLIST.questions.length).toBeLessThanOrEqual(25)
    for (const question of CHECKLIST.questions) {
      expect(CHECKLIST.sources.some((source) => source.id === question.sourceId)).toBe(true)
      expect(question.sourceRef.trim()).not.toBe('')
      expect(question.review.status).toBe('pending')
    }
  })

  it('defaults answers for older v2 projects and accepts only documented answer values', () => {
    const project = createEmptyProject('old-project', now)
    const oldProject = { ...project }
    delete oldProject.checklist
    const parsed = projectSchema.parse(oldProject)
    expect(parsed.checklist).toEqual([])
    expect(projectSchema.safeParse({ ...project, checklist: [{ questionId: 'q', answer: 'maybe', note: '', answeredAt: now }] }).success).toBe(false)
    const duplicate = { questionId: 'q', answer: 'yes', note: '', answeredAt: now }
    expect(projectSchema.safeParse({ ...project, checklist: [duplicate, duplicate] }).success).toBe(false)
  })

  it('keeps hazard, unsure, not-applicable and unanswered outcomes distinct', () => {
    const questions = getChecklistQuestions('living')
    const hazardQuestion = questions[0]
    const unsureQuestion = questions[1]
    const notApplicableQuestion = questions[2]
    const project = createEmptyProject('walkthrough-test', now)
    const result = getWalkthrough([
      { questionId: hazardQuestion.id, answer: hazardQuestion.hazardAnswer, note: 'observed', answeredAt: now },
      { questionId: unsureQuestion.id, answer: 'unsure', note: '', answeredAt: now },
      { questionId: notApplicableQuestion.id, answer: 'not-applicable', note: '', answeredAt: now },
      { questionId: 'retired-question', answer: 'yes', note: '', answeredAt: now },
    ], 'living')
    expect(result.findings.map((finding) => finding.kind)).toEqual(['hazard', 'get-checked'])
    expect(result.summary).toEqual({ hazards: 1, getChecked: 1, notAnswered: questions.length - 3 })
    expect(result.entries.find((entry) => entry.question.id === notApplicableQuestion.id)?.outcome).toBe('not-applicable')
    expect(result.entries.some((entry) => entry.question.id === 'retired-question')).toBe(false)
    expect(project.checklist).toEqual([])
  })

  it('stores answers as a revisioned project edit and leaves removed-question answers intact', () => {
    const project = createEmptyProject('walkthrough-command', now)
    project.review = {
      reviewerName: 'Advisor',
      reviewedAt: now,
      projectRevision: project.revision,
      benchmarkDatasetVersion: '2026.10-draft',
    }
    project.checklist = [{ questionId: 'retired-question', answer: 'yes', note: '', answeredAt: now }]
    const result = applyCommand(project, { type: 'set-checklist-answer', questionId: CHECKLIST.questions[0].id, answer: 'yes', note: '  note  ' }, '2026-11-18T00:00:00.000Z')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.revision).toBe(project.revision + 1)
    expect(result.value.checklist).toHaveLength(2)
    expect(result.value.checklist?.[1]).toMatchObject({ answer: 'yes', note: 'note', answeredAt: '2026-11-18T00:00:00.000Z' })
    expect(getReviewStatus(result.value)).toBe('outdated')
  })

  it('includes the version, pending-review note and answers in the report separately from benchmark checks', () => {
    const project = createEmptyProject('walkthrough-report', now)
    const question = CHECKLIST.questions.find((entry) => entry.roomTypes.includes('living'))!
    project.checklist = [{ questionId: question.id, answer: question.hazardAnswer, note: 'note', answeredAt: now }]
    const report = buildReportData(project, 'en')
    expect(report.walkthrough.datasetVersion).toBe(CHECKLIST.datasetVersion)
    expect(report.walkthrough.pendingReview).toBe(true)
    expect(report.walkthrough.summary.hazards).toBe(1)
    expect(report.walkthrough.entries[0].question.id).toBe(question.id)
    expect(report.plans.current.checks.every((check) => !('questionId' in check))).toBe(true)
  })
})
