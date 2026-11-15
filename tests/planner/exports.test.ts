import { describe, expect, it } from 'vitest'
import { buildReportData } from '../../lib/planner/exports/report-data'
import { createPlanSvg } from '../../lib/planner/exports/plan-svg'
import { createExampleProject } from '../../lib/planner/fixtures'
import type { Layout } from '../../lib/planner/types'

const now = '2026-09-28T10:00:00.000Z'

describe('plan and report exports', () => {
  it('exports millimetre furniture geometry, rotation, and visible overlays', () => {
    const project = createExampleProject(now)
    project.current.items[0].rotationDeg = 90
    const svg = createPlanSvg(project.current, { locale: 'th', layoutLabel: 'แผนปัจจุบัน', showOverlays: true })
    expect(svg).toContain('viewBox="0 0 6000 5000"')
    expect(svg).toContain('data-footprint="2550 3150 3450 5250"')
    expect(svg).toContain('rotate(90)')
    expect(svg).toContain('แนวทางเดินตัวอย่าง')
    expect(createPlanSvg(project.current, { locale: 'th', layoutLabel: 'ปัจจุบัน', showOverlays: false })).not.toContain('data-overlay-id="example-route"')
  })

  it('escapes Thai labels and script-like project text instead of inserting markup', () => {
    const layout = createExampleProject(now).current
    layout.items[0].label = '<script>alert("x")</script>'
    const svg = createPlanSvg(layout, { locale: 'en', layoutLabel: 'Before <room>', showOverlays: true })
    expect(svg).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(svg).toContain('Before &lt;room&gt;')
    expect(svg).not.toContain('<script>')
  })

  it('builds fresh checks after layout edits and labels a missing proposed plan', () => {
    const project = createExampleProject(now)
    project.proposed = null
    const before = buildReportData(project, 'en')
    const edited: Layout = structuredClone(project.current)
    edited.items.find((item) => item.id === 'coffee-table-1')!.center.yMm = 1800
    project.current = edited
    project.revision += 1
    const after = buildReportData(project, 'en')
    expect(before.projectRevision).toBe(0)
    expect(after.projectRevision).toBe(1)
    expect(after.plans.current.checks.find((check) => check.ruleId === 'G04')?.status).toBe('clear')
    expect(after.plans.proposed.layout).toBeNull()
    expect(after.plans.proposed.label).toBe('Proposed plan not created')
  })

  it('includes review revision, confidence, recommendations, and unknown costs in a consistent snapshot', () => {
    const project = createExampleProject(now)
    project.review = { reviewerName: 'Advisor', reviewedAt: now, projectRevision: 0 }
    project.recommendations.push({ id: 'estimate-1', layoutId: 'current', title: 'Keep costs unknown', reason: 'No quote', action: 'Ask later', priority: 'later', workType: 'site-review', status: 'accepted', advisorNote: '', materials: null, labour: null })
    const report = buildReportData(project, 'th')
    expect(report.review).toMatchObject({ status: 'reviewed', receipt: { projectRevision: 0, reviewerName: 'Advisor' } })
    expect(report.plans.current.layout?.room.width.confidence).toBe('estimated')
    expect(report.costs).toEqual({ lowSatang: 0, highSatang: 0, missingComponents: 2, includedCount: 1 })
    expect(report.recommendations[0].materials).toBeNull()
  })
})
