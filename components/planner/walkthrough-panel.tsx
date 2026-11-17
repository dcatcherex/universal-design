'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getWalkthrough, CHECKLIST, type WalkthroughFinding } from '@/lib/planner/standards/checklist'
import type { ChecklistAnswer, Locale, RoomType } from '@/lib/planner/types'
import { t } from '@/lib/planner/i18n'

const ANSWERS = ['yes', 'no', 'unsure', 'not-applicable'] as const
type AnswerChoice = (typeof ANSWERS)[number]
const AREA_KEYS = {
  floors: 'walkthroughAreaFloors',
  lighting: 'walkthroughAreaLighting',
  bathroom: 'walkthroughAreaBathroom',
  furniture: 'walkthroughAreaFurniture',
  emergency: 'walkthroughAreaEmergency',
  entrance: 'walkthroughAreaEntrance',
} as const
const ANSWER_KEYS = {
  yes: 'walkthroughYes',
  no: 'walkthroughNo',
  unsure: 'walkthroughUnsure',
  'not-applicable': 'walkthroughNotApplicable',
} as const

export function WalkthroughPanel({ answers, roomType, locale, editable, onAnswer, onCreateRecommendation }: {
  answers: readonly ChecklistAnswer[]
  roomType: RoomType
  locale: Locale
  editable: boolean
  onAnswer(questionId: string, answer: AnswerChoice, note: string): void
  onCreateRecommendation(finding: WalkthroughFinding): void
}) {
  const walkthrough = useMemo(() => getWalkthrough(answers, roomType), [answers, roomType])
  const areas = [...new Set(walkthrough.questions.map((question) => question.area))]
  const [area, setArea] = useState(areas[0] ?? 'floors')
  const questions = walkthrough.questions.filter((question) => question.area === area)
  const [index, setIndex] = useState(0)
  const question = questions[index]
  const savedAnswer = question ? answers.find((answer) => answer.questionId === question.id) : undefined
  const [noteDraft, setNoteDraft] = useState<{ questionId: string; value: string } | null>(null)
  const note = noteDraft?.questionId === question?.id ? noteDraft.value : savedAnswer?.note ?? ''
  const source = question ? CHECKLIST.sources.find((item) => item.id === question.sourceId) : undefined

  const answeredCount = walkthrough.questions.filter((item) => answers.some((answer) => answer.questionId === item.id)).length
  const answer = (choice: AnswerChoice) => {
    if (question) onAnswer(question.id, choice, note)
  }
  const saveNote = () => {
    if (question && savedAnswer && note !== savedAnswer.note) onAnswer(question.id, savedAnswer.answer, note)
  }

  return <section className="walkthrough-panel" aria-labelledby="walkthrough-title">
    <header className="walkthrough-heading">
      <h2 id="walkthrough-title">{t(locale, 'walkthroughTitle')}</h2>
      <p>{t(locale, 'walkthroughProgress').replace('{answered}', String(answeredCount)).replace('{total}', String(walkthrough.questions.length))}</p>
    </header>
    <label className="field-label">{t(locale, 'walkthroughArea')}
      <select value={area} onChange={(event) => { setArea(event.target.value as typeof area); setIndex(0) }} disabled={!areas.length}>
        {areas.map((value) => <option key={value} value={value}>{t(locale, AREA_KEYS[value])}</option>)}
      </select>
    </label>
    {question ? <article className="walkthrough-question" data-question-id={question.id}>
      <div className="walkthrough-question-nav">
        <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>{t(locale, 'walkthroughPrevious')}</Button>
        <span>{index + 1} / {questions.length}</span>
        <Button type="button" variant="outline" disabled={index >= questions.length - 1} onClick={() => setIndex((value) => value + 1)}>{t(locale, 'walkthroughNext')}</Button>
      </div>
      <h3>{question.text[locale]}</h3>
      <p>{question.why[locale]}</p>
      <p className="walkthrough-source">{t(locale, 'walkthroughSource')}: {source && <><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> — </>}{question.sourceRef}</p>
      {question.review.status === 'pending' && <p className="walkthrough-pending" role="note">{t(locale, 'walkthroughPending')}</p>}
      <div className="walkthrough-answer-group" role="group" aria-label={t(locale, 'walkthroughAnswer')}>
        {ANSWERS.map((choice) => <Button key={choice} type="button" variant={savedAnswer?.answer === choice ? 'default' : 'outline'} aria-pressed={savedAnswer?.answer === choice} disabled={!editable} onClick={() => answer(choice)}>
          {t(locale, ANSWER_KEYS[choice])}
        </Button>)}
      </div>
      {savedAnswer && <div className="walkthrough-note">
        <label className="field-label">{t(locale, 'walkthroughNote')}<textarea value={note} maxLength={1000} disabled={!editable} onChange={(event) => question && setNoteDraft({ questionId: question.id, value: event.target.value })} /></label>
        <Button type="button" variant="outline" disabled={!editable || note === savedAnswer.note} onClick={saveNote}>{t(locale, 'walkthroughSaveNote')}</Button>
      </div>}
      {!savedAnswer && <p className="walkthrough-unanswered">{t(locale, 'walkthroughNotAnswered')}</p>}
    </article> : <p>{t(locale, 'walkthroughNoQuestions')}</p>}

    <section className="walkthrough-findings" aria-labelledby="walkthrough-findings-title">
      <h3 id="walkthrough-findings-title">{t(locale, 'walkthroughFindings')}</h3>
      <p>{t(locale, 'walkthroughSummary')
        .replace('{hazards}', String(walkthrough.summary.hazards))
        .replace('{checked}', String(walkthrough.summary.getChecked))
        .replace('{unanswered}', String(walkthrough.summary.notAnswered))}</p>
      {walkthrough.findings.length ? <ul>{walkthrough.findings.map((finding) => <li key={finding.questionId} data-finding-kind={finding.kind}>
        <strong>{finding.question.text[locale]}</strong>
        <p>{t(locale, finding.kind === 'hazard' ? 'walkthroughHazard' : 'walkthroughGetChecked')}</p>
        <p>{finding.question.advice[locale]}</p>
        {finding.note && <p>{finding.note}</p>}
        <Button type="button" variant="outline" disabled={!editable} onClick={() => onCreateRecommendation(finding)}>{t(locale, 'walkthroughCreateRecommendation')}</Button>
      </li>)}</ul> : <p>{t(locale, 'walkthroughNoFindings')}</p>}
    </section>
  </section>
}
