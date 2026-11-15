import { CATALOG, getCatalogEntry } from './catalog'
import type { FurnitureItem, Layout, Locale, Measurement, Project, Room } from './types'

const estimated = (valueMm: number): Measurement => ({ valueMm, confidence: 'estimated' })
const defaultRoom = (): Room => ({ width: estimated(6000), depth: estimated(5000), height: estimated(2700) })
const emptyLayout = (): Layout => ({ room: defaultRoom(), openings: [], items: [], routes: [], turningAreas: [] })

export function createEmptyProject(id: string, now: string): Project {
  const layout = emptyLayout()
  return {
    schemaVersion: 1, id, title: 'โครงการห้องนั่งเล่นใหม่', createdAt: now, updatedAt: now, revision: 0,
    household: { province: '', activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
    current: layout, proposed: null, targets: { routeWidth: null, turningDiameter: null }, recommendations: [], review: null,
  }
}

function catalogItem(catalogId: string, id: string, label: string, xMm: number, yMm: number): FurnitureItem {
  const entry = getCatalogEntry(catalogId) ?? CATALOG[9]
  const dims = entry.defaultDimensionsMm
  return {
    id, catalogId, label, center: { xMm, yMm }, width: estimated(dims.width), depth: estimated(dims.depth), height: estimated(dims.height),
    rotationDeg: 0, finish: catalogId === 'sofa' ? 'sage' : 'oak', obstruction: entry.obstruction,
  }
}

export function createExampleProject(now: string, locale: Locale = 'th'): Project {
  const project = createEmptyProject('example-thailand-living-room', now)
  project.title = locale === 'th' ? 'ตัวอย่างห้องนั่งเล่น — โครงการสมมติ' : 'Example living room — fictional project'
  project.current.openings = [
    { id: 'entry-door', kind: 'door', wall: 'north', offset: estimated(300), width: estimated(900), height: estimated(2100), sill: estimated(0), threshold: estimated(0), operation: 'hinged-in', hinge: 'start' },
    { id: 'south-window', kind: 'window', wall: 'south', offset: estimated(2400), width: estimated(1200), height: estimated(1200), sill: estimated(900), threshold: estimated(0) },
  ]
  const sofa = catalogItem('sofa', 'sofa-1', locale === 'th' ? 'โซฟา' : 'Sofa', 3000, 4200)
  const table = catalogItem('coffee-table', 'coffee-table-1', locale === 'th' ? 'โต๊ะกลาง' : 'Coffee table', 3000, 500)
  project.current.items = [sofa, table]
  project.current.routes = [{
    id: 'example-route', label: locale === 'th' ? 'แนวทางเดินตัวอย่าง — ความกว้างเพื่อสาธิต' : 'Example corridor — illustrative width',
    points: [{ xMm: 500, yMm: 500 }, { xMm: 5500, yMm: 500 }], widthMm: 1000,
  }]
  project.proposed = structuredClone(project.current)
  project.proposed.items = project.proposed.items.map((item) => item.id === table.id ? { ...item, center: { xMm: 3000, yMm: 1800 } } : item)
  return project
}
