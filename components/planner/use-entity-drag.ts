'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { MovePosition } from '@/lib/planner/entity-movement'
import type { CheckResult, LayoutId, Locale, Project } from '@/lib/planner/types'
import { useMoveCheckPreview } from './use-move-check-preview'

export type EntityDragPreview<P> = { id: string; position: P }

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

export type EntityDragConfig<E, P extends MovePosition> = {
  project: Project; layoutId: LayoutId; checkResults: CheckResult[]; locale: Locale
  stageRef: RefObject<HTMLDivElement | null>
  editable: boolean
  /** Pointer drags may not start while another tool owns the surface (placing, drawing, picking). */
  canStartDrag?(): boolean
  /** Select on pointer-down (wall view) or on drop (plan view). */
  selectOnStart: boolean
  /** 'step-commit' applies each arrow step at once; 'preview-then-commit' previews steps and commits on key-up. */
  keyboard: 'step-commit' | 'preview-then-commit'
  modelPoint(event: { clientX: number; clientY: number }): P
  positionOf(entity: E): P
  /** Pointer position → entity position. `start` holds the pointer and entity positions captured at pointer-down. */
  positionFromDrag(entity: E, start: { pointer: P; entity: P }, current: P): P
  /** Arrow-key step in this view's position space; `dyMm` is positive upward. */
  stepped(position: P, dxMm: number, dyMm: number): P
  /** 'preview-then-commit' only: whether a stepped position may be previewed. */
  allowStep?(entity: E, position: P): boolean
  /** 'preview-then-commit' only: chip position for a model position (keyboard moves have no pointer). */
  chipPointFor?(position: P): { left: number; top: number }
  getEntity(id: string): E | undefined
  entityId(entity: E): string
  commit(entity: E, position: P): void
  onSelect(id: string): void
  onDragStart?(entity: E): void
  onDragCancel?(): void
}

/**
 * Shared entity-drag behaviour: pointer capture, Escape cancel, arrow-key stepping
 * (10 mm, or 50 mm with Shift), the move-check chip and live announcements.
 * Each view supplies its coordinate mapping, grid and commit path.
 */
export function useEntityDrag<E, P extends MovePosition>(config: EntityDragConfig<E, P>) {
  const dragRef = useRef<{ id: string; start: { pointer: P; entity: P }; position: P } | null>(null)
  const pendingRef = useRef<{ id: string; position: P } | null>(null)
  const [preview, setPreview] = useState<EntityDragPreview<P> | null>(null)
  const moveFeedback = useMoveCheckPreview(config.project, config.layoutId, config.checkResults, config.locale)
  const clearMoveFeedback = moveFeedback.clear
  const onDragCancelRef = useRef(config.onDragCancel)
  useEffect(() => { onDragCancelRef.current = config.onDragCancel })

  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !(dragRef.current || pendingRef.current)) return
      dragRef.current = null
      pendingRef.current = null
      setPreview(null)
      clearMoveFeedback()
      onDragCancelRef.current?.()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [clearMoveFeedback])

  function chipPoint(clientX: number, clientY: number) {
    const rect = config.stageRef.current?.getBoundingClientRect()
    return { left: rect ? clientX - rect.left + 12 : 12, top: rect ? clientY - rect.top + 12 : 12 }
  }

  function onEntityPointerDown(event: ReactPointerEvent<SVGGElement>, entity: E) {
    if (config.canStartDrag && !config.canStartDrag()) return
    event.stopPropagation()
    pendingRef.current = null
    const id = config.entityId(entity)
    if (config.selectOnStart) config.onSelect(id)
    if (!config.editable) return
    config.onDragStart?.(entity)
    const point = config.modelPoint(event)
    const position = config.positionOf(entity)
    dragRef.current = { id, start: { pointer: point, entity: position }, position }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPreview({ id, position })
    const chip = chipPoint(event.clientX, event.clientY)
    moveFeedback.begin(id, position, chip.left, chip.top)
  }

  function onSurfacePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const entity = config.getEntity(drag.id)
    if (!entity) return
    const position = config.positionFromDrag(entity, drag.start, config.modelPoint(event))
    drag.position = position
    setPreview({ id: drag.id, position })
    const chip = chipPoint(event.clientX, event.clientY)
    moveFeedback.schedule(drag.id, position, chip.left, chip.top)
  }

  function onSurfacePointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setPreview(null)
    moveFeedback.clear()
    const entity = config.getEntity(drag.id)
    if (!entity) return
    if (!config.selectOnStart) config.onSelect(drag.id)
    config.commit(entity, drag.position)
  }

  function onEntityKeyDown(event: KeyboardEvent<SVGGElement>, entity: E) {
    if (!config.editable || !ARROW_KEYS.includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 50 : 10
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0
    const id = config.entityId(entity)
    if (config.keyboard === 'step-commit') {
      config.onSelect(id)
      config.commit(entity, config.stepped(config.positionOf(entity), dx, dy))
      return
    }
    const base = pendingRef.current?.id === id ? pendingRef.current.position : config.positionOf(entity)
    const next = config.stepped(base, dx, dy)
    if (config.allowStep && !config.allowStep(entity, next)) return
    if (pendingRef.current?.id !== id) {
      const chip = config.chipPointFor ? config.chipPointFor(base) : { left: 12, top: 12 }
      moveFeedback.begin(id, config.positionOf(entity), chip.left, chip.top)
    }
    pendingRef.current = { id, position: next }
    setPreview({ id, position: next })
    const chip = config.chipPointFor ? config.chipPointFor(next) : { left: 12, top: 12 }
    moveFeedback.schedule(id, next, chip.left, chip.top)
  }

  function onEntityKeyUp(event: KeyboardEvent<SVGGElement>, entity: E) {
    if (config.keyboard !== 'preview-then-commit' || !ARROW_KEYS.includes(event.key)) return
    const pending = pendingRef.current
    if (!pending || pending.id !== config.entityId(entity)) return
    pendingRef.current = null
    setPreview(null)
    moveFeedback.clear()
    config.commit(entity, pending.position)
  }

  return {
    preview,
    moveFeedback,
    isDragging: () => dragRef.current !== null,
    onEntityPointerDown,
    onSurfacePointerMove,
    onSurfacePointerUp,
    onEntityKeyDown,
    onEntityKeyUp,
  }
}
