import { describe, expect, it } from 'vitest'
import { buildRecommendationDraft, formatBahtAmount, parseBahtAmount, summarizeCosts } from '../../lib/planner/recommendations'
import { createExampleProject } from '../../lib/planner/fixtures'
import { applyCommand } from '../../lib/planner/commands'
import { getReviewStatus } from '../../lib/planner/history'
import type { CheckResult, CostRange, Recommendation } from '../../lib/planner/types'
import { validateProject } from '../../lib/planner/schema'

const now = '2026-09-28T10:00:00.000Z'
const range = (lowSatang: number, highSatang: number): CostRange => ({ lowSatang, highSatang, sourceNote: 'Advisor estimate', estimatedAt: now })

function recommendation(id: string, status: Recommendation['status'], materials: CostRange | null, labour: CostRange | null): Recommendation {
  return { id, layoutId: 'current', title: id, reason: '', action: '', priority: 'next', workType: 'purchase', status, advisorNote: '', materials, labour }
}

describe('recommendation estimates and review drafts', () => {
  it('sums accepted known cost components and counts each unknown component', () => {
    expect(summarizeCosts([
      recommendation('accepted', 'accepted', range(10_000, 20_000), null),
      recommendation('proposed', 'proposed', range(50_000, 90_000), range(1, 2)),
      recommendation('deferred', 'deferred', range(70_000, 80_000), range(1, 2)),
    ])).toEqual({ lowSatang: 10_000, highSatang: 20_000, missingComponents: 1, includedCount: 1 })
  })

  it('counts explicit zero as a known cost and keeps integer totals exact', () => {
    expect(summarizeCosts([
      recommendation('a', 'completed', range(0, 0), range(10_001, 10_002)),
      recommendation('b', 'accepted', range(20_002, 30_003), range(40_004, 50_005)),
    ])).toEqual({ lowSatang: 70_007, highSatang: 90_010, missingComponents: 0, includedCount: 2 })
  })

  it('creates a localized editable draft tied to the check location', () => {
    const result: CheckResult = { id: 'G02:current:a:b', ruleId: 'G02', layoutId: 'current', entityIds: ['a', 'b'], status: 'attention', messageKey: 'checks.collisionAttention', evidence: { confidence: 'estimated', origin: 'geometry', limitationKey: 'checks.collisionLimit' } }
    expect(buildRecommendationDraft(result, 'th')).toMatchObject({ title: expect.any(String), reason: expect.any(String), action: expect.any(String) })
    expect(buildRecommendationDraft(result, 'en')).not.toEqual(buildRecommendationDraft(result, 'th'))
  })

  it('converts Thai baht entry to exact satang and rejects ambiguous amounts', () => {
    expect(parseBahtAmount('๑๒๓.๔๕')).toBe(12_345)
    expect(parseBahtAmount('1,200')).toBeNull()
    expect(parseBahtAmount('1.234')).toBeNull()
    expect(formatBahtAmount(12_345, 'en')).toBe('123.45')
  })

  it('marks estimate and household changes outdated while view-language changes do not revise the project', () => {
    let project = createExampleProject(now)
    const reviewed = applyCommand(project, { type: 'record-review', reviewerName: 'Advisor' }, now)
    if (!reviewed.ok) throw new Error(reviewed.error.messageKey)
    project = reviewed.value
    expect(getReviewStatus(project)).toBe('reviewed')
    const rec = recommendation('estimate', 'accepted', range(0, 100), null)
    const changed = applyCommand(project, { type: 'upsert-recommendation', recommendation: rec }, now)
    if (!changed.ok) throw new Error(changed.error.messageKey)
    expect(getReviewStatus(changed.value)).toBe('outdated')
    const preference = structuredClone(changed.value.household)
    preference.residentPreferences = 'Keep the reading chair'
    const householdChange = applyCommand(changed.value, { type: 'set-household', household: preference }, now)
    expect(householdChange.ok && getReviewStatus(householdChange.value)).toBe('outdated')
    expect(project.revision).toBe(0)
  })

  it('rejects an estimate without a source note or a valid date', () => {
    const project = createExampleProject(now)
    project.recommendations = [recommendation('bad-estimate', 'proposed', { lowSatang: -1, highSatang: 5, sourceNote: '', estimatedAt: 'not-a-date' }, null)]
    expect(validateProject(project)).toMatchObject({ ok: false })
  })

  it('does not record an advisor review without a self-entered name', () => {
    const result = applyCommand(createExampleProject(now), { type: 'record-review', reviewerName: '  ' }, now)
    expect(result).toMatchObject({ ok: false, error: { code: 'reviewer-required' } })
  })
})
