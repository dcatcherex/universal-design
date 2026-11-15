import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Material,
} from 'three'
import { resolveCatalogEntry } from '../catalog'
import type { FurnitureItem } from '../types'

const finishes = {
  oak: { wood: 0xa87b4f, fabric: 0x839d88, accent: 0xc5a77e },
  cream: { wood: 0xb49979, fabric: 0xe6dbc7, accent: 0xc9b89a },
  sage: { wood: 0x758875, fabric: 0x91a995, accent: 0xb6c2a9 },
  charcoal: { wood: 0x4b4d48, fabric: 0x74756f, accent: 0x98978e },
} as const

function box(group: Group, name: string, dimensions: [number, number, number], position: [number, number, number], material: Material) {
  const mesh = new Mesh(new BoxGeometry(...dimensions), material)
  mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.itemId = group.userData.itemId
  group.add(mesh)
  return mesh
}

function cylinder(group: Group, name: string, radiusTop: number, radiusBottom: number, height: number, position: [number, number, number], material: Material, radialSegments = 12) {
  const mesh = new Mesh(new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material)
  mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.itemId = group.userData.itemId
  group.add(mesh)
  return mesh
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

  const finish = finishes[item.finish]
  const wood = new MeshStandardMaterial({ color: finish.wood, roughness: 0.78 })
  const fabric = new MeshStandardMaterial({ color: finish.fabric, roughness: 0.94 })
  const accent = new MeshStandardMaterial({ color: finish.accent, roughness: 0.82 })
  const dark = new MeshStandardMaterial({ color: 0x51483e, roughness: 0.8 })
  const materials = [wood, fabric, accent, dark]

  const baseY = Math.min(0.07, height * 0.14)
  switch (catalog.meshKind) {
    case 'sofa': {
      const arm = Math.min(width * 0.1, 0.24)
      const back = Math.min(depth * 0.19, height * 0.26)
      box(group, 'sofa-seat-base', [width - arm * 2, Math.max(0.08, height * 0.22), depth * 0.7], [0, height * 0.29, depth * 0.1], wood)
      box(group, 'sofa-cushion', [width - arm * 2.3, height * 0.2, depth * 0.57], [0, height * 0.49, depth * 0.15], fabric)
      box(group, 'sofa-back', [width, Math.max(0.09, height - height * 0.49), back], [0, height * 0.745, -depth / 2 + back / 2], fabric)
      box(group, 'sofa-arm-left', [arm, height * 0.47, depth], [-width / 2 + arm / 2, height * 0.4, 0], accent)
      box(group, 'sofa-arm-right', [arm, height * 0.47, depth], [width / 2 - arm / 2, height * 0.4, 0], accent)
      for (const x of [-width * 0.32, width * 0.32]) for (const z of [-depth * 0.34, depth * 0.34]) {
        box(group, 'sofa-foot', [0.045, baseY, 0.045], [x, baseY / 2, z], dark)
      }
      break
    }
    case 'chair': {
      const leg = Math.max(0.035, Math.min(width, depth) * 0.07)
      const seatY = Math.min(height * 0.46, Math.max(0.35, height * 0.48))
      for (const x of [-width * 0.38, width * 0.38]) for (const z of [-depth * 0.38, depth * 0.38]) {
        box(group, 'chair-leg', [leg, seatY, leg], [x, seatY / 2, z], wood)
      }
      box(group, 'chair-seat', [width * 0.92, Math.max(0.08, height * 0.12), depth * 0.92], [0, seatY, 0], fabric)
      box(group, 'chair-back', [width * 0.88, Math.max(0.1, height - seatY), depth * 0.12], [0, (height + seatY) / 2, -depth * 0.4], accent)
      break
    }
    case 'table': {
      const leg = Math.max(0.035, Math.min(width, depth) * 0.07)
      const topHeight = Math.min(0.08, height * 0.18)
      box(group, 'table-top', [width, topHeight, depth], [0, height - topHeight / 2, 0], wood)
      for (const x of [-width * 0.4, width * 0.4]) for (const z of [-depth * 0.38, depth * 0.38]) {
        box(group, 'table-leg', [leg, height - topHeight, leg], [x, (height - topHeight) / 2, z], accent)
      }
      break
    }
    case 'cabinet':
      box(group, 'cabinet-body', [width, height * 0.86, depth], [0, height * 0.57, 0], wood)
      box(group, 'cabinet-top', [width, height * 0.06, depth], [0, height * 0.96, 0], accent)
      for (const x of [-width * 0.18, width * 0.18]) cylinder(group, 'cabinet-handle', 0.012, 0.012, 0.02, [x, height * 0.56, depth / 2 - 0.01], dark, 8).rotation.x = Math.PI / 2
      break
    case 'lamp': {
      const radius = Math.min(width, depth) * 0.42
      cylinder(group, 'lamp-base', radius, radius * 1.1, Math.min(0.06, height * 0.08), [0, Math.min(0.06, height * 0.08) / 2, 0], wood)
      const stemTop = height * 0.8
      cylinder(group, 'lamp-stem', 0.014, 0.022, Math.max(0.04, stemTop - 0.06), [0, (stemTop + 0.06) / 2, 0], dark, 10)
      cylinder(group, 'lamp-shade', radius * 0.5, radius, height - stemTop, [0, stemTop + (height - stemTop) / 2, 0], accent, 16)
      break
    }
    case 'rug':
      box(group, 'rug-pad', [width, Math.max(0.005, height), depth], [0, Math.max(0.005, height) / 2, 0], fabric)
      box(group, 'rug-border', [width * 0.92, Math.max(0.001, height * 0.2), depth * 0.92], [0, Math.max(0.005, height) * 0.9, 0], accent)
      break
    default:
      box(group, 'custom-block', [width, height, depth], [0, height / 2, 0], wood)
  }

  group.userData.ownedMaterials = materials
  return group
}
