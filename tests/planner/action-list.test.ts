import { describe, expect, it } from 'vitest'
import { getActionGroups } from '../../lib/planner/action-list'
import { createBathroomExampleProject } from '../../lib/planner/fixtures'
import { buildReportData } from '../../lib/planner/exports/report-data'
import { CHECKLIST } from '../../lib/planner/standards/checklist'
import { FIXES, getEffortTier, previewFix } from '../../lib/planner/standards/fixes'
import type { Recommendation } from '../../lib/planner/types'

const now = '2026-11-17T00:00:00.000Z'

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'recommendation-1',
    layoutId: 'current',
    title: 'Review the finding',
    reason: 'Recorded from the walk-through.',
    action: 'Ask a professional to inspect it.',
    priority: 'next',
    workType: 'building-work',
    status: 'proposed',
    advisorNote: '',
    materials: null,
    labour: null,
    ...overrides,
  }
}

describe('effort-sorted action list', () => {
  it('derives a tier for every fix and overrides grab-bar installation to building work', () => {
    expect(FIXES.version).toBe('2026.11-draft')
    expect(FIXES.fixes).toHaveLength(16)
    const expected: Record<string, string> = {
      'move-item': 'no-cost',
      'remove-item': 'no-cost',
      'threshold-remove': 'small-job',
      'threshold-bevel': 'small-job',
      'door-sliding': 'small-job',
      'door-rehang-out': 'small-job',
      'door-widen': 'building-work',
      'lever-handle': 'small-job',
      'raised-toilet-seat': 'small-job',
      'replace-seated-toilet': 'small-job',
      'grab-bar-horizontal': 'building-work',
      'grab-bar-fold-down': 'building-work',
      'basin-height': 'small-job',
      'anti-slip-floor': 'small-job',
      'fixture-to-reach': 'small-job',
      'socket-height': 'building-work',
    }
    expect(FIXES.fixes.map((fix) => fix.id).sort()).toEqual(Object.keys(expected).sort())
    for (const fix of FIXES.fixes) expect(getEffortTier(fix)).toBe(expected[fix.id])
  })

  it('groups walk-through hazards by their source effort and links the action to its finding', () => {
    const project = createBathroomExampleProject(now)
    const question = CHECKLIST.questions.find((item) => item.id === 'bathroom-grab-bars')!
    project.checklist = [{ questionId: question.id, answer: question.hazardAnswer, note: '', answeredAt: now }]
    const groups = getActionGroups(project)
    const finding = groups['building-work'].find((item) => item.id === `finding:${question.id}`)
    expect(finding).toMatchObject({
      kind: 'finding',
      action: question.advice.en,
      reference: { kind: 'finding', finding: { questionId: question.id } },
      materials: null,
      labour: null,
    })
    expect(groups['building-work'].some((item) => item.nearFall)).toBe(false)
  })

  it('hides an applied fix and a completed finding recommendation from the action list', () => {
    const project = createBathroomExampleProject(now)
    const question = CHECKLIST.questions.find((item) => item.id === 'bathroom-grab-bars')!
    project.checklist = [{ questionId: question.id, answer: question.hazardAnswer, note: '', answeredAt: now }]
    const before = getActionGroups(project)
    expect(before['building-work'].some((item) => item.kind === 'fix' && item.fix?.id === 'grab-bar-horizontal')).toBe(true)
    const preview = previewFix(project, 'grab-bar-horizontal', { entityId: 'toilet-1', ruleId: 'B03' }, now)
    if (!preview.ok) throw new Error(preview.error.code)
    expect(Object.values(getActionGroups(preview.value.project)).flat().some((item) => item.kind === 'fix' && item.fix?.id === 'grab-bar-horizontal')).toBe(false)

    project.recommendations = [recommendation({ findingQuestionId: question.id, status: 'completed' })]
    const afterComplete = Object.values(getActionGroups(project)).flat()
    expect(afterComplete.some((item) => item.id === `finding:${question.id}`)).toBe(false)
    expect(afterComplete.some((item) => item.id === 'recommendation:recommendation-1')).toBe(false)
  })

  it('keeps an active finding recommendation as one action and includes action groups in reports', () => {
    const project = createBathroomExampleProject(now)
    const question = CHECKLIST.questions.find((item) => item.id === 'bathroom-grab-bars')!
    project.checklist = [{ questionId: question.id, answer: question.hazardAnswer, note: '', answeredAt: now }]
    project.recommendations = [recommendation({ findingQuestionId: question.id, workType: 'purchase' })]
    const groups = getActionGroups(project)
    expect(groups['building-work'].some((item) => item.id === `finding:${question.id}`)).toBe(false)
    expect(groups['building-work'].some((item) => item.id === 'recommendation:recommendation-1')).toBe(true)

    const report = buildReportData(project, 'en')
    expect(report.actionGroups['building-work'].some((item) => item.id === 'recommendation:recommendation-1')).toBe(true)
  })

  it('orders near-fall actions before other actions within a tier', () => {
    const project = createBathroomExampleProject(now)
    const question = CHECKLIST.questions.find((item) => item.id === 'floor-rugs')!
    project.checklist = [{ questionId: question.id, answer: question.hazardAnswer, note: '', answeredAt: now }]
    project.resident.falls = [{
      id: 'fall-1',
      when: 'within-3-months',
      roomId: 'room-1',
      point: null,
      activity: 'walking',
      note: '',
    }]
    const rows = getActionGroups(project)['no-cost']
    const lastNearFall = Math.max(...rows.map((item, index) => item.nearFall ? index : -1))
    const firstOther = rows.findIndex((item) => !item.nearFall)
    expect(lastNearFall).toBeGreaterThanOrEqual(0)
    expect(firstOther).toBeGreaterThan(lastNearFall)
  })
})
