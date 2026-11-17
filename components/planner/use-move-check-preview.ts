import { useCallback, useEffect, useRef, useState } from 'react'
import { evaluateWithMove, type MovePosition } from '@/lib/planner/checks'
import type { CheckResult, LayoutId, Locale, Project } from '@/lib/planner/types'
import { t } from '@/lib/planner/i18n'

export type MoveCheckPreview = {
  entityId: string
  results: CheckResult[]
  attention: CheckResult[]
  left: number
  top: number
}

function attentionFor(results: CheckResult[], entityId: string) {
  return results.filter((result) => result.status === 'attention' && result.entityIds.includes(entityId))
}

function attentionKey(results: CheckResult[]) {
  return results.map((result) => `${result.ruleId}:${[...result.entityIds].sort().join('|')}`).sort().join(';')
}

function positionKey(position: MovePosition) {
  return 'xMm' in position ? `${position.xMm}:${position.yMm}` : `${position.offsetMm}:${position.heightMm}`
}

export function useMoveCheckPreview(project: Project, layoutId: LayoutId, baseline: CheckResult[], locale: Locale) {
  const [preview, setPreview] = useState<MoveCheckPreview | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const frame = useRef<number | null>(null)
  const latest = useRef<{ entityId: string; position: MovePosition; left: number; top: number } | null>(null)
  const evaluatedKey = useRef('')
  const previousAttention = useRef('')
  const previewRef = useRef<MoveCheckPreview | null>(null)

  const begin = useCallback((entityId: string, position: MovePosition, left: number, top: number) => {
    const attention = attentionFor(baseline, entityId)
    const initial = { entityId, results: baseline, attention, left, top }
    previewRef.current = initial
    setPreview(initial)
    setAnnouncement('')
    evaluatedKey.current = `${entityId}:${positionKey(position)}`
    previousAttention.current = attentionKey(attention)
  }, [baseline])

  const schedule = useCallback((entityId: string, position: MovePosition, left: number, top: number) => {
    latest.current = { entityId, position, left, top }
    if (frame.current !== null) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null
      const next = latest.current
      if (!next) return
      const key = `${next.entityId}:${positionKey(next.position)}`
      let results = previewRef.current?.results ?? baseline
      if (key !== evaluatedKey.current) {
        results = evaluateWithMove(project, layoutId, next.entityId, next.position)
        evaluatedKey.current = key
      }
      const attention = attentionFor(results, next.entityId)
      const nextSignature = attentionKey(attention)
      if (nextSignature !== previousAttention.current) {
        previousAttention.current = nextSignature
        const text = attention.length
          ? `${attention.length} ${t(locale, attention.length === 1 ? 'moveNeedsAttentionOne' : 'moveNeedsAttentionMany')}: ${t(locale, attention[0].messageKey as Parameters<typeof t>[1])}`
          : t(locale, 'moveNoAttention')
        setAnnouncement(text)
      }
      const nextPreview = { entityId: next.entityId, results, attention, left: next.left, top: next.top }
      previewRef.current = nextPreview
      setPreview(nextPreview)
    })
  }, [baseline, layoutId, locale, project])

  const clear = useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    latest.current = null
    previewRef.current = null
    evaluatedKey.current = ''
    previousAttention.current = ''
    setPreview(null)
    setAnnouncement('')
  }, [])

  useEffect(() => () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
  }, [])

  return { preview, announcement, begin, schedule, clear }
}
