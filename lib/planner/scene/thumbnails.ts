import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three'
import { buildFurnitureMesh } from './furniture-mesh'
import { thumbnailKey } from './thumbnail-key'
import type { FurnitureItem } from '../types'

// Browser only. Thumbnails are a nicety: every caller must cope with `null`
// (no WebGL, lost context) and fall back to the plain CSS preview.

const SIZE = 240
const cache = new Map<string, string>()
let renderer: WebGLRenderer | null = null
let unavailable = false

function getRenderer(): WebGLRenderer | null {
  if (unavailable) return null
  if (renderer) return renderer
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(SIZE, SIZE, false)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = 'srgb'
    renderer.domElement.addEventListener('webglcontextlost', () => { unavailable = true; renderer = null })
    return renderer
  } catch {
    unavailable = true
    renderer = null
    return null
  }
}

function dispose(object: Object3D) {
  object.traverse((child) => {
    const mesh = child as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] }
    mesh.geometry?.dispose()
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
}

/** Renders one piece of furniture to a transparent PNG data URL, or returns null when WebGL is unavailable. */
export function renderFurnitureThumbnail(item: FurnitureItem): string | null {
  const key = thumbnailKey(item)
  const cached = cache.get(key)
  if (cached) return cached
  const gl = getRenderer()
  if (!gl) return null
  const scene = new Scene()
  try {
    const mesh = buildFurnitureMesh({ ...item, center: { xMm: 0, yMm: 0 }, rotationDeg: 0 })
    scene.add(mesh)
    scene.add(new HemisphereLight(0xffffff, 0xe6d9c3, 2.1))
    const sun = new DirectionalLight(0xfff1dc, 1.9)
    sun.position.set(2, 4, 3)
    scene.add(sun)

    const bounds = new Box3().setFromObject(mesh)
    const center = bounds.getCenter(new Vector3())
    const radius = Math.max(0.05, bounds.getSize(new Vector3()).length() / 2)
    const camera = new PerspectiveCamera(28, 1, 0.01, 100)
    const distance = radius / Math.sin((camera.fov / 2) * Math.PI / 180) * 1.02
    const direction = new Vector3(0.72, 0.55, 1).normalize()
    camera.position.copy(center).addScaledVector(direction, distance)
    camera.lookAt(center)
    gl.render(scene, camera)
    const url = gl.domElement.toDataURL('image/png')
    cache.set(key, url)
    return url
  } catch {
    return null
  } finally {
    dispose(scene)
  }
}
