import type { Confidence, RoomSpace, Wall } from './types'

export type PlanScheduleItem = {
  id: string
  number: number
  label: string
  widthMm: number
  depthMm: number
  widthLabel: string
  depthLabel: string
}

export type PlanScheduleFixture = {
  id: string
  label: string
  wall: Wall
  referenceHeightMm: number
  heightLabel: string
  confidence: Confidence
}

export type PlanSchedule = {
  items: PlanScheduleItem[]
  fixtures: PlanScheduleFixture[]
}

function metres(valueMm: number): string {
  return `${(valueMm / 1000).toFixed(2)} m`
}

/** Numbers follow the room's persisted item order and are never stored in project data. */
export function buildPlanSchedule(room: RoomSpace): PlanSchedule {
  return {
    items: room.items.map((item, index) => ({
      id: item.id,
      number: index + 1,
      label: item.label,
      widthMm: item.width.valueMm,
      depthMm: item.depth.valueMm,
      widthLabel: metres(item.width.valueMm),
      depthLabel: metres(item.depth.valueMm),
    })),
    fixtures: room.fixtures.map((fixture) => ({
      id: fixture.id,
      label: fixture.label,
      wall: fixture.wall,
      referenceHeightMm: fixture.referenceHeight.valueMm,
      heightLabel: metres(fixture.referenceHeight.valueMm),
      confidence: fixture.referenceHeight.confidence,
    })),
  }
}
