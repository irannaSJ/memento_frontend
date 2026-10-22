import type { KeyboardEvent, MouseEvent } from 'react'

import type { FeatureDefinition } from '../../features/home/featureData'
import type { MementoRecord } from '../../services/mementoApi'

import './RecordCard.css'

interface RecordCardProps {
  feature: FeatureDefinition
  record: MementoRecord
  canUpdate: boolean
  updating: boolean
  isUpdating: boolean
  onReadMore: () => void
  onUpdate: () => void
  /** Opens the related records view when the card body is activated. */
  onCardClick?: () => void
}

function displayText(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => displayText(item))
      .filter(Boolean)
      .join(', ')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function plainText(value: unknown): string {
  const text = displayText(value)

  if (!text || typeof document === 'undefined') {
    return text
  }

  const parsed = new DOMParser().parseFromString(text, 'text/html')

  return (parsed.body.textContent ?? text)
    .replace(/\s+/g, ' ')
    .trim()
}

function formatShortDate(value: unknown): string {
  if (typeof value !== 'string' || !value) {
    return 'Not set'
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (!match) {
    return value
  }

  const [, year, month, day] = match

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(year), Number(month) - 1, Number(day)))
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(
    target.closest('button, a, input, select, textarea, [role="button"]'),
  )
}

export function RecordCard({
  feature,
  record,
  canUpdate,
  updating,
  isUpdating,
  onReadMore,
  onUpdate,
  onCardClick,
}: RecordCardProps) {
  const isProject = feature.id === 'projects'

  const title = plainText(
    isProject ? record.project_name : record.task_name,
  ) || record.name

  const description = plainText(record.description)
  const status = plainText(record.status)
  const priority = plainText(
    isProject ? record.priority_level : record.priority,
  )

  const categoryOrProject = plainText(
    isProject ? record.category : record.project,
  )

  const startDate = isProject ? record.start_date : record.from_date
  const endDate = isProject ? record.end_date : record.to_date

  const excerpt = description.length > 150
    ? `${description.slice(0, 150).trimEnd()}…`
    : description

  function handleCardClick(event: MouseEvent<HTMLElement>) {
    if (!onCardClick || isInteractiveTarget(event.target)) return
    onCardClick()
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onCardClick || isInteractiveTarget(event.target)) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onCardClick()
    }
  }

  return (
    <article
      className="record-card"
      role={onCardClick ? 'link' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      aria-label={onCardClick ? `Open related records for ${title}` : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="record-card__top">
        <span className="record-card__icon" aria-hidden="true">
          <i className={isProject ? 'ri-folder-3-line' : 'ri-task-line'} />
        </span>

        {status && (
          <span className="record-card__status">{status}</span>
        )}
      </div>

      <div className="record-card__body">
        <p className="record-card__eyebrow">
          {isProject ? 'PROJECT' : 'TASK'} · {record.name}
        </p>

        <h2 className="record-card__title">{title}</h2>

        <p className="record-card__description">
          {excerpt || 'No description has been added yet.'}
        </p>

        <div className="record-card__tags">
          {categoryOrProject && (
            <span className="record-card__tag">
              <i
                className={isProject ? 'ri-folder-line' : 'ri-links-line'}
                aria-hidden="true"
              />
              {categoryOrProject}
            </span>
          )}

          {priority && (
            <span className="record-card__tag">
              <i className="ri-flag-line" aria-hidden="true" />
              {priority}
            </span>
          )}
        </div>

        <div className="record-card__dates">
          <div>
            <span>{isProject ? 'START DATE' : 'FROM DATE'}</span>
            <strong>{formatShortDate(startDate)}</strong>
          </div>

          <div>
            <span>{isProject ? 'END DATE' : 'TO DATE'}</span>
            <strong>{formatShortDate(endDate)}</strong>
          </div>
        </div>
      </div>

      <div className="record-card__actions">
        <button
          type="button"
          className="record-card__read-more"
          onClick={onReadMore}
        >
          Read more
          <i className="ri-arrow-right-line" aria-hidden="true" />
        </button>

        {canUpdate && (
          <button
            type="button"
            className="record-card__update"
            onClick={onUpdate}
            disabled={updating}
          >
            <i
              className={isUpdating ? 'ri-loader-4-line' : 'ri-edit-line'}
              aria-hidden="true"
            />
            {isUpdating ? 'Opening…' : 'Update'}
          </button>
        )}
      </div>
    </article>
  )
}
