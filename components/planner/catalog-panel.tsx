'use client'

import { useState } from 'react'
import { CATALOG, catalogForRoom, ROOM_CATEGORIES, type CatalogCategory } from '@/lib/planner/catalog'
import { t } from '@/lib/planner/i18n'
import { catalogEntryAsItem, thumbnailKey } from '@/lib/planner/scene/thumbnail-key'
import type { Locale, RoomType } from '@/lib/planner/types'
import { useThumbnails } from './use-thumbnails'

type Filter = 'all' | CatalogCategory

const CATALOG_ITEMS = CATALOG.map((entry) => catalogEntryAsItem(entry))
const PREVIEW_KEYS = new Map(CATALOG_ITEMS.map((item) => [item.catalogId, thumbnailKey(item)]))

export function CatalogPanel({ locale, roomType = 'living', onAdd, editable = true }: { locale: Locale; roomType?: RoomType; onAdd(id: string): void; editable?: boolean }) {
  const [filter, setFilter] = useState<Filter>('all')
  const thumbnails = useThumbnails(CATALOG_ITEMS)
  // Each room type has its own pieces: a living room has no toilet, a bathroom no sofa.
  const categories = ROOM_CATEGORIES[roomType]
  const available = catalogForRoom(roomType)
  const activeFilter = filter !== 'all' && !categories.includes(filter) ? 'all' : filter
  const visible = available.filter((item) => activeFilter === 'all' || item.category === activeFilter)

  return <section className="catalog-panel" aria-labelledby="catalog-heading">
    <div className="section-heading"><div><p className="eyebrow">{t(locale, 'placeItem')}</p><h2 id="catalog-heading">{t(locale, 'catalog')}</h2></div><span>{available.length}</span></div>
    <p className="catalog-hint">{t(locale, 'catalogHint')}</p>
    <div className="catalog-filters" role="group" aria-label={t(locale, 'catalogFilter')}>
      {(['all', ...categories] as const).map((value) => <button key={value} type="button" className="catalog-filter" aria-pressed={activeFilter === value} onClick={() => setFilter(value)}>{t(locale, value === 'all' ? 'allCategories' : value)}</button>)}
    </div>
    <div className="catalog-grid">{visible.map((item) => {
      const { width, depth, height } = item.defaultDimensionsMm
      const image = thumbnails[PREVIEW_KEYS.get(item.id) ?? '']
      return <button key={item.id} type="button" className="catalog-card" disabled={!editable} onClick={() => onAdd(item.id)} aria-label={`${item.label[locale]}, ${width} × ${depth} × ${height} mm`}>
        <span className="catalog-tile" aria-hidden="true">
          {image
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL, not an optimisable asset
            ? <img src={image} alt="" draggable={false} />
            : <span className={`catalog-preview preview-${item.meshKind}`}><span /></span>}
          <span className="catalog-add">＋</span>
        </span>
        <span className="catalog-copy"><strong>{item.label[locale]}</strong><small>{width / 10} × {depth / 10} {t(locale, 'unitCm')}</small></span>
      </button>
    })}</div>
  </section>
}
