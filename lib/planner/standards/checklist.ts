import seedDataset from './data/checklist-2026.11-draft.json'
import { checklistDatasetSchema, type ChecklistDataset, type ChecklistQuestion } from './schema'
import type { ChecklistAnswer, ChecklistFinding, RoomType } from '../types'

/** Draft content is validated on import so question/source drift fails tests and builds. */
export const CHECKLIST: ChecklistDataset = checklistDatasetSchema.parse(seedDataset)

export type WalkthroughSummary = { hazards: number; getChecked: number; notAnswered: number }
export type WalkthroughFinding = ChecklistFinding & { question: ChecklistQuestion }
export type WalkthroughEntry = {
  question: ChecklistQuestion
  answer: ChecklistAnswer | null
  outcome: 'hazard' | 'get-checked' | 'clear' | 'not-applicable' | 'not-answered'
}

export function getChecklistQuestions(roomType: RoomType): ChecklistQuestion[] {
  return CHECKLIST.questions.filter((question) => question.roomTypes.includes(roomType))
}

/** Answers to retired questions remain stored but are intentionally ignored by this derivation. */
export function getWalkthrough(projectAnswers: readonly ChecklistAnswer[], roomType: RoomType): {
  questions: ChecklistQuestion[]
  findings: WalkthroughFinding[]
  entries: WalkthroughEntry[]
  summary: WalkthroughSummary
} {
  const questions = getChecklistQuestions(roomType)
  const answers = new Map(projectAnswers.map((answer) => [answer.questionId, answer]))
  const findings: WalkthroughFinding[] = []
  const entries: WalkthroughEntry[] = []
  let notAnswered = 0

  for (const question of questions) {
    const answer = answers.get(question.id)
    if (!answer) {
      notAnswered += 1
      entries.push({ question, answer: null, outcome: 'not-answered' })
      continue
    }
    if (answer.answer === 'unsure') {
      findings.push({ questionId: question.id, kind: 'get-checked', note: answer.note, question })
      entries.push({ question, answer, outcome: 'get-checked' })
    } else if (answer.answer !== 'not-applicable' && answer.answer === question.hazardAnswer) {
      findings.push({ questionId: question.id, kind: 'hazard', note: answer.note, question })
      entries.push({ question, answer, outcome: 'hazard' })
    } else entries.push({ question, answer, outcome: answer.answer === 'not-applicable' ? 'not-applicable' : 'clear' })
  }

  return {
    questions,
    findings,
    entries,
    summary: {
      hazards: findings.filter((finding) => finding.kind === 'hazard').length,
      getChecked: findings.filter((finding) => finding.kind === 'get-checked').length,
      notAnswered,
    },
  }
}
