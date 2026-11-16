import { resolveCatalogEntry } from './catalog'
import { getPrimaryFloor, getPrimaryRoom } from './layout-access'
import type { FurnitureItem, Layout, Locale, Measurement, Project, ResidentProfile, RoomSpace, RoomType } from './types'

const estimated = (valueMm: number): Measurement => ({ valueMm, confidence: 'estimated' })

const DEFAULT_ROOM_SIZE: Record<RoomType, { width: number; depth: number; height: number }> = {
  living: { width: 6000, depth: 5000, height: 2700 },
  bathroom: { width: 2000, depth: 1800, height: 2500 },
}

export function emptyResident(): ResidentProfile {
  return { standingHeight: null, reach: null, strongerHand: 'unknown', wheelchair: null, falls: [] }
}

export function createRoom(type: RoomType, size = DEFAULT_ROOM_SIZE[type]): RoomSpace {
  return {
    id: 'room-1', type, label: '', origin: { xMm: 0, yMm: 0 },
    shape: { kind: 'rect', width: estimated(size.width), depth: estimated(size.depth) },
    height: estimated(size.height),
    floor: { finish: 'unknown', slipResistance: 'unknown', confidence: 'estimated' },
    openings: [], items: [], fixtures: [], wetZones: [],
  }
}

export function createLayout(room: RoomSpace): Layout {
  return { floors: [{ id: 'floor-1', label: '', level: 0, rooms: [room], routes: [], turningAreas: [] }] }
}

export function createEmptyProject(id: string, now: string, roomType: RoomType = 'living'): Project {
  return {
    schemaVersion: 2, id, title: roomType === 'bathroom' ? 'โครงการห้องน้ำใหม่' : 'โครงการห้องนั่งเล่นใหม่', createdAt: now, updatedAt: now, revision: 0,
    household: { province: '', provinceCode: null, activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
    resident: emptyResident(),
    current: createLayout(createRoom(roomType)), proposed: null,
    benchmarkPolicy: null,
    targets: { routeWidth: null, turningDiameter: null }, recommendations: [], review: null,
    report: { includeFallHistory: false },
  }
}

/** A catalog piece at its default size. The seat height starts at the catalog default, or null when there is none. */
export function createCatalogItem(catalogId: string, id: string, label: string, xMm: number, yMm: number, finish: FurnitureItem['finish'] = 'oak'): FurnitureItem {
  const entry = resolveCatalogEntry(catalogId)
  const dims = entry.defaultDimensionsMm
  return {
    id, catalogId, label, center: { xMm, yMm }, width: estimated(dims.width), depth: estimated(dims.depth), height: estimated(dims.height),
    rotationDeg: 0, finish, obstruction: entry.obstruction,
    seatHeight: entry.defaultSeatHeightMm !== undefined ? estimated(entry.defaultSeatHeightMm) : null,
  }
}

export function createExampleProject(now: string, locale: Locale = 'th'): Project {
  const project = createEmptyProject('example-thailand-living-room', now)
  project.title = locale === 'th' ? 'ตัวอย่างห้องนั่งเล่น — โครงการสมมติ' : 'Example living room — fictional project'
  const room = getPrimaryRoom(project.current)
  room.openings = [
    { id: 'entry-door', kind: 'door', wall: 'north', offset: estimated(300), width: estimated(900), height: estimated(2100), sill: estimated(0), threshold: estimated(0), operation: 'hinged-in', hinge: 'start', handle: null, connectsToRoomId: null },
    { id: 'south-window', kind: 'window', wall: 'south', offset: estimated(2400), width: estimated(1200), height: estimated(1200), sill: estimated(900), threshold: estimated(0) },
  ]
  const sofa = createCatalogItem('sofa', 'sofa-1', locale === 'th' ? 'โซฟา' : 'Sofa', 3000, 4200, 'sage')
  const table = createCatalogItem('coffee-table', 'coffee-table-1', locale === 'th' ? 'โต๊ะกลาง' : 'Coffee table', 3000, 500)
  room.items = [sofa, table]
  getPrimaryFloor(project.current).routes = [{
    id: 'example-route', label: locale === 'th' ? 'แนวทางเดินตัวอย่าง — ความกว้างเพื่อสาธิต' : 'Example corridor — illustrative width',
    points: [{ xMm: 500, yMm: 500 }, { xMm: 5500, yMm: 500 }], widthMm: 1000,
  }]
  project.proposed = structuredClone(project.current)
  const proposedRoom = getPrimaryRoom(project.proposed)
  proposedRoom.items = proposedRoom.items.map((item) => item.id === table.id ? { ...item, center: { xMm: 3000, yMm: 1800 } } : item)
  return project
}

/**
 * A fictional bathroom with the problems the bathroom checks look for: a narrow inward-opening
 * door with a raised threshold and a knob, a low toilet with no grab bar, and a floor whose slip
 * resistance is not recorded. Every value is an estimate and nothing here is a recommendation.
 */
export function createBathroomExampleProject(now: string, locale: Locale = 'th'): Project {
  const project = createEmptyProject('example-thailand-bathroom', now, 'bathroom')
  project.title = locale === 'th' ? 'ตัวอย่างห้องน้ำ — โครงการสมมติ' : 'Example bathroom — fictional project'
  const room = getPrimaryRoom(project.current)
  room.floor = { finish: 'tile', slipResistance: 'unknown', confidence: 'estimated' }
  room.openings = [{
    id: 'bathroom-door', kind: 'door', wall: 'north', offset: estimated(200), width: estimated(700), height: estimated(2000), sill: estimated(0),
    threshold: estimated(30), operation: 'hinged-in', hinge: 'start', handle: { type: 'knob', height: estimated(950) }, connectsToRoomId: null,
  }]
  const toilet = createCatalogItem('toilet-seated', 'toilet-1', locale === 'th' ? 'โถส้วมนั่งราบ' : 'Sit-down toilet', 1500, 1400, 'cream')
  toilet.rotationDeg = 180
  toilet.seatHeight = estimated(380)
  const jar = createCatalogItem('water-jar', 'water-jar-1', locale === 'th' ? 'โอ่งน้ำ' : 'Water jar', 350, 1300, 'charcoal')
  room.items = [toilet, jar]
  room.wetZones = [{ id: 'wet-zone-1', label: locale === 'th' ? 'พื้นที่เปียก' : 'Wet area', rect: { minX: 0, minY: 0, maxX: 1000, maxY: 1800 } }]
  return project
}
