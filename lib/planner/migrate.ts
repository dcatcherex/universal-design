import { emptyResident } from './fixtures'
import { validateProject } from './schema'
import { matchProvinceCode } from './standards/provinces'
import type { Project, Result } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any -- this module reads untyped saved data and validates the result */

function failure(code: string, messageKey: string, paths: string[] = []): Result<Project> {
  return { ok: false, error: { code, messageKey, paths } }
}

/** v1 recorded that an advisor verified a value but not how. v2 needs a method, so those become 'unspecified'. */
function markUnspecifiedVerification(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(markUnspecifiedVerification); return }
  if (typeof value !== 'object' || value === null) return
  const record = value as Record<string, unknown>
  if (record.confidence === 'advisor-verified' && typeof record.valueMm === 'number' && record.verificationMethod === undefined) record.verificationMethod = 'unspecified'
  Object.values(record).forEach(markUnspecifiedVerification)
}

/** One v1 layout (a single living room) becomes one floor holding one room. Coordinates are unchanged. */
function migrateLayoutV1(layout: any) {
  return {
    floors: [{
      id: 'floor-1', label: '', level: 0,
      rooms: [{
        id: 'room-1', type: 'living', label: '', origin: { xMm: 0, yMm: 0 },
        shape: { kind: 'rect', width: layout.room.width, depth: layout.room.depth },
        height: layout.room.height,
        floor: { finish: 'unknown', slipResistance: 'unknown', confidence: 'estimated' },
        openings: layout.openings.map((opening: any) => opening.kind === 'door' ? { ...opening, handle: null, connectsToRoomId: null } : opening),
        items: layout.items.map((item: any) => ({ ...item, seatHeight: null })),
        fixtures: [], wetZones: [],
      }],
      routes: layout.routes, turningAreas: layout.turningAreas,
    }],
  }
}

function migrateV1(input: any): unknown {
  const v1 = structuredClone(input)
  const province = typeof v1.household?.province === 'string' ? v1.household.province : ''
  const next = {
    schemaVersion: 2, id: v1.id, title: v1.title, createdAt: v1.createdAt, updatedAt: v1.updatedAt, revision: v1.revision,
    household: { ...v1.household, provinceCode: matchProvinceCode(province) },
    resident: emptyResident(),
    current: migrateLayoutV1(v1.current),
    proposed: v1.proposed ? migrateLayoutV1(v1.proposed) : null,
    benchmarkPolicy: null,
    targets: v1.targets,
    recommendations: v1.recommendations,
    // The old review covered checks without benchmarks, so it is kept as a record but can never be current.
    review: v1.review ? { ...v1.review, benchmarkDatasetVersion: 'none' } : null,
    report: { includeFallHistory: false },
  }
  markUnspecifiedVerification(next)
  return next
}

/**
 * Accepts a v1 or v2 project from storage or a file and returns a validated v2 project.
 * Pure: the input is never changed, and nothing is written anywhere.
 */
export function migrateProject(input: unknown): Result<Project> {
  if (typeof input !== 'object' || input === null || !('schemaVersion' in input)) return failure('invalid-project', 'validation.invalidProject', ['schemaVersion'])
  const version = (input as { schemaVersion: unknown }).schemaVersion
  if (version === 2) return validateProject(input)
  if (typeof version === 'number' && version > 2) return failure('future-version', 'project.futureVersion', ['schemaVersion'])
  if (version !== 1) return failure('invalid-project', 'validation.invalidProject', ['schemaVersion'])
  let migrated: unknown
  try {
    migrated = migrateV1(input)
  } catch {
    return failure('invalid-project', 'validation.invalidProject', ['schemaVersion'])
  }
  return validateProject(migrated)
}
