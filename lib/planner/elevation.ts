import { fixtureFitsWall, fixtureHalfSpanMm, getFootprint, wallLengthMm } from './geometry'
import { BENCHMARK_IDS, getBenchmarkValues, hasValue, type BenchmarkContext, type BenchmarkDataset, type BenchmarkKey } from './standards/benchmarks'
import type { BenchmarkId, FixtureKind, ResidentProfile, RoomSpace, Wall, WallFixture } from './types'

/** Furniture this close to a wall is drawn against it as a silhouette. */
export const SILHOUETTE_DISTANCE_MM = 300

export type ElevationBox = { startMm: number; endMm: number; bottomMm: number; topMm: number }
export type ElevationCheckGeometry = { startMm: number; endMm: number; bottomMm: number; topMm: number }
export type ElevationBandDrawing = {
  canvas: { lowMm: number; highMm: number; rectHeightMm: number; labelYmm: number; labelOffsetMm: number }
  export: { lowMm: number; highMm: number; rectHeightMm: number; labelYmm: number; visible: boolean }
}
export type ElevationModel = {
  wall: Wall
  lengthMm: number
  heightMm: number
  openings: (ElevationBox & { id: string; kind: 'door' | 'window'; checkOutline: ElevationCheckGeometry; badgePoint: { alongMm: number; heightMm: number } })[]
  fixtures: (ElevationBox & { id: string; kind: FixtureKind; label: string; referenceHeightMm: number; checkOutline: ElevationCheckGeometry; badgePoint: { alongMm: number; heightMm: number } })[]
  /** Read-only front outlines of nearby furniture. */
  silhouettes: (ElevationBox & { id: string; label: string; drawing: { canvas: { startMm: number; endMm: number; centerMm: number }; export: { startMm: number; endMm: number; centerMm: number; visible: boolean } } })[]
  /** The band the resident can reach comfortably, when recorded. */
  reachBand: {
    lowMm: number
    highMm: number
    posture: 'standing' | 'seated'
    drawing: { canvas: { lowMm: number; highMm: number }; export: { lowMm: number; highMm: number; labelYmm: number; visible: boolean } }
  } | null
  /** Height ranges the benchmarks give for the selected fixture. */
  benchmarkBands: { benchmarkId: BenchmarkId; key: BenchmarkKey; clause: string; minMm: number; maxMm: number; pendingReview: boolean; drawing: ElevationBandDrawing }[]
  ticks: { canvas: number[]; export: number[] }
}

/** The benchmark key that governs a fixture's reference height, if any. */
export function fixtureHeightKey(kind: FixtureKind): BenchmarkKey | null {
  if (kind === 'grab-bar-horizontal' || kind === 'grab-bar-fold-down') return 'grabBar.horizontalHeight'
  if (kind === 'basin') return 'basin.rimHeight'
  if (kind === 'socket') return 'socket.height'
  return null
}

/** The fixture's outline on its wall. What the reference height means depends on the kind (see WallFixture). */
export function fixtureBox(fixture: WallFixture): ElevationBox {
  const half = fixtureHalfSpanMm(fixture)
  const height = fixture.referenceHeight.valueMm
  const thickness = (fixture.diameter?.valueMm ?? 35) / 2
  const sides = { startMm: fixture.offset.valueMm - half, endMm: fixture.offset.valueMm + half }
  switch (fixture.kind) {
    case 'grab-bar-vertical': return { ...sides, bottomMm: height, topMm: height + fixture.length.valueMm }
    case 'grab-bar-horizontal':
    case 'grab-bar-fold-down': return { ...sides, bottomMm: height - thickness, topMm: height + thickness }
    case 'shelf': return { ...sides, bottomMm: height - 30, topMm: height }
    case 'basin': return { ...sides, bottomMm: height - 160, topMm: height }
    default: return { ...sides, bottomMm: height - 60, topMm: height + 60 }
  }
}

/**
 * Why a fixture may not sit where it is, or null when it is fine.
 * Switches and sockets cannot be placed over a door or window.
 */
export function fixturePositionProblem(fixture: WallFixture, room: RoomSpace): 'outside-wall' | 'over-opening' | null {
  if (!fixtureFitsWall(fixture, room) || fixtureBox(fixture).bottomMm < 0) return 'outside-wall'
  if (fixture.kind === 'switch' || fixture.kind === 'socket') {
    const box = fixtureBox(fixture)
    const blocked = room.openings.some((opening) => opening.wall === fixture.wall
      && box.startMm < opening.offset.valueMm + opening.width.valueMm && box.endMm > opening.offset.valueMm
      && box.bottomMm < opening.sill.valueMm + opening.height.valueMm && box.topMm > opening.sill.valueMm)
    if (blocked) return 'over-opening'
  }
  return null
}

/**
 * The view of one wall from inside the room. The horizontal axis follows the offset convention
 * used for openings and fixtures: west to east on the north and south walls, north to south
 * on the east and west walls.
 */
export function buildElevation(room: RoomSpace, wall: Wall, resident: ResidentProfile, selectedFixtureId: string | null, context: BenchmarkContext, dataset?: BenchmarkDataset): ElevationModel {
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  const silhouettes = room.items.flatMap((item) => {
    const footprint = getFootprint(item)
    const distance = wall === 'north' ? footprint.minY : wall === 'south' ? depth - footprint.maxY : wall === 'west' ? footprint.minX : width - footprint.maxX
    if (distance > SILHOUETTE_DISTANCE_MM || item.obstruction === 'rug') return []
    const along = wall === 'north' || wall === 'south' ? { startMm: footprint.minX, endMm: footprint.maxX } : { startMm: footprint.minY, endMm: footprint.maxY }
    const startMm = along.startMm
    const endMm = along.endMm
    const clippedStartMm = Math.max(0, startMm)
    const clippedEndMm = Math.min(wallLengthMm(room, wall), endMm)
    return [{
      id: item.id, label: item.label, ...along, bottomMm: 0, topMm: item.height.valueMm,
      drawing: {
        canvas: { startMm, endMm, centerMm: (startMm + endMm) / 2 },
        export: { startMm: clippedStartMm, endMm: clippedEndMm, centerMm: (clippedStartMm + clippedEndMm) / 2, visible: clippedEndMm > clippedStartMm },
      },
    }]
  })
  const selected = room.fixtures.find((fixture) => fixture.id === selectedFixtureId && fixture.wall === wall)
  const key = selected ? fixtureHeightKey(selected.kind) : null
  const values = key ? getBenchmarkValues(key, context, dataset) : null
  const benchmarkBands = key && values ? BENCHMARK_IDS.flatMap((benchmarkId) => {
    const value = values[benchmarkId]
    if (!hasValue(value) || value.minMm === undefined || value.maxMm === undefined) return []
    const lowMm = Math.max(0, Math.min(room.height.valueMm, value.minMm))
    const highMm = Math.max(0, Math.min(room.height.valueMm, value.maxMm))
    const index = BENCHMARK_IDS.indexOf(benchmarkId)
    return [{
      benchmarkId, key, clause: value.clause, minMm: value.minMm, maxMm: value.maxMm, pendingReview: value.review.status === 'pending',
      drawing: {
        canvas: { lowMm: value.minMm, highMm: value.maxMm, rectHeightMm: Math.max(value.maxMm - value.minMm, 6), labelYmm: value.maxMm, labelOffsetMm: 30 + index * 100 },
        export: { lowMm, highMm, rectHeightMm: Math.max(highMm - lowMm, 6), labelYmm: Math.max(210, 120 + room.height.valueMm - highMm - 25 - index * 100), visible: highMm > lowMm },
      },
    }]
  }) : []
  const canvasTicks = Array.from({ length: Math.floor(room.height.valueMm / 500) + 1 }, (_, index) => index * 500)
  const exportTicks = [...canvasTicks]
  if (exportTicks[exportTicks.length - 1] !== room.height.valueMm) exportTicks.push(room.height.valueMm)
  const reachBand = resident.reach ? {
    lowMm: resident.reach.low.valueMm,
    highMm: resident.reach.high.valueMm,
    posture: resident.reach.posture,
    drawing: {
      canvas: { lowMm: resident.reach.low.valueMm, highMm: resident.reach.high.valueMm },
      export: {
        lowMm: Math.max(0, Math.min(room.height.valueMm, resident.reach.low.valueMm)),
        highMm: Math.max(0, Math.min(room.height.valueMm, resident.reach.high.valueMm)),
        labelYmm: Math.max(210, 120 + room.height.valueMm - Math.max(0, Math.min(room.height.valueMm, resident.reach.high.valueMm)) + 100),
        visible: Math.max(0, Math.min(room.height.valueMm, resident.reach.high.valueMm)) > Math.max(0, Math.min(room.height.valueMm, resident.reach.low.valueMm)),
      },
    },
  } : null
  const withCheckGeometry = <T extends ElevationBox>(box: T) => ({
    ...box,
    checkOutline: { startMm: box.startMm - 24, endMm: box.endMm + 24, bottomMm: box.bottomMm - 24, topMm: box.topMm + 24 },
    badgePoint: { alongMm: box.endMm, heightMm: box.topMm },
  })
  return {
    wall, lengthMm: wallLengthMm(room, wall), heightMm: room.height.valueMm,
    openings: room.openings.filter((opening) => opening.wall === wall).map((opening) => withCheckGeometry({
      id: opening.id, kind: opening.kind, startMm: opening.offset.valueMm, endMm: opening.offset.valueMm + opening.width.valueMm,
      bottomMm: opening.sill.valueMm, topMm: opening.sill.valueMm + opening.height.valueMm,
    })),
    fixtures: room.fixtures.filter((fixture) => fixture.wall === wall).map((fixture) => withCheckGeometry({ id: fixture.id, kind: fixture.kind, label: fixture.label, referenceHeightMm: fixture.referenceHeight.valueMm, ...fixtureBox(fixture) })),
    silhouettes,
    reachBand,
    benchmarkBands,
    ticks: { canvas: canvasTicks, export: exportTicks },
  }
}
