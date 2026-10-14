import type { FeatureDefinition } from '../../features/home/featureData'
import type { MementoRecord } from '../../services/mementoApi'

import './RecordCard.css'

interface RecordCardProps {
  feature: FeatureDefinition
  record: MementoRecord
  canDelete: boolean
  deleting: boolean
  isDeleting: boolean
  onReadMore: () => void
  onDelete: () => void
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
  }).format(
    new Date(Number(year), Number(month) - 1, Number(day)),
  )
}

export function RecordCard({
  feature,
  record,
  canDelete,
  deleting,
  isDeleting,
  onReadMore,
  onDelete,
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

  const startDate = isProject
    ? record.start_date
    : record.from_date

  const endDate = isProject
    ? record.end_date
    : record.to_date

  const excerpt =
    description.length > 150
      ? `${description.slice(0, 150).trimEnd()}…`
      : description

  return (
    <article className="record-card">
      <div className="record-card__top">
        <span className="record-card__icon" aria-hidden="true">
          <i
            className={
              isProject
                ? 'ri-folder-3-line'
                : 'ri-task-line'
            }
          />
        </span>

        {status && (
          <span className="record-card__status">
            {status}
          </span>
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
                className={
                  isProject
                    ? 'ri-folder-line'
                    : 'ri-links-line'
                }
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

        {canDelete && (
          <button
            type="button"
            className="record-card__delete"
            onClick={onDelete}
            disabled={deleting}
          >
            <i
              className={
                isDeleting
                  ? 'ri-loader-4-line'
                  : 'ri-delete-bin-line'
              }
              aria-hidden="true"
            />

            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </article>
  )
}