'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { getReviewStatus } from '@/lib/planner/history'
import { t } from '@/lib/planner/i18n'
import type { Locale, Project } from '@/lib/planner/types'

export function ReviewPanel({ project, locale, onReview }: { project: Project; locale: Locale; onReview(name: string): void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(false)
  const status = getReviewStatus(project)
  const statusText = status === 'reviewed' ? t(locale, 'reviewCurrent') : status === 'outdated' ? t(locale, 'reviewOutdated') : t(locale, 'reviewNotReviewed')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) { setError(true); return }
    onReview(name.trim())
    setError(false)
  }
  return <section className="review-panel" aria-labelledby="review-panel-title">
    <h3 id="review-panel-title">{t(locale, 'reviewTitle')}</h3>
    <p className={`review-status review-${status}`} role="status">{statusText}</p>
    {project.review && <dl><div><dt>{t(locale, 'reviewRevision')}</dt><dd>{project.review.projectRevision}</dd></div><div><dt>{t(locale, 'reviewDate')}</dt><dd>{new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium' }).format(new Date(project.review.reviewedAt))}</dd></div></dl>}
    <p>{t(locale, 'reviewIdentityNote')}</p>
    <form onSubmit={submit} noValidate><label className="field-label">{t(locale, 'reviewName')}<input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></label>{error && <p role="alert" className="field-error">{t(locale, 'reviewNameRequired')}</p>}<Button type="submit">{t(locale, 'recordReview')}</Button></form>
  </section>
}
