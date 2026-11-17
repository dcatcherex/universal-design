'use client'

import {
  EFFORT_LABEL_KEYS,
  EFFORT_TIERS,
  getActionGroups,
  getActionPriceText,
  getActionReferenceText,
  getActionText,
} from '@/lib/planner/action-list'
import { t } from '@/lib/planner/i18n'
import type { Locale, Project } from '@/lib/planner/types'
import type { ActionListItem } from '@/lib/planner/action-list'
import { Button } from '@/components/ui/button'

export function ActionList({ project, locale, onPreviewFix }: {
  project: Project
  locale: Locale
  onPreviewFix(check: NonNullable<ActionListItem['check']>, fix: NonNullable<ActionListItem['fix']>): void
}) {
  const groups = getActionGroups(project)
  return <section className="action-list" aria-labelledby="action-list-title" data-testid="action-list">
    <header className="action-list-heading">
      <h2 id="action-list-title">{t(locale, 'actionListTitle')}</h2>
      <p>{t(locale, 'actionListIntro')}</p>
    </header>
    {EFFORT_TIERS.map((tier) => <section className={`action-tier action-tier-${tier}`} key={tier} aria-labelledby={`action-tier-${tier}`}>
      <h3 id={`action-tier-${tier}`}>{t(locale, EFFORT_LABEL_KEYS[tier])} <span>({groups[tier].length})</span></h3>
      {tier === 'building-work' && <p className="action-tier-professional">{t(locale, 'actionBuildingWorkNote')}</p>}
      {groups[tier].length ? <ul>{groups[tier].map((item) => <li key={item.id} data-action-id={item.id} data-action-tier={item.tier} data-action-kind={item.kind} data-near-fall={item.nearFall}>
        <article className="action-row">
          <h4>{getActionText(item, locale)}</h4>
          <p>{getActionReferenceText(item, locale)}</p>
          {item.nearFall && <p className="near-fall-chip">{t(locale, 'nearFall')}</p>}
          <p>{getActionPriceText(item, locale)}</p>
          {item.kind === 'fix' && item.fix && item.check && <Button type="button" variant="outline" onClick={() => onPreviewFix(item.check!, item.fix!)}>{t(locale, 'previewFix')}</Button>}
        </article>
      </li>)}</ul> : <p className="action-tier-empty">{t(locale, 'actionListNoItems')}</p>}
    </section>)}
  </section>
}
