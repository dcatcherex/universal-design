'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PCFShadowMap,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/planner/i18n'
import { buildRoomScene } from '@/lib/planner/scene/build-scene'
import { createRoomCamera } from '@/lib/planner/scene/camera'
import type { Layout, Locale } from '@/lib/planner/types'

export type SceneHandle = { capturePng(): Promise<Blob>; resetCamera(): void }

type RoomView3DProps = {
  layout: Layout
  locale: Locale
  selectionId: string | null
  onSelect(id: string | null): void
  onReady(handle: SceneHandle): void
  onUnavailable(reason: string): void
}

function disposeScene(scene: Scene) {
  const geometries = new Set<Object3D & { geometry?: { dispose(): void } }>()
  const materials = new Set<Material>()
  scene.traverse((object) => {
    const mesh = object as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] }
    if (mesh.geometry) geometries.add(mesh)
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material)
  })
  geometries.forEach((object) => object.geometry?.dispose())
  materials.forEach((material) => material.dispose())
}

function markSelection(scene: Scene, selectionId: string | null) {
  scene.traverse((object) => {
    const itemId = object.userData.itemId as string | undefined
    if (!itemId) return
    const material = (object as Object3D & { material?: Material | Material[] }).material
    const values = material ? (Array.isArray(material) ? material : [material]) : []
    for (const value of values) {
      const typed = value as Material & { emissive?: { setHex(value: number): void } }
      if (typed.emissive) typed.emissive.setHex(itemId === selectionId ? 0x51422a : 0x000000)
    }
  })
}

export function RoomView3D({ layout, locale, selectionId, onSelect, onReady, onUnavailable }: RoomView3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<SceneHandle | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const renderRef = useRef<(() => void) | null>(null)
  const [hideNearWalls, setHideNearWalls] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    let scene: Scene | null = null
    let contextLost = false
    let pointerStart: { x: number; y: number } | null = null
    let resizeObserver: ResizeObserver | null = null
    let disposed = false

    try {
      scene = new Scene()
      scene.background = new Color(0xe8e7df)
      sceneRef.current = scene
      scene.add(new AmbientLight(0xfff4df, 1.65))
      const sun = new DirectionalLight(0xffedd2, 2.2)
      sun.position.set(-3, 8, 5)
      sun.castShadow = true
      sun.shadow.mapSize.set(1024, 1024)
      sun.shadow.bias = -0.0003
      sun.shadow.normalBias = 0.02
      scene.add(sun)
      const room = buildRoomScene(layout)
      scene.add(room)

      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = PCFShadowMap
      renderer.outputColorSpace = 'srgb'
      renderer.domElement.setAttribute('aria-label', t(locale, 'sceneCanvas'))
      renderer.domElement.setAttribute('role', 'img')
      renderer.domElement.dataset.testid = 'room-scene-canvas'
      host.appendChild(renderer.domElement)

      const bounds = host.getBoundingClientRect()
      const camera = createRoomCamera(layout.room, Math.max(0.1, bounds.width / Math.max(1, bounds.height)))
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = false
      controls.minDistance = 2
      controls.maxDistance = 24
      controls.maxPolarAngle = Math.PI * 0.49
      controls.target.set(layout.room.width.valueMm / 2000, layout.room.height.valueMm / 2200, layout.room.depth.valueMm / 2000)
      controls.update()
      controls.saveState()

      const render = () => {
        if (!disposed && !contextLost && renderer && scene) renderer.render(scene, camera)
      }
      renderRef.current = render
      controls.addEventListener('change', render)
      render()

      resizeObserver = new ResizeObserver(() => {
        if (!renderer) return
        const rect = host.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        camera.aspect = rect.width / rect.height
        camera.updateProjectionMatrix()
        renderer.setSize(rect.width, rect.height, false)
        render()
      })
      resizeObserver.observe(host)
      const initialRect = host.getBoundingClientRect()
      if (initialRect.width > 0 && initialRect.height > 0) {
        camera.aspect = initialRect.width / initialRect.height
        camera.updateProjectionMatrix()
        renderer.setSize(initialRect.width, initialRect.height, false)
        render()
      }

      const raycaster = new Raycaster()
      const pointer = new Vector2()
      const onPointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY } }
      const onPointerUp = (event: PointerEvent) => {
        if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return
        const rect = renderer!.domElement.getBoundingClientRect()
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const itemObjects: Object3D[] = []
        scene!.traverse((object) => { if (object.userData.itemId && 'isMesh' in object && object.isMesh) itemObjects.push(object) })
        const hit = raycaster.intersectObjects(itemObjects, true)[0]
        let selectedId = hit?.object.userData.itemId as string | undefined
        let selected: Object3D | null = hit?.object ?? null
        while (!selectedId && selected) {
          selectedId = selected.userData.itemId as string | undefined
          selected = selected.parent
        }
        onSelect(selectedId ?? null)
      }
      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      const onContextLost = (event: Event) => {
        event.preventDefault()
        contextLost = true
        onUnavailable('webgl-lost')
      }
      renderer.domElement.addEventListener('webglcontextlost', onContextLost, false)

      const sceneHandle: SceneHandle = {
        capturePng: () => new Promise((resolve, reject) => {
          if (disposed || contextLost || !renderer || !scene) {
            reject(new Error('WebGL renderer is unavailable'))
            return
          }
          try {
            render()
            renderer.domElement.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG capture failed')))
          } catch (error) { reject(error) }
        }),
        resetCamera: () => {
          if (!controls || !renderer) return
          controls.reset()
          render()
        },
      }
      handleRef.current = sceneHandle
      onReady(sceneHandle)

      return () => {
        disposed = true
        resizeObserver?.disconnect()
        renderRef.current = null
        sceneRef.current = null
        controls?.removeEventListener('change', render)
        controls?.dispose()
        renderer?.domElement.removeEventListener('pointerdown', onPointerDown)
        renderer?.domElement.removeEventListener('pointerup', onPointerUp)
        renderer?.domElement.removeEventListener('webglcontextlost', onContextLost)
        renderer?.setAnimationLoop(null)
        if (scene) disposeScene(scene)
        renderer?.dispose()
        renderer?.domElement.remove()
        if (handleRef.current === sceneHandle) handleRef.current = null
      }
    } catch {
      resizeObserver?.disconnect()
      controls?.dispose()
      sceneRef.current = null
      renderRef.current = null
      renderer?.dispose()
      renderer?.domElement.remove()
      if (scene) disposeScene(scene)
      onUnavailable('webgl-unavailable')
      return
    }
  }, [layout, locale, onSelect, onReady, onUnavailable])

  useEffect(() => {
    if (sceneRef.current) {
      markSelection(sceneRef.current, selectionId)
      renderRef.current?.()
    }
  }, [selectionId, layout])

  useEffect(() => {
    if (!sceneRef.current) return
    sceneRef.current.traverse((object) => {
      if (object.name !== 'wall-east' && object.name !== 'wall-south') return
      object.visible = !hideNearWalls
    })
    renderRef.current?.()
  }, [hideNearWalls, layout])

  return <section className="scene-panel" aria-label={t(locale, 'view3d')}>
    <div className="scene-toolbar">
      <span>{t(locale, 'sceneReadOnly')}</span>
      <Button type="button" variant="outline" onClick={() => setHideNearWalls((value) => !value)} aria-pressed={hideNearWalls}>{hideNearWalls ? t(locale, 'showWalls') : t(locale, 'hideWalls')}</Button>
      <Button type="button" variant="outline" onClick={() => handleRef.current?.resetCamera()}>{t(locale, 'resetCamera')}</Button>
    </div>
    <div className="scene-canvas" ref={hostRef} />
  </section>
}
