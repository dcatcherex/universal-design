import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { resolveCatalogEntry } from '../catalog'
import type { FurnitureItem } from '../types'

// Every part must stay inside the item's width × height × depth box, because
// the 2D footprint and the checks use that box. Local axes: x = width,
// y = up from the floor, z = depth with the back of the piece at -depth / 2.

export const FINISH_COLORS = {
  oak: { wood: 0xd8ae7c, fabric: 0xe9dfce, accent: 0x8eab9c },
  cream: { wood: 0xe2c9a4, fabric: 0xf3ecdf, accent: 0xd9c7a8 },
  sage: { wood: 0xd4aa78, fabric: 0x8eab9c, accent: 0xe9dfce },
  charcoal: { wood: 0x6a5a4b, fabric: 0x7d807b, accent: 0xb9b6ad },
} as const

function add(group: Group, name: string, geometry: BufferGeometry, position: [number, number, number], material: Material) {
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.itemId = group.userData.itemId
  group.add(mesh)
  return mesh
}

function box(group: Group, name: string, dimensions: [number, number, number], position: [number, number, number], material: Material) {
  return add(group, name, new BoxGeometry(...dimensions), position, material)
}

/** A box with softened edges. Outer dimensions are unchanged by the rounding. */
function soft(group: Group, name: string, dimensions: [number, number, number], position: [number, number, number], material: Material, radius = 0.03) {
  const safeRadius = Math.max(0.001, Math.min(radius, Math.min(...dimensions) / 2 - 0.0005))
  return add(group, name, new RoundedBoxGeometry(dimensions[0], dimensions[1], dimensions[2], 3, safeRadius), position, material)
}

function cylinder(group: Group, name: string, radiusTop: number, radiusBottom: number, height: number, position: [number, number, number], material: Material, radialSegments = 24) {
  return add(group, name, new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), position, material)
}

function legs(group: Group, name: string, halfX: number, halfZ: number, height: number, radius: number, material: Material) {
  for (const x of [-halfX, halfX]) for (const z of [-halfZ, halfZ]) {
    cylinder(group, name, radius, radius * 0.7, height, [x, height / 2, z], material, 12)
  }
}

export function buildFurnitureMesh(item: FurnitureItem): Group {
  const catalog = resolveCatalogEntry(item.catalogId)
  const width = item.width.valueMm / 1000
  const depth = item.depth.valueMm / 1000
  const height = item.height.valueMm / 1000
  const group = new Group()
  group.name = `furniture-${item.id}`
  group.userData.itemId = item.id
  group.position.set(item.center.xMm / 1000, 0, item.center.yMm / 1000)
  group.rotation.y = -item.rotationDeg * Math.PI / 180

  const finish = FINISH_COLORS[item.finish]
  const wood = new MeshStandardMaterial({ color: finish.wood, roughness: 0.62 })
  const fabric = new MeshStandardMaterial({ color: finish.fabric, roughness: 0.96 })
  const accent = new MeshStandardMaterial({ color: finish.accent, roughness: 0.92 })
  const dark = new MeshStandardMaterial({ color: 0x3f3a34, roughness: 0.7 })
  const ceramic = new MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.35 })
  const materials: Material[] = [wood, fabric, accent, dark]

  switch (catalog.meshKind) {
    case 'sofa': {
      const legH = Math.min(0.1, height * 0.12)
      const arm = Math.min(width * 0.09, 0.2)
      const backT = Math.min(depth * 0.2, 0.2)
      const baseH = height * 0.2
      const cushionH = height * 0.17
      const seatTop = legH + baseH + cushionH
      const inner = width - arm * 2
      const seats = width > 1.6 ? 3 : width > 1.1 ? 2 : 1
      const gap = 0.012
      const seatDepth = depth - backT - 0.01
      legs(group, 'sofa-foot', width / 2 - 0.07, depth / 2 - 0.07, legH, 0.025, dark)
      soft(group, 'sofa-base', [width, baseH, depth], [0, legH + baseH / 2, 0], fabric, 0.03)
      soft(group, 'sofa-back', [inner, height - legH - baseH, backT], [0, (height + legH + baseH) / 2, -depth / 2 + backT / 2], fabric, 0.05)
      for (const side of [-1, 1]) {
        soft(group, 'sofa-arm', [arm, height * 0.66 - legH, depth], [side * (width / 2 - arm / 2), (height * 0.66 + legH) / 2, 0], fabric, 0.05)
      }
      const cushionW = inner / seats - gap
      const backCushionH = Math.min(height - seatTop - 0.02, height * 0.36)
      const backCushionT = Math.min(0.15, seatDepth * 0.24)
      for (let i = 0; i < seats; i++) {
        const x = -inner / 2 + (inner / seats) * (i + 0.5)
        soft(group, 'sofa-cushion', [cushionW, cushionH, seatDepth], [x, seatTop - cushionH / 2, depth / 2 - seatDepth / 2], fabric, 0.045)
        soft(group, 'sofa-back-cushion', [cushionW - 0.02, backCushionH, backCushionT], [x, seatTop + backCushionH / 2, -depth / 2 + backT + backCushionT / 2], fabric, 0.06)
      }
      const pillow = Math.min(0.34, cushionW * 0.6, backCushionH)
      soft(group, 'sofa-pillow', [pillow, pillow, 0.1], [-inner / 2 + pillow / 2 + 0.03, seatTop + pillow / 2, -depth / 2 + backT + backCushionT + 0.06], accent, 0.045)
      break
    }
    case 'chair': {
      if (width >= 0.7) {
        // Upholstered armchair.
        const legH = Math.min(0.14, height * 0.16)
        const arm = Math.min(0.14, width * 0.17)
        const backT = Math.min(0.18, depth * 0.22)
        const baseH = height * 0.2
        const cushionH = height * 0.14
        const seatTop = legH + baseH + cushionH
        const inner = width - arm * 2
        legs(group, 'chair-leg', width / 2 - 0.08, depth / 2 - 0.08, legH, 0.024, wood)
        soft(group, 'chair-base', [width, baseH, depth], [0, legH + baseH / 2, 0], fabric, 0.04)
        soft(group, 'chair-back', [width, height - legH - baseH, backT], [0, (height + legH + baseH) / 2, -depth / 2 + backT / 2], fabric, 0.07)
        for (const side of [-1, 1]) {
          soft(group, 'chair-arm', [arm, height * 0.68 - legH, depth - backT * 0.5], [side * (width / 2 - arm / 2), (height * 0.68 + legH) / 2, backT * 0.25], fabric, 0.055)
        }
        soft(group, 'chair-cushion', [inner - 0.01, cushionH, depth - backT - 0.01], [0, seatTop - cushionH / 2, backT / 2], fabric, 0.045)
        const pillow = Math.min(0.3, inner * 0.6, height - seatTop - 0.02)
        soft(group, 'chair-pillow', [pillow, pillow, 0.1], [0, seatTop + pillow / 2, -depth / 2 + backT + 0.06], accent, 0.045)
      } else {
        // Wooden dining chair with a seat pad and a slatted back.
        const post = Math.max(0.03, Math.min(width, depth) * 0.07)
        const seatY = Math.min(0.46, height * 0.54)
        const seatT = 0.035
        const inset = post / 2
        for (const x of [-width / 2 + inset, width / 2 - inset]) {
          box(group, 'chair-leg', [post, seatY - seatT, post], [x, (seatY - seatT) / 2, depth / 2 - inset], wood)
          box(group, 'chair-back-post', [post, height, post], [x, height / 2, -depth / 2 + inset], wood)
        }
        soft(group, 'chair-seat', [width, seatT, depth], [0, seatY - seatT / 2, 0], wood, 0.012)
        soft(group, 'chair-pad', [width - post * 2.4, 0.03, depth - post * 2.4], [0, seatY + 0.015, post * 0.3], fabric, 0.012)
        const slatH = Math.min(0.09, (height - seatY) * 0.22)
        for (const y of [height - slatH / 2, seatY + (height - seatY) * 0.5]) {
          box(group, 'chair-slat', [width - post * 2, slatH, post * 0.6], [0, y, -depth / 2 + inset], wood)
        }
      }
      break
    }
    case 'table': {
      const topT = Math.min(0.045, height * 0.12)
      if (width <= 0.6 && Math.abs(width - depth) < 0.05) {
        // Small round pedestal table.
        const radius = Math.min(width, depth) / 2
        cylinder(group, 'table-top', radius, radius, topT, [0, height - topT / 2, 0], wood, 48)
        cylinder(group, 'table-stem', radius * 0.2, radius * 0.34, height - topT - 0.03, [0, 0.03 + (height - topT - 0.03) / 2, 0], wood, 24)
        cylinder(group, 'table-foot', radius * 0.62, radius * 0.66, 0.03, [0, 0.015, 0], wood, 32)
      } else {
        const leg = Math.max(0.022, Math.min(0.035, Math.min(width, depth) * 0.05))
        const inset = leg + 0.03
        const apronH = Math.min(0.07, (height - topT) * 0.2)
        soft(group, 'table-top', [width, topT, depth], [0, height - topT / 2, 0], wood, 0.015)
        for (const x of [-width / 2 + inset, width / 2 - inset]) for (const z of [-depth / 2 + inset, depth / 2 - inset]) {
          cylinder(group, 'table-leg', leg, leg * 0.72, height - topT, [x, (height - topT) / 2, z], wood, 14)
        }
        box(group, 'table-apron', [width - inset * 2, apronH, 0.02], [0, height - topT - apronH / 2, -depth / 2 + inset], wood)
        box(group, 'table-apron', [width - inset * 2, apronH, 0.02], [0, height - topT - apronH / 2, depth / 2 - inset], wood)
        box(group, 'table-apron', [0.02, apronH, depth - inset * 2], [-width / 2 + inset, height - topT - apronH / 2, 0], wood)
        box(group, 'table-apron', [0.02, apronH, depth - inset * 2], [width / 2 - inset, height - topT - apronH / 2, 0], wood)
      }
      break
    }
    case 'cabinet': {
      const legH = Math.min(0.12, height * 0.14)
      const topT = 0.025
      const doorT = 0.018
      const handleT = 0.008
      const bodyDepth = depth - doorT - handleT
      legs(group, 'cabinet-leg', width / 2 - 0.06, depth / 2 - 0.06, legH, 0.02, wood)
      box(group, 'cabinet-body', [width - 0.02, height - legH - topT, bodyDepth], [0, legH + (height - legH - topT) / 2, -(doorT + handleT) / 2], wood)
      soft(group, 'cabinet-top', [width, topT, depth], [0, height - topT / 2, 0], wood, 0.01)
      const doors = width > 0.9 ? 2 : 1
      const doorW = (width - 0.03) / doors - 0.008
      const doorH = height - legH - topT - 0.016
      for (let i = 0; i < doors; i++) {
        const x = -(width - 0.03) / 2 + ((width - 0.03) / doors) * (i + 0.5)
        soft(group, 'cabinet-door', [doorW, doorH, doorT], [x, legH + 0.008 + doorH / 2, depth / 2 - handleT - doorT / 2], wood, 0.006)
        const handleX = doors === 2 ? x + (i === 0 ? 1 : -1) * (doorW / 2 - 0.035) : x + doorW / 2 - 0.035
        box(group, 'cabinet-handle', [0.012, Math.min(0.12, doorH * 0.3), handleT], [handleX, legH + doorH * 0.62, depth / 2 - handleT / 2], dark)
      }
      break
    }
    case 'lamp': {
      const radius = Math.min(width, depth) / 2
      const baseH = Math.min(0.03, height * 0.04)
      const shadeH = Math.min(height * 0.2, radius * 1.5)
      const stemTop = height - shadeH * 0.5
      cylinder(group, 'lamp-base', radius * 0.72, radius * 0.76, baseH, [0, baseH / 2, 0], dark, 32)
      cylinder(group, 'lamp-stem', 0.011, 0.011, stemTop - baseH, [0, (stemTop + baseH) / 2, 0], dark, 10)
      cylinder(group, 'lamp-shade', radius * 0.68, radius, shadeH, [0, height - shadeH / 2, 0], accent, 32)
      break
    }
    case 'rug': {
      const thickness = Math.max(0.005, height)
      box(group, 'rug-pad', [width, thickness * 0.7, depth], [0, thickness * 0.35, 0], accent)
      box(group, 'rug-field', [width - 0.16, thickness * 0.3, depth - 0.16], [0, thickness * 0.85, 0], fabric)
      break
    }
    case 'toilet': {
      // Cistern against the back, bowl in front. The seat is drawn at the recorded seat height.
      const seatTop = Math.min(height * 0.9, (item.seatHeight?.valueMm ?? item.height.valueMm * 0.54) / 1000)
      const tankDepth = depth * 0.26
      const seatT = Math.min(0.04, seatTop * 0.2)
      soft(group, 'toilet-tank', [width * 0.92, height - seatTop * 0.55, tankDepth], [0, (height + seatTop * 0.55) / 2, -depth / 2 + tankDepth / 2], ceramic, 0.03)
      soft(group, 'toilet-pedestal', [width * 0.62, seatTop - seatT, depth * 0.6], [0, (seatTop - seatT) / 2, -depth / 2 + tankDepth + depth * 0.3 - 0.01], ceramic, 0.06)
      soft(group, 'toilet-seat', [width, seatT, depth - tankDepth], [0, seatTop - seatT / 2, depth / 2 - (depth - tankDepth) / 2], ceramic, Math.min(0.018, seatT / 2.2))
      materials.push(ceramic)
      break
    }
    case 'squat-toilet': {
      const rim = Math.min(0.05, height * 0.4)
      soft(group, 'squat-base', [width, height - rim, depth], [0, (height - rim) / 2, 0], ceramic, 0.02)
      for (const side of [-1, 1]) soft(group, 'squat-footrest', [width * 0.24, rim, depth * 0.62], [side * width * 0.3, height - rim / 2, depth * 0.08], ceramic, 0.012)
      box(group, 'squat-bowl', [width * 0.3, 0.004, depth * 0.66], [0, height - rim + 0.002, depth * 0.06], dark)
      materials.push(ceramic)
      break
    }
    case 'stool': {
      const seatT = Math.min(0.045, height * 0.12)
      legs(group, 'stool-leg', width / 2 - 0.05, depth / 2 - 0.05, height - seatT, 0.016, dark)
      soft(group, 'stool-seat', [width, seatT, depth], [0, height - seatT / 2, 0], ceramic, 0.018)
      materials.push(ceramic)
      break
    }
    case 'jar': {
      const radius = Math.min(width, depth) / 2
      const clay = new MeshStandardMaterial({ color: 0x9c6b4d, roughness: 0.85 })
      const water = new MeshStandardMaterial({ color: 0x6f9db5, roughness: 0.25 })
      materials.push(clay, water)
      cylinder(group, 'jar-lower', radius, radius * 0.62, height * 0.55, [0, height * 0.275, 0], clay, 32)
      cylinder(group, 'jar-upper', radius * 0.74, radius, height * 0.45, [0, height * 0.775, 0], clay, 32)
      cylinder(group, 'jar-water', radius * 0.66, radius * 0.66, 0.004, [0, height - 0.002, 0], water, 32)
      break
    }
    default:
      soft(group, 'custom-block', [width, height, depth], [0, height / 2, 0], wood, 0.02)
  }

  group.userData.ownedMaterials = materials
  return group
}
