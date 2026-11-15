'use client'

import { CATALOG } from '@/lib/planner/catalog'
import { t } from '@/lib/planner/i18n'
import type { Locale } from '@/lib/planner/types'

const categories = ['seating', 'tables', 'storage', 'lighting', 'rugs', 'custom'] as const

export function CatalogPanel({ locale, onAdd, editable = true }: { locale: Locale; onAdd(id: string): void; editable?: boolean }) {
  return <section className="catalog-panel" aria-labelledby="catalog-heading">
    <div className="section-heading"><div><p className="eyebrow">{t(locale, 'placeItem')}</p><h2 id="catalog-heading">{t(locale, 'catalog')}</h2></div></div>
    {categories.map((category) => <div className="catalog-category" key={category}>
      <h3>{t(locale, category)}</h3>
      <div className="catalog-list">{CATALOG.filter((item) => item.category === category).map((item) => <button key={item.id} type="button" className="catalog-card" disabled={!editable} onClick={() => onAdd(item.id)} aria-label={`${item.label[locale]}, ${item.defaultDimensionsMm.width} × ${item.defaultDimensionsMm.depth} × ${item.defaultDimensionsMm.height} mm`}>
        <span className={`catalog-preview preview-${item.meshKind}`} aria-hidden="true"><span /></span>
        <span className="catalog-copy"><strong>{item.label[locale]}</strong><small>{item.defaultDimensionsMm.width} × {item.defaultDimensionsMm.depth} × {item.defaultDimensionsMm.height} mm</small></span>
        <span className="catalog-add" aria-hidden="true">＋</span>
      </button>)}</div>
    </div>)}
  </section>
}
