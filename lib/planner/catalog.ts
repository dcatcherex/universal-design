import type { RoomType } from './types'

export type CatalogCategory = 'seating' | 'tables' | 'storage' | 'lighting' | 'rugs' | 'bathroom' | 'custom'
export type CatalogEntry = {
  id: string
  label: { th: string; en: string }
  category: CatalogCategory
  defaultDimensionsMm: { width: number; depth: number; height: number }
  obstruction: 'solid' | 'rug'
  meshKind: 'sofa' | 'chair' | 'table' | 'cabinet' | 'lamp' | 'rug' | 'block' | 'toilet' | 'squat-toilet' | 'stool' | 'jar'
  /** True when the piece is something a person sits on, so its seat height can be recorded. */
  hasSeatHeight?: boolean
  /** Fictional starting value for the seat height. Absent means "not recorded yet". */
  defaultSeatHeightMm?: number
}

// All dimensions are fictional defaults for an original collection, not product data.
export const CATALOG: readonly CatalogEntry[] = [
  { id: 'sofa', label: { th: 'โซฟา', en: 'Sofa' }, category: 'seating', defaultDimensionsMm: { width: 2100, depth: 900, height: 850 }, obstruction: 'solid', meshKind: 'sofa', hasSeatHeight: true },
  { id: 'armchair', label: { th: 'เก้าอี้นวม', en: 'Armchair' }, category: 'seating', defaultDimensionsMm: { width: 850, depth: 850, height: 900 }, obstruction: 'solid', meshKind: 'chair', hasSeatHeight: true },
  { id: 'coffee-table', label: { th: 'โต๊ะกลาง', en: 'Coffee table' }, category: 'tables', defaultDimensionsMm: { width: 1100, depth: 600, height: 450 }, obstruction: 'solid', meshKind: 'table' },
  { id: 'side-table', label: { th: 'โต๊ะข้าง', en: 'Side table' }, category: 'tables', defaultDimensionsMm: { width: 450, depth: 450, height: 550 }, obstruction: 'solid', meshKind: 'table' },
  { id: 'dining-chair', label: { th: 'เก้าอี้รับประทานอาหาร', en: 'Dining chair' }, category: 'seating', defaultDimensionsMm: { width: 500, depth: 550, height: 850 }, obstruction: 'solid', meshKind: 'chair', hasSeatHeight: true },
  { id: 'dining-table', label: { th: 'โต๊ะรับประทานอาหาร', en: 'Dining table' }, category: 'tables', defaultDimensionsMm: { width: 1400, depth: 800, height: 750 }, obstruction: 'solid', meshKind: 'table' },
  { id: 'low-cabinet', label: { th: 'ตู้เตี้ย', en: 'Low cabinet' }, category: 'storage', defaultDimensionsMm: { width: 1200, depth: 400, height: 800 }, obstruction: 'solid', meshKind: 'cabinet' },
  { id: 'floor-lamp', label: { th: 'โคมไฟตั้งพื้น', en: 'Floor lamp' }, category: 'lighting', defaultDimensionsMm: { width: 350, depth: 350, height: 1600 }, obstruction: 'solid', meshKind: 'lamp' },
  { id: 'rug', label: { th: 'พรม', en: 'Rug' }, category: 'rugs', defaultDimensionsMm: { width: 1800, depth: 1200, height: 10 }, obstruction: 'rug', meshKind: 'rug' },
  { id: 'custom-block', label: { th: 'สิ่งของกำหนดเอง', en: 'Custom block' }, category: 'custom', defaultDimensionsMm: { width: 600, depth: 600, height: 600 }, obstruction: 'solid', meshKind: 'block' },
  { id: 'toilet-seated', label: { th: 'โถส้วมนั่งราบ', en: 'Sit-down toilet' }, category: 'bathroom', defaultDimensionsMm: { width: 400, depth: 650, height: 780 }, obstruction: 'solid', meshKind: 'toilet', hasSeatHeight: true, defaultSeatHeightMm: 420 },
  { id: 'toilet-squat', label: { th: 'โถส้วมนั่งยอง', en: 'Squat toilet' }, category: 'bathroom', defaultDimensionsMm: { width: 450, depth: 600, height: 150 }, obstruction: 'solid', meshKind: 'squat-toilet' },
  { id: 'shower-seat', label: { th: 'เก้าอี้นั่งอาบน้ำ', en: 'Shower seat' }, category: 'bathroom', defaultDimensionsMm: { width: 450, depth: 450, height: 480 }, obstruction: 'solid', meshKind: 'stool', hasSeatHeight: true, defaultSeatHeightMm: 480 },
  { id: 'water-jar', label: { th: 'โอ่งน้ำ', en: 'Water jar' }, category: 'bathroom', defaultDimensionsMm: { width: 600, depth: 600, height: 700 }, obstruction: 'solid', meshKind: 'jar' },
  { id: 'bath-cabinet', label: { th: 'ตู้ห้องน้ำ', en: 'Bathroom cabinet' }, category: 'bathroom', defaultDimensionsMm: { width: 600, depth: 350, height: 800 }, obstruction: 'solid', meshKind: 'cabinet' },
]

const CUSTOM_BLOCK = CATALOG.find((entry) => entry.id === 'custom-block')!

/** Which catalog categories make sense in each room type. */
export const ROOM_CATEGORIES: Record<RoomType, readonly CatalogCategory[]> = {
  living: ['seating', 'tables', 'storage', 'lighting', 'rugs', 'custom'],
  bathroom: ['bathroom', 'custom'],
}

export function catalogForRoom(roomType: RoomType): CatalogEntry[] {
  return CATALOG.filter((entry) => ROOM_CATEGORIES[roomType].includes(entry.category))
}

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.id === id)
}

/** Unknown catalog IDs (from a newer file, say) draw as a custom block; the saved ID is left alone. */
export function resolveCatalogEntry(id: string): CatalogEntry {
  return getCatalogEntry(id) ?? CUSTOM_BLOCK
}

export function isToilet(catalogId: string): boolean {
  return catalogId === 'toilet-seated' || catalogId === 'toilet-squat'
}
