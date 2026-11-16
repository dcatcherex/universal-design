'use client'

import { useEffect, useState } from 'react'
import { thumbnailKey } from '@/lib/planner/scene/thumbnail-key'
import type { FurnitureItem } from '@/lib/planner/types'

/**
 * Returns rendered preview images keyed by `thumbnailKey(item)`.
 * Pass a stable array (module constant or useMemo). Missing keys mean "not ready
 * or WebGL unavailable"; callers show the CSS preview instead.
 */
export function useThumbnails(items: readonly FurnitureItem[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!items.length) return
    let cancelled = false
    void import('@/lib/planner/scene/thumbnails').then(({ renderFurnitureThumbnail }) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const item of items) {
        const url = renderFurnitureThumbnail(item)
        if (url) next[thumbnailKey(item)] = url
      }
      if (Object.keys(next).length) setUrls((previous) => ({ ...previous, ...next }))
    }).catch(() => { /* previews are optional */ })
    return () => { cancelled = true }
  }, [items])

  return urls
}
