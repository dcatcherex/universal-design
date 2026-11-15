export type CatalogEntry = {
  id: string
  label: { th: string; en: string }
  category: 'seating' | 'tables' | 'storage' | 'lighting' | 'rugs' | 'custom'
  defaultDimensionsMm: { width: number; depth: number; height: number }
  obstruction: 'solid' | 'rug'
  meshKind: 'sofa' | 'chair' | 'table' | 'cabinet' | 'lamp' | 'rug' | 'block'
}

export const CATALOG: readonly CatalogEntry[] = [
  { id: 'sofa', label: { th: 'โซฟา', en: 'Sofa' }, category: 'seating', defaultDimensionsMm: { width: 2100, depth: 900, height: 850 }, obstruction: 'solid', meshKind: 'sofa' },
  { id: 'armchair', label: { th: 'เก้าอี้นวม', en: 'Armchair' }, category: 'seating', defaultDimensionsMm: { width: 850, depth: 850, height: 900 }, obstruction: 'solid', meshKind: 'chair' },
  { id: 'coffee-table', label: { th: 'โต๊ะกลาง', en: 'Coffee table' }, category: 'tables', defaultDimensionsMm: { width: 1100, depth: 600, height: 450 }, obstruction: 'solid', meshKind: 'table' },
  { id: 'side-table', label: { th: 'โต๊ะข้าง', en: 'Side table' }, category: 'tables', defaultDimensionsMm: { width: 450, depth: 450, height: 550 }, obstruction: 'solid', meshKind: 'table' },
  { id: 'dining-chair', label: { th: 'เก้าอี้รับประทานอาหาร', en: 'Dining chair' }, category: 'seating', defaultDimensionsMm: { width: 500, depth: 550, height: 850 }, obstruction: 'solid', meshKind: 'chair' },
  { id: 'dining-table', label: { th: 'โต๊ะรับประทานอาหาร', en: 'Dining table' }, category: 'tables', defaultDimensionsMm: { width: 1400, depth: 800, height: 750 }, obstruction: 'solid', meshKind: 'table' },
  { id: 'low-cabinet', label: { th: 'ตู้เตี้ย', en: 'Low cabinet' }, category: 'storage', defaultDimensionsMm: { width: 1200, depth: 400, height: 800 }, obstruction: 'solid', meshKind: 'cabinet' },
  { id: 'floor-lamp', label: { th: 'โคมไฟตั้งพื้น', en: 'Floor lamp' }, category: 'lighting', defaultDimensionsMm: { width: 350, depth: 350, height: 1600 }, obstruction: 'solid', meshKind: 'lamp' },
  { id: 'rug', label: { th: 'พรม', en: 'Rug' }, category: 'rugs', defaultDimensionsMm: { width: 1800, depth: 1200, height: 10 }, obstruction: 'rug', meshKind: 'rug' },
  { id: 'custom-block', label: { th: 'สิ่งของกำหนดเอง', en: 'Custom block' }, category: 'custom', defaultDimensionsMm: { width: 600, depth: 600, height: 600 }, obstruction: 'solid', meshKind: 'block' },
]

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.id === id)
}

export function resolveCatalogEntry(id: string): CatalogEntry {
  return getCatalogEntry(id) ?? CATALOG[9]
}
