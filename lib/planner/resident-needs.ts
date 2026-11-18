import { getPrimaryFloor, getPrimaryRoom } from './layout-access'
import { canonicalMobilityAids, type BenchmarkContext } from './standards/benchmarks'
import { isToilet } from './catalog'
import type { MessageKey } from './i18n'
import type { Layout, Project, ResidentNeed, RoomSpace, RuleId } from './types'

export const RESIDENT_NEEDS: readonly ResidentNeed[] = [
  'cane', 'walker', 'wheelchair', 'weak-grip', 'difficulty-standing-up', 'unsteady-balance',
]
export const NEED_LABEL_KEYS: Record<ResidentNeed, MessageKey> = {
  cane: 'needCane',
  walker: 'needWalker',
  wheelchair: 'needWheelchair',
  'weak-grip': 'needWeakGrip',
  'difficulty-standing-up': 'needDifficultyStanding',
  'unsteady-balance': 'needUnsteadyBalance',
}

const NEED_RULES: Record<ResidentNeed, readonly RuleId[]> = {
  cane: ['D03', 'B05'],
  walker: ['D01', 'D03', 'G04'],
  wheelchair: ['H02', 'H03', 'D01', 'D03', 'G04', 'G05', 'B04'],
  'weak-grip': ['D02', 'B03'],
  'difficulty-standing-up': ['B02', 'B03'],
  'unsteady-balance': ['B03', 'B05', 'D03'],
}

export type NeedPrompt = {
  id: 'wheelchair-width' | 'wheelchair-turning' | 'walker-route' | 'weak-grip-handle' | 'standing-seat' | 'balance-floor'
  need: ResidentNeed
  ruleId: RuleId
  messageKey: 'needPromptWheelchairWidth' | 'needPromptWheelchairTurning' | 'needPromptWalkerRoute' | 'needPromptWeakGripHandle' | 'needPromptStandingSeat' | 'needPromptBalanceFloor'
  focusTarget: 'wheelchair-width' | 'turning-area' | 'walking-route' | 'door-handle' | 'toilet-seat' | 'floor-slip'
  entityId?: string
}

/** Merge the language-independent presets with mobility aids saved by older project versions. */
export function getResidentNeeds(project: Project): ResidentNeed[] {
  const needs = new Set<ResidentNeed>(project.resident.needs ?? [])
  for (const aid of canonicalMobilityAids(project.household.mobilityAids)) {
    if (aid === 'cane' || aid === 'walker' || aid === 'wheelchair') needs.add(aid)
  }
  return RESIDENT_NEEDS.filter((need) => needs.has(need))
}

/** The single context every benchmark lookup derives from: room type plus the merged resident needs. */
export function benchmarkContextFor(project: Project, room: RoomSpace): BenchmarkContext {
  return { roomType: room.type, mobilityAids: getResidentNeeds(project) }
}

export function getRelevantNeedsForRule(ruleId: RuleId, needs: readonly ResidentNeed[]): ResidentNeed[] {
  return RESIDENT_NEEDS.filter((need) => needs.includes(need) && NEED_RULES[need].includes(ruleId))
}

/** Missing-data prompts are reminders only; they do not add measurements or affect any verdict. */
export function getNeedPrompts(project: Project, layout: Layout): NeedPrompt[] {
  const needs = getResidentNeeds(project)
  const floor = getPrimaryFloor(layout)
  const room = getPrimaryRoom(layout)
  const prompts: NeedPrompt[] = []

  if (needs.includes('wheelchair')) {
    if (!project.resident.wheelchair) prompts.push({ id: 'wheelchair-width', need: 'wheelchair', ruleId: 'H03', messageKey: 'needPromptWheelchairWidth', focusTarget: 'wheelchair-width' })
    if (room.type === 'bathroom' && !floor.turningAreas.length) prompts.push({ id: 'wheelchair-turning', need: 'wheelchair', ruleId: 'G05', messageKey: 'needPromptWheelchairTurning', focusTarget: 'turning-area' })
  }
  if (needs.includes('walker') && !floor.routes.length) {
    prompts.push({ id: 'walker-route', need: 'walker', ruleId: 'G04', messageKey: 'needPromptWalkerRoute', focusTarget: 'walking-route' })
  }
  const doorNeedingHandle = room.openings.find((opening) => opening.kind === 'door' && (!opening.handle || opening.handle.type === 'unknown'))
  if (needs.includes('weak-grip') && doorNeedingHandle) {
    prompts.push({ id: 'weak-grip-handle', need: 'weak-grip', ruleId: 'D02', messageKey: 'needPromptWeakGripHandle', focusTarget: 'door-handle', entityId: doorNeedingHandle.id })
  }
  const toiletNeedingSeat = room.items.find((item) => isToilet(item.catalogId) && item.catalogId !== 'toilet-squat' && !item.seatHeight)
  if (needs.includes('difficulty-standing-up') && toiletNeedingSeat) {
    prompts.push({ id: 'standing-seat', need: 'difficulty-standing-up', ruleId: 'B02', messageKey: 'needPromptStandingSeat', focusTarget: 'toilet-seat', entityId: toiletNeedingSeat.id })
  }
  if (needs.includes('unsteady-balance') && room.type === 'bathroom' && room.floor.slipResistance === 'unknown') {
    prompts.push({ id: 'balance-floor', need: 'unsteady-balance', ruleId: 'B05', messageKey: 'needPromptBalanceFloor', focusTarget: 'floor-slip' })
  }
  return prompts
}
