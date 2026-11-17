import { describe, expect, it } from 'vitest'
import { compareCheckResults, getEntityStatuses, summarizeChecks } from '../../lib/planner/checks'
import type { CheckResult } from '../../lib/planner/types'

function result(id: string, entityIds: string[], status: CheckResult['status'], nearFall = false, ruleId: CheckResult['ruleId'] = 'G01', layoutId: CheckResult['layoutId'] = 'current'): CheckResult {
  return {
    id,
    ruleId,
    layoutId,
    roomId: 'room-1',
    entityIds,
    status,
    messageKey: 'checks.boundsClear',
    verdicts: [],
    basis: 'geometry',
    nearFall,
    evidence: { confidence: 'measured', origin: 'geometry', limitationKey: 'checks.boundsLimit' },
  }
}

describe('entity check status projection', () => {
  it('merges multiple results using attention, not evaluated, then clear precedence', () => {
    const statuses = getEntityStatuses([
      result('clear-result', ['toilet-1'], 'clear'),
      result('pending-result', ['toilet-1'], 'not-evaluated', true),
      result('attention-result', ['toilet-1'], 'attention'),
    ])

    expect(statuses.get('toilet-1')).toEqual({
      status: 'attention',
      nearFall: true,
      resultIds: ['clear-result', 'pending-result', 'attention-result'],
      attentionCount: 1,
      notEvaluatedCount: 1,
    })
  })

  it('projects statuses for plan entities without depending on their kind', () => {
    const ids = ['item-1', 'opening-1', 'fixture-1', 'route-1', 'turning-1']
    const statuses = getEntityStatuses([result('shared-result', ids, 'not-evaluated')])

    expect([...statuses.keys()]).toEqual(ids)
    expect([...statuses.values()].every((status) => status.status === 'not-evaluated')).toBe(true)
  })

  it('keeps clear as a derived status for renderers to leave unmarked', () => {
    expect(getEntityStatuses([result('clear-result', ['item-1'], 'clear')]).get('item-1')?.status).toBe('clear')
  })
})

describe('check summaries and before/after comparisons', () => {
  it('counts each result once and keeps likely attention as a subset', () => {
    const entries = [
      { ...result('definite', ['door-1'], 'attention', true), verdicts: [{ benchmarkId: 'th-public-building' as const, key: 'door.clearWidth' as const, outcome: 'does-not-meet' as const, pendingReview: false }, { benchmarkId: 'th-dop-home' as const, key: 'door.clearWidth' as const, outcome: 'likely-does-not-meet' as const, pendingReview: true }] },
      { ...result('likely', ['toilet-1'], 'attention'), verdicts: [{ benchmarkId: 'th-public-building' as const, key: 'door.clearWidth' as const, outcome: 'likely-does-not-meet' as const, pendingReview: true }] },
      result('unknown', [], 'not-evaluated'),
      result('clear', ['basin-1'], 'clear', true),
    ]

    expect(summarizeChecks(entries)).toEqual({ attention: 2, likelyAttention: 2, notEvaluated: 1, clear: 1, total: 4, nearFall: 2 })
  })

  it('matches statuses by rule and entity IDs rather than layout-specific result IDs', () => {
    const before = [
      result('D01:current:door-1', ['door-1'], 'attention', false, 'D01', 'current'),
      result('B01:current:bathroom', ['bathroom'], 'attention', false, 'B01', 'current'),
    ]
    const after = [
      result('D01:proposed:door-1', ['door-1'], 'clear', false, 'D01', 'proposed'),
      result('B01:proposed:bathroom', ['bathroom'], 'attention', false, 'B01', 'proposed'),
    ]

    expect(compareCheckResults(before, after).map(({ ruleId, before: oldResult, after: newResult }) => [ruleId, oldResult.status, newResult.status]))
      .toEqual([['D01', 'attention', 'clear']])
    expect(before[0].status).toBe('attention')
    expect(after[0].status).toBe('clear')
  })
})
