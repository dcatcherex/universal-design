import { describe, expect, it } from 'vitest'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { resolveCatalogEntry } from '../../lib/planner/catalog'
import { createExampleProject } from '../../lib/planner/fixtures'
import { decodeProject, encodeProject, projectFilename } from '../../lib/planner/project-files'

const now = '2026-09-28T10:00:00.000Z'

function detailedProject() {
  const project = createExampleProject(now)
  project.targets.routeWidth = { valueMm: 900, rationale: 'Project-specific trial target', enteredBy: 'Advisor', enteredAt: now }
  project.recommendations = [{
    id: 'rec-1', layoutId: 'proposed', entityId: 'coffee-table-1', title: 'Move the table', reason: 'Keep route clear', action: 'Move before use',
    priority: 'next', workType: 'rearrange', status: 'accepted', advisorNote: 'Discussed with household',
    materials: { lowSatang: 10000, highSatang: 20000, sourceNote: 'Local quotation supplied by family', estimatedAt: now },
    labour: null,
  }]
  project.review = { reviewerName: 'Advisor', reviewedAt: now, projectRevision: project.revision, benchmarkDatasetVersion: '2026.10-draft' }
  return project
}

describe('project file exchange', () => {
  it('round-trips both layouts, IDs, targets, estimates and review receipts', () => {
    const project = detailedProject()
    const result = decodeProject(encodeProject(project))
    expect(result).toEqual({ ok: true, value: project })
  })
  it('rejects malformed JSON and projects larger than 2 MiB', () => {
    expect(decodeProject('{ broken').ok).toBe(false)
    expect(decodeProject(' '.repeat(2 * 1024 * 1024 + 1)).ok).toBe(false)
  })
  it('rejects future schema versions and duplicate IDs', () => {
    const future = detailedProject() as unknown as Record<string, unknown>
    expect(decodeProject(JSON.stringify({ ...future, schemaVersion: 3 })).ok).toBe(false)
    const duplicate = detailedProject()
    getPrimaryRoom(duplicate.current).items.push({ ...getPrimaryRoom(duplicate.current).items[0] })
    expect(decodeProject(JSON.stringify(duplicate)).ok).toBe(false)
  })
  it('rejects invalid costs and dangling recommendation references', () => {
    const project = detailedProject()
    project.recommendations[0].materials!.highSatang = -1
    expect(decodeProject(JSON.stringify(project)).ok).toBe(false)
    project.recommendations[0].materials!.highSatang = 20000
    project.recommendations[0].entityId = 'missing'
    expect(decodeProject(JSON.stringify(project)).ok).toBe(false)
  })
  it('keeps unknown catalog ids and resolves them to a custom-block appearance', () => {
    const project = detailedProject()
    getPrimaryRoom(project.current).items[0].catalogId = 'future-furniture'
    const result = decodeProject(JSON.stringify(project))
    expect(result.ok).toBe(true)
    expect(resolveCatalogEntry('future-furniture').id).toBe('custom-block')
    if (result.ok) expect(getPrimaryRoom(result.value.current).items[0].catalogId).toBe('future-furniture')
  })
  it('sanitizes project titles into safe .udhome.json names', () => {
    expect(projectFilename('../My room:*?')).toBe('My room.udhome.json')
  })
})
