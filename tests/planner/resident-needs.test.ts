import { describe, expect, it } from 'vitest'
import { createBathroomExampleProject, createExampleProject } from '../../lib/planner/fixtures'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { evaluateLayout } from '../../lib/planner/checks'
import { getNeedPrompts, getRelevantNeedsForRule, getResidentNeeds, RESIDENT_NEEDS } from '../../lib/planner/resident-needs'
import { createFixture } from '../../lib/planner/fixtures-catalog'
import { validateProject } from '../../lib/planner/schema'
import { hasHealthData } from '../../lib/planner/exports/report-data'
import type { Project, ResidentNeed, RuleId } from '../../lib/planner/types'

const now = '2026-11-17T00:00:00.000Z'

describe('resident needs', () => {
  it('merges the language-independent presets with legacy aids in both languages', () => {
    const project = createExampleProject(now)
    project.household.mobilityAids = ['Cane', 'Walker']
    project.resident.needs = ['weak-grip', 'walker']
    expect(getResidentNeeds(project)).toEqual(['cane', 'walker', 'weak-grip'])
    project.household.mobilityAids = ['Wheelchair']
    project.resident.needs = []
    expect(getResidentNeeds(project)).toEqual(['wheelchair'])
    project.household.mobilityAids = ['ไม้เท้า', 'รถช่วยเดิน', 'รถเข็น']
    expect(getResidentNeeds(project)).toEqual(['cane', 'walker', 'wheelchair'])
    project.household.mobilityAids = []
    project.resident.needs = ['wheelchair']
    expect(getResidentNeeds(project)).toEqual(['wheelchair'])
  })

  it('defaults needs when parsing an older v2 project without the optional field', () => {
    const project = createExampleProject(now)
    const resident = { ...project.resident }
    delete resident.needs
    const parsed = validateProject({ ...project, resident })
    expect(parsed.ok && parsed.value.resident.needs).toEqual([])
    expect(validateProject({ ...project, resident: { ...project.resident, needs: ['unsteady-balance'] } }).ok).toBe(true)
    expect(validateProject({ ...project, resident: { ...project.resident, needs: ['poor-eyesight'] } }).ok).toBe(false)
  })

  it('marks exactly the checks listed for each need as relevant', () => {
    const relevance: Record<ResidentNeed, readonly RuleId[]> = {
      cane: ['D03', 'B05'],
      walker: ['D01', 'D03', 'G04'],
      wheelchair: ['H02', 'H03', 'D01', 'D03', 'G04', 'G05', 'B04'],
      'weak-grip': ['D02', 'B03'],
      'difficulty-standing-up': ['B02', 'B03'],
      'unsteady-balance': ['B03', 'B05', 'D03'],
    }
    for (const need of RESIDENT_NEEDS) {
      for (const rule of ['D01', 'D02', 'D03', 'G04', 'G05', 'H02', 'H03', 'B02', 'B03', 'B04', 'B05'] as const) {
        expect(getRelevantNeedsForRule(rule, [need]).includes(need)).toBe(relevance[need].includes(rule))
      }
    }
  })

  it('adds need relevance without changing existing check statuses or verdicts', () => {
    const baseline = createBathroomExampleProject(now)
    const baselineResults = evaluateLayout(baseline, 'current')
    for (const need of RESIDENT_NEEDS) {
      const project: Project = { ...baseline, resident: { ...baseline.resident, needs: [need] } }
      const byId = new Map(evaluateLayout(project, 'current').map((result) => [result.id, result]))
      for (const before of baselineResults) {
        const after = byId.get(before.id)
        expect(after, before.id).toBeDefined()
        expect({ status: after?.status, verdicts: after?.verdicts }).toEqual({ status: before.status, verdicts: before.verdicts })
      }
    }
  })

  it('uses a new wheelchair preset for the existing socket check without inventing dimensions', () => {
    const project = createBathroomExampleProject(now)
    project.household.mobilityAids = []
    const room = getPrimaryRoom(project.current)
    room.fixtures.push(createFixture('socket', 'north', room, 'need-socket', 'Socket'))
    const before = evaluateLayout(project, 'current').find((result) => result.ruleId === 'H02')
    project.resident.needs = ['wheelchair']
    const after = evaluateLayout(project, 'current').find((result) => result.ruleId === 'H02')
    expect(before).toBeUndefined()
    expect(after).toBeDefined()
    expect(project.resident.wheelchair).toBeNull()
    project.resident.needs = []
    project.household.mobilityAids = ['Wheelchair']
    const legacy = evaluateLayout(project, 'current').find((result) => result.ruleId === 'H02')
    expect(legacy && after && { status: legacy.status, verdicts: legacy.verdicts }).toEqual({ status: after?.status, verdicts: after?.verdicts })
  })

  it('prompts only for relevant data that is missing and treats needs as health information', () => {
    const project = createBathroomExampleProject(now)
    project.resident.needs = ['weak-grip', 'wheelchair']
    getPrimaryRoom(project.current).openings[0].handle = null
    const prompts = getNeedPrompts(project, project.current)
    expect(prompts.map((prompt) => prompt.id)).toEqual(['wheelchair-width', 'wheelchair-turning', 'weak-grip-handle'])
    expect(hasHealthData(project)).toBe(true)
    project.resident.needs = []
    expect(hasHealthData(project)).toBe(false)
  })
})
