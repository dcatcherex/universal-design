'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { fixturePositionProblem } from '@/lib/planner/elevation'
import { getFixtureEntry, isGrabBar } from '@/lib/planner/fixtures-catalog'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { getPrimaryRoom, withPrimaryRoom } from '@/lib/planner/layout-access'
import type { Layout, Locale, Wall, WallFixture } from '@/lib/planner/types'
import { MeasureField } from './measure-field'

const WALLS: { value: Wall; label: MessageKey }[] = [
  { value: 'north', label: 'wallNorth' }, { value: 'east', label: 'wallEast' }, { value: 'south', label: 'wallSouth' }, { value: 'west', label: 'wallWest' },
]

type Props = { fixture: WallFixture; layout: Layout; locale: Locale; editable: boolean; advisorMode: boolean; onCommit(layout: Layout): void; onSelect(id: string | null): void; onShowWall?(wall: Wall): void }

/** Numeric editing for one wall fixture. The same values can be dragged in the wall view. */
export function FixtureInspector({ fixture, layout, locale, editable, advisorMode, onCommit, onSelect, onShowWall }: Props) {
  const [error, setError] = useState('')
  const room = getPrimaryRoom(layout)
  const entry = getFixtureEntry(fixture.kind)

  function update(patch: Partial<WallFixture>) {
    const next = { ...fixture, ...patch }
    const problem = fixturePositionProblem(next, room)
    if (problem) { setError(t(locale, problem === 'over-opening' ? 'fixtureOverOpening' : 'fixtureOutsideWall')); return }
    setError('')
    onCommit(withPrimaryRoom(layout, (value) => ({ ...value, fixtures: value.fixtures.map((candidate) => candidate.id === fixture.id ? next : candidate) })))
  }
  function remove() {
    onSelect(null)
    onCommit(withPrimaryRoom(layout, (value) => ({ ...value, fixtures: value.fixtures.filter((candidate) => candidate.id !== fixture.id) })))
  }

  return <section className="item-inspector fixture-inspector" aria-labelledby="selected-fixture-heading">
    <div className="inspector-item-title"><div><p className="eyebrow">{t(locale, 'selectedFixture')}</p><h3 id="selected-fixture-heading">{fixture.label}</h3><p className="helper-text">{entry.label[locale]}</p></div></div>
    {!editable && <p className="helper-text">{t(locale, 'currentReadOnly')}</p>}
    <label className="field-label">{t(locale, 'openingWall')}<select value={fixture.wall} disabled={!editable} onChange={(event) => update({ wall: event.target.value as Wall })}>{WALLS.map((wall) => <option key={wall.value} value={wall.value}>{t(locale, wall.label)}</option>)}</select></label>
    <MeasureField label={t(locale, 'fixtureOffsetCm')} measurement={fixture.offset} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={15000} onChange={(value) => value && update({ offset: value })} />
    <MeasureField label={t(locale, 'fixtureHeightCm')} measurement={fixture.referenceHeight} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={5000} onChange={(value) => value && update({ referenceHeight: value })} />
    <p className="helper-text">{entry.heightMeaning[locale]}</p>
    <MeasureField label={t(locale, 'fixtureLengthCm')} measurement={fixture.length} locale={locale} editable={editable} advisorMode={advisorMode} min={10} max={5000} onChange={(value) => value && update({ length: value })} />
    <MeasureField label={t(locale, 'fixtureProjectionCm')} measurement={fixture.projection} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={1500} onChange={(value) => value && update({ projection: value })} />
    {isGrabBar(fixture.kind) && <MeasureField label={t(locale, 'fixtureDiameterCm')} measurement={fixture.diameter} locale={locale} editable={editable} advisorMode={advisorMode} min={5} max={200} optional onChange={(value) => update({ diameter: value })} />}
    {fixture.kind === 'basin' && <MeasureField label={t(locale, 'kneeClearanceCm')} measurement={fixture.kneeClearanceDepth ?? null} locale={locale} editable={editable} advisorMode={advisorMode} min={0} max={1500} optional onChange={(value) => update({ kneeClearanceDepth: value })} />}
    {error && <p role="alert" className="field-error">{error}</p>}
    {onShowWall && <Button type="button" variant="outline" className="wide-button" onClick={() => onShowWall(fixture.wall)}>{t(locale, 'showInWallView')}</Button>}
    <Button type="button" variant="ghost" className="wide-button remove-button" disabled={!editable} onClick={remove}>{t(locale, 'removeFixture')}</Button>
  </section>
}
