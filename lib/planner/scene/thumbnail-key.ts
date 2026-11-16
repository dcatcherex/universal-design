import type { CatalogEntry } from '../catalog'
import type { FurnitureItem } from '../types'

// Kept free of Three.js imports so UI code can compute keys without loading the 3D bundle.

export function thumbnailKey(item: Pick<FurnitureItem, 'catalogId' | 'width' | 'depth' | 'height' | 'finish'>): string {
  return `${item.catalogId}|${item.width.valueMm}|${item.depth.valueMm}|${item.height.valueMm}|${item.finish}`
}

export function catalogEntryAsItem(entry: CatalogEntry, finish: FurnitureItem['finish'] = 'oak'): FurnitureItem {
  return {
    id: `thumb-${entry.id}`, catalogId: entry.id, label: entry.id, center: { xMm: 0, yMm: 0 },
    width: { valueMm: entry.defaultDimensionsMm.width, confidence: 'estimated' },
    depth: { valueMm: entry.defaultDimensionsMm.depth, confidence: 'estimated' },
    height: { valueMm: entry.defaultDimensionsMm.height, confidence: 'estimated' },
    rotationDeg: 0, finish, obstruction: entry.obstruction,
  }
}
