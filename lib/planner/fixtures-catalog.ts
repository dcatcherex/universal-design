import { wallLengthMm } from './geometry'
import type { FixtureKind, Measurement, RoomSpace, Wall, WallFixture } from './types'

export type FixtureCatalogEntry = {
  kind: FixtureKind
  label: { th: string; en: string }
  /** What `referenceHeight` means for this kind, shown beside the field. */
  heightMeaning: { th: string; en: string }
  defaults: { referenceHeight: number; length: number; projection: number; diameter: number | null }
}

// Starting sizes for a newly added fixture. They are fictional placeholders to be replaced by
// what is measured on site, not recommended positions.
export const FIXTURE_CATALOG: readonly FixtureCatalogEntry[] = [
  { kind: 'grab-bar-horizontal', label: { th: 'ราวจับแนวนอน', en: 'Horizontal grab bar' }, heightMeaning: { th: 'วัดถึงกึ่งกลางราว', en: 'Measured to the bar centreline' }, defaults: { referenceHeight: 800, length: 600, projection: 80, diameter: 35 } },
  { kind: 'grab-bar-vertical', label: { th: 'ราวจับแนวตั้ง', en: 'Vertical grab bar' }, heightMeaning: { th: 'วัดถึงปลายล่างของราว', en: 'Measured to the bottom end of the bar' }, defaults: { referenceHeight: 800, length: 600, projection: 80, diameter: 35 } },
  { kind: 'grab-bar-fold-down', label: { th: 'ราวจับแบบพับได้', en: 'Fold-down grab bar' }, heightMeaning: { th: 'วัดถึงกึ่งกลางราวเมื่อกางลง', en: 'Measured to the bar centreline when lowered' }, defaults: { referenceHeight: 800, length: 700, projection: 100, diameter: 35 } },
  { kind: 'switch', label: { th: 'สวิตช์ไฟ', en: 'Light switch' }, heightMeaning: { th: 'วัดถึงกึ่งกลางสวิตช์', en: 'Measured to the centre of the switch' }, defaults: { referenceHeight: 1200, length: 80, projection: 15, diameter: null } },
  { kind: 'socket', label: { th: 'เต้ารับไฟฟ้า', en: 'Power socket' }, heightMeaning: { th: 'วัดถึงกึ่งกลางเต้ารับ', en: 'Measured to the centre of the socket' }, defaults: { referenceHeight: 300, length: 80, projection: 15, diameter: null } },
  { kind: 'shelf', label: { th: 'ชั้นวางของ', en: 'Shelf' }, heightMeaning: { th: 'วัดถึงผิวบนของชั้น', en: 'Measured to the top surface' }, defaults: { referenceHeight: 1400, length: 800, projection: 250, diameter: null } },
  { kind: 'basin', label: { th: 'อ่างล้างมือ', en: 'Basin' }, heightMeaning: { th: 'วัดถึงขอบอ่าง', en: 'Measured to the rim' }, defaults: { referenceHeight: 800, length: 500, projection: 450, diameter: null } },
]

export function getFixtureEntry(kind: FixtureKind): FixtureCatalogEntry {
  return FIXTURE_CATALOG.find((entry) => entry.kind === kind)!
}

export function isGrabBar(kind: FixtureKind): boolean {
  return kind === 'grab-bar-horizontal' || kind === 'grab-bar-vertical' || kind === 'grab-bar-fold-down'
}

const estimated = (valueMm: number): Measurement => ({ valueMm, confidence: 'estimated' })

/** A new fixture of this kind in the middle of a wall, shortened if the wall or ceiling is too small for the default. */
export function createFixture(kind: FixtureKind, wall: Wall, room: Pick<RoomSpace, 'shape' | 'height'>, id: string, label: string, overrides: Partial<{ offset: number; referenceHeight: number; length: number }> = {}): WallFixture {
  const entry = getFixtureEntry(kind)
  const wallLength = wallLengthMm(room, wall)
  const vertical = kind === 'grab-bar-vertical'
  const length = overrides.length ?? Math.min(entry.defaults.length, vertical ? room.height.valueMm : wallLength)
  const referenceHeight = Math.min(overrides.referenceHeight ?? entry.defaults.referenceHeight, room.height.valueMm - (vertical ? length : 0))
  return {
    id, kind, label, wall,
    offset: estimated(overrides.offset ?? Math.round(wallLength / 2)),
    referenceHeight: estimated(referenceHeight),
    length: estimated(length),
    projection: estimated(entry.defaults.projection),
    diameter: entry.defaults.diameter === null ? null : estimated(entry.defaults.diameter),
    kneeClearanceDepth: null,
  }
}
