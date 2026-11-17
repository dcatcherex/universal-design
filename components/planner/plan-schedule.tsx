'use client'

import { buildPlanSchedule, type PlanSchedule as PlanScheduleModel } from '@/lib/planner/plan-schedule'
import type { Locale, RoomSpace } from '@/lib/planner/types'
import { t } from '@/lib/planner/i18n'

export function PlanSchedule({ room, schedule: providedSchedule, locale, selectionId, onSelect }: {
  room: RoomSpace
  schedule?: PlanScheduleModel
  locale: Locale
  selectionId?: string | null
  onSelect?(id: string): void
}) {
  const schedule = providedSchedule ?? buildPlanSchedule(room)
  const wallLabel = (wall: typeof schedule.fixtures[number]['wall']) => t(locale, wall === 'north' ? 'wallNorth' : wall === 'east' ? 'wallEast' : wall === 'south' ? 'wallSouth' : 'wallWest')

  return <section className="plan-schedule" aria-label={t(locale, 'itemSchedule')}>
    <h3>{t(locale, 'itemSchedule')}</h3>
    {schedule.items.length > 0 ? <div className="plan-schedule-scroll">
      <table className="plan-schedule-table">
        <caption className="sr-only">{t(locale, 'itemSchedule')}</caption>
        <thead><tr>
          <th scope="col">{t(locale, 'itemNumber')}</th>
          <th scope="col">{t(locale, 'itemLabel')}</th>
          <th scope="col">{t(locale, 'itemWidthDepth')}</th>
        </tr></thead>
        <tbody>{schedule.items.map((item) => {
          const selected = selectionId === item.id
          return <tr key={item.id} data-schedule-item-id={item.id} className={selected ? 'selected' : ''} onClick={onSelect ? () => onSelect(item.id) : undefined}>
            <td>{onSelect
              ? <button type="button" className="schedule-number" aria-label={`${t(locale, 'selectScheduleItem')} ${item.number}: ${item.label}`} aria-pressed={selected}>{item.number}</button>
              : item.number}</td>
            <td>{item.label}</td>
            <td>{item.widthLabel} × {item.depthLabel}</td>
          </tr>
        })}</tbody>
      </table>
    </div> : <p className="plan-schedule-empty">{t(locale, 'scheduleEmpty')}</p>}
    {schedule.fixtures.length > 0 && <div className="plan-fixture-schedule">
      <h4>{t(locale, 'fixtures')}</h4>
      <ul>{schedule.fixtures.map((fixture) => {
        const selected = selectionId === fixture.id
        const confidenceKey = fixture.confidence === 'advisor-verified' ? 'confidenceVerified' : fixture.confidence === 'measured' ? 'measured' : 'estimated'
        const details = `${wallLabel(fixture.wall)} · ${t(locale, 'fixtureHeightAboveFloor')}: ${fixture.heightLabel} · ${t(locale, confidenceKey)}`
        return <li key={fixture.id} data-schedule-fixture-id={fixture.id}>
          {onSelect
            ? <button type="button" className="fixture-schedule-row" aria-pressed={selected} onClick={() => onSelect(fixture.id)}><strong>{fixture.label}</strong><span>{details}</span></button>
            : <><strong>{fixture.label}</strong><span>{details}</span></>}
        </li>
      })}</ul>
    </div>}
  </section>
}
