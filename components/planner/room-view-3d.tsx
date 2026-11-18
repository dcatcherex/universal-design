'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Button } from '@/components/ui/button'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { buildRoomScene, toRoomPoint } from '@/lib/planner/scene/build-scene'
import { createRoomCamera } from '@/lib/planner/scene/camera'
import { snapToGridMm } from '@/lib/planner/entity-movement'
import type { EntityCheckStatus } from '@/lib/planner/checks'
import { getPrimaryRoom } from '@/lib/planner/layout-access'
import type { Layout, Locale } from '@/lib/planner/types'

export type SceneHandle = { capturePng(): Promise<Blob>; resetCamera(): void }

type FurnitureDrag = {
  id: string
  group: Object3D
  start: { x: number; z: number }
  center: { xMm: number; yMm: number }
  offset: { x: number; z: number }
  started: boolean
}
type PointerGesture = {
  x: number
  y: number
  pointerId: number
  itemId: string | null
  drag: FurnitureDrag | null
}

type RoomView3DProps = {
  layout: Layout
  locale: Locale
  selectionId: string | null
  editable: boolean
  checkStatuses: ReadonlyMap<string, EntityCheckStatus>
  showCheckMarks: boolean
  onSelect(id: string | null): void
  onMoveItem(id: string, center: { xMm: number; yMm: number }): MessageKey | null
  onReady(handle: SceneHandle): void
  onUnavailable(reason: string): void
}

function disposeScene(scene: Object3D) {
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

function markSceneEntities(scene: Scene, selectionId: string | null, checkStatuses: ReadonlyMap<string, EntityCheckStatus>, showCheckMarks: boolean) {
  scene.traverse((object) => {
    const entityId = (object.userData.itemId ?? object.userData.openingId) as string | undefined
    if (!entityId) return
    const status = showCheckMarks ? checkStatuses.get(entityId)?.status : undefined
    const material = (object as Object3D & { material?: Material | Material[] }).material
    const values = material ? (Array.isArray(material) ? material : [material]) : []
    for (const value of values) {
      const typed = value as Material & { emissive?: { setHex(value: number): void }; wireframe?: boolean }
      typed.wireframe = status === 'not-evaluated'
      if (typed.emissive) typed.emissive.setHex(status === 'attention' ? 0x8e2f21 : status === 'not-evaluated' ? 0x175d91 : entityId === selectionId ? 0x51422a : 0x000000)
    }
  })
}

/** The default camera looks in from the south-east, so those two walls are the ones in the way. */
function applyNearWallVisibility(scene: Scene, hidden: boolean) {
  scene.traverse((object) => {
    const near = object.name === 'wall-east' || object.name === 'wall-south' || object.userData.wall === 'east' || object.userData.wall === 'south'
    if (near) object.visible = !hidden
  })
}

export function RoomView3D({ layout, locale, selectionId, editable, checkStatuses, showCheckMarks, onSelect, onMoveItem, onReady, onUnavailable }: RoomView3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<SceneHandle | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const renderRef = useRef<(() => void) | null>(null)
  const layoutRef = useRef(layout)
  const renderedLayoutRef = useRef(layout)
  const dragActiveRef = useRef(false)
  const selectionIdRef = useRef(selectionId)
  const editableRef = useRef(editable)
  const moveItemRef = useRef(onMoveItem)
  const [hideNearWalls, setHideNearWalls] = useState(true)
  const hideNearWallsRef = useRef(hideNearWalls)
  const [dragRevision, setDragRevision] = useState(0)
  const [moveError, setMoveError] = useState<MessageKey | null>(null)
  const attentionCount = showCheckMarks ? [...checkStatuses.values()].filter((status) => status.status === 'attention').length : 0
  const pendingCount = showCheckMarks ? [...checkStatuses.values()].filter((status) => status.status === 'not-evaluated').length : 0

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    selectionIdRef.current = selectionId
    editableRef.current = editable
    moveItemRef.current = onMoveItem
  }, [selectionId, editable, onMoveItem])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    let scene: Scene | null = null
    let contextLost = false
    let pointerStart: PointerGesture | null = null
    let resizeObserver: ResizeObserver | null = null
    let disposed = false

    try {
      const initialLayout = layoutRef.current
      scene = new Scene()
      scene.background = new Color(0xe9e9e3)
      sceneRef.current = scene
      const space = getPrimaryRoom(initialLayout)
      const roomWidth = space.shape.width.valueMm / 1000
      const roomDepth = space.shape.depth.valueMm / 1000
      const roomHeight = space.height.valueMm / 1000
      scene.add(new HemisphereLight(0xffffff, 0xf0e9dd, 1.55))
      // The sun comes from the open (camera) side so the cutaway room is lit and shadows fall toward the back walls.
      const sun = new DirectionalLight(0xfff1dc, 2.5)
      const reach = Math.max(roomWidth, roomDepth)
      sun.position.set(roomWidth / 2 + reach * 0.5, roomHeight + reach * 0.9, roomDepth / 2 + reach * 0.75)
      sun.target.position.set(roomWidth / 2, 0, roomDepth / 2)
      sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048)
      sun.shadow.camera.left = -reach
      sun.shadow.camera.right = reach
      sun.shadow.camera.top = reach
      sun.shadow.camera.bottom = -reach
      sun.shadow.camera.near = 0.5
      sun.shadow.camera.far = reach * 4 + roomHeight
      sun.shadow.camera.updateProjectionMatrix()
      sun.shadow.bias = -0.0004
      sun.shadow.normalBias = 0.03
      scene.add(sun)
      scene.add(sun.target)
      const room = buildRoomScene(initialLayout)
      scene.add(room)
      applyNearWallVisibility(scene, hideNearWallsRef.current)

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
      const camera = createRoomCamera(space, Math.max(0.1, bounds.width / Math.max(1, bounds.height)))
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = false
      controls.minDistance = 2
      controls.maxDistance = 24
      controls.maxPolarAngle = Math.PI * 0.49
      controls.target.set(roomWidth / 2, space.height.valueMm / 2200, roomDepth / 2)
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
      const floorPlane = new Plane(new Vector3(0, 1, 0), 0)
      const floorPoint = new Vector3()
      const setPointerRay = (event: PointerEvent) => {
        const rect = renderer!.domElement.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return false
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        return true
      }
      const findEntityHit = () => {
        const itemObjects: Object3D[] = []
        scene!.traverse((object) => { if (object.userData.itemId && 'isMesh' in object && object.isMesh) itemObjects.push(object) })
        const hit = raycaster.intersectObjects(itemObjects, true)[0]
        let current: Object3D | null = hit?.object ?? null
        let itemId: string | undefined
        let furniture: Object3D | null = null
        while (current) {
          itemId ??= current.userData.itemId as string | undefined
          if (current.name.startsWith('furniture-')) furniture = current
          current = current.parent
        }
        return { itemId, furniture }
      }
      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return
        if (!setPointerRay(event)) return
        const { itemId, furniture: group } = findEntityHit()
        const gesture: PointerGesture = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, itemId: itemId ?? null, drag: null }
        pointerStart = gesture
        setMoveError(null)
        if (!itemId) return

        onSelect(itemId)
        if (!group) return
        const mayDrag = editableRef.current && (event.pointerType !== 'touch' || selectionIdRef.current === itemId)
        if (!mayDrag || !raycaster.ray.intersectPlane(floorPlane, floorPoint)) return

        const start = { x: group.position.x, z: group.position.z }
        gesture.drag = {
          id: itemId,
          group,
          start,
          center: toRoomPoint(start),
          offset: { x: start.x - floorPoint.x, z: start.z - floorPoint.z },
          started: false,
        }
        dragActiveRef.current = true
        controls!.enabled = false
        try { renderer!.domElement.setPointerCapture(event.pointerId) } catch { /* Pointer capture may fail during teardown. */ }
      }
      const restoreDrag = (gesture: PointerGesture) => {
        const drag = gesture.drag
        if (!drag) return
        drag.group.position.set(drag.start.x, 0, drag.start.z)
        controls!.enabled = true
        dragActiveRef.current = false
        setDragRevision((revision) => revision + 1)
        render()
      }
      const onPointerMove = (event: PointerEvent) => {
        const gesture = pointerStart
        const drag = gesture?.drag
        if (!gesture || !drag || gesture.pointerId !== event.pointerId) return
        if (!drag.started && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4) return
        drag.started = true
        if (!setPointerRay(event) || !raycaster.ray.intersectPlane(floorPlane, floorPoint)) return
        const center = toRoomPoint({ x: floorPoint.x + drag.offset.x, z: floorPoint.z + drag.offset.z })
        drag.center = { xMm: snapToGridMm(center.xMm), yMm: snapToGridMm(center.yMm) }
        drag.group.position.set(drag.center.xMm / 1000, 0, drag.center.yMm / 1000)
        render()
      }
      const onPointerUp = (event: PointerEvent) => {
        const gesture = pointerStart
        if (!gesture || gesture.pointerId !== event.pointerId) return
        pointerStart = null
        if (gesture.drag) {
          controls!.enabled = true
          dragActiveRef.current = false
          setDragRevision((revision) => revision + 1)
          if (gesture.drag.started) {
            const errorKey = moveItemRef.current(gesture.drag.id, gesture.drag.center)
            if (errorKey) {
              gesture.drag.group.position.set(gesture.drag.start.x, 0, gesture.drag.start.z)
              setMoveError(errorKey)
            }
            render()
          } else {
            gesture.drag.group.position.set(gesture.drag.start.x, 0, gesture.drag.start.z)
          }
          return
        }
        if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 5) onSelect(gesture.itemId)
      }
      const onPointerCancel = (event: PointerEvent) => {
        if (!pointerStart || pointerStart.pointerId !== event.pointerId) return
        restoreDrag(pointerStart)
        pointerStart = null
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !pointerStart?.drag) return
        restoreDrag(pointerStart)
        pointerStart = null
      }
      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointermove', onPointerMove)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      renderer.domElement.addEventListener('pointercancel', onPointerCancel)
      window.addEventListener('keydown', onKeyDown)
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
        renderer?.domElement.removeEventListener('pointermove', onPointerMove)
        renderer?.domElement.removeEventListener('pointerup', onPointerUp)
        renderer?.domElement.removeEventListener('pointercancel', onPointerCancel)
        window.removeEventListener('keydown', onKeyDown)
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
  }, [locale, onSelect, onReady, onUnavailable])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (dragActiveRef.current) {
      return
    }
    if (renderedLayoutRef.current === layout) {
      return
    }

    const previousRoom = scene.getObjectByName('room-scene')
    if (previousRoom) {
      scene.remove(previousRoom)
      disposeScene(previousRoom)
    }
    const nextRoom = buildRoomScene(layout)
    scene.add(nextRoom)
    applyNearWallVisibility(scene, hideNearWallsRef.current)
    renderedLayoutRef.current = layout
    renderRef.current?.()
    handleRef.current?.resetCamera()
  }, [layout, dragRevision])

  useEffect(() => {
    if (sceneRef.current) {
      markSceneEntities(sceneRef.current, selectionId, checkStatuses, showCheckMarks)
      renderRef.current?.()
    }
  }, [selectionId, checkStatuses, showCheckMarks, layout])

  useEffect(() => {
    hideNearWallsRef.current = hideNearWalls
    if (!sceneRef.current) return
    applyNearWallVisibility(sceneRef.current, hideNearWalls)
    renderRef.current?.()
  }, [hideNearWalls, layout])

  return <section className="scene-panel" aria-label={t(locale, 'view3d')} data-check-attention-count={attentionCount} data-check-not-evaluated-count={pendingCount}>
    <div className="scene-toolbar">
      <span>{t(locale, 'sceneReadOnly')}</span>
      {showCheckMarks && <><span className="scene-check-legend"><i className="legend-check-marker legend-check-attention">!</i>{t(locale, 'check3dLegend')}</span><span className="scene-check-legend scene-check-pending"><i className="legend-check-marker legend-check-not-evaluated">?</i>{t(locale, 'check3dPendingLegend')}</span></>}
      <Button type="button" variant="outline" onClick={() => setHideNearWalls((value) => !value)} aria-pressed={hideNearWalls}>{hideNearWalls ? t(locale, 'showWalls') : t(locale, 'hideWalls')}</Button>
      <Button type="button" variant="outline" onClick={() => handleRef.current?.resetCamera()}>{t(locale, 'resetCamera')}</Button>
    </div>
    {moveError && <p className="export-message" role="status">{t(locale, moveError)}</p>}
    <div className="scene-canvas" ref={hostRef} />
  </section>
}
