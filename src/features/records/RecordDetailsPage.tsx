import { useEffect, useState } from 'react'

import {
  mementoApi,
  type DocTypeMetadata,
  type MementoRecord,
} from '../../services/mementoApi'

import type { FeatureDefinition } from '../home/featureData'

import { RecordUpdateDialog } from '../../components/form/RecordUpdateDialog'

import './RecordDetailsPage.css'

interface RecordDetailPageProps {
  feature: FeatureDefinition
  recordName: string
  onClose: () => void
}

interface DetailField {
  label: string
  value: string
}

function displayText(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set'
  }

  if (Array.isArray(value)) {
    const result = value
      .map((item) => displayText(item))
      .filter((item) => item !== 'Not set')

    return result.length ? result.join(', ') : 'Not set'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function plainText(value: unknown): string {
  const text = displayText(value)

  if (text === 'Not set' || typeof document === 'undefined') {
    return text
  }

  const parsed = new DOMParser().parseFromString(text, 'text/html')

  return (parsed.body.textContent ?? text)
    .replace(/\s+/g, ' ')
    .trim() || 'Not set'
}

function formatDate(
  value: unknown,
  includeTime = false,
): string {
  if (typeof value !== 'string' || !value) {
    return 'Not set'
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  )

  if (!match) {
    return value
  }

  const [, year, month, day, hour, minute] = match

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(
    new Date(Number(year), Number(month) - 1, Number(day)),
  )

  if (includeTime && hour !== undefined) {
    return `${formattedDate}, ${hour}:${minute ?? '00'}`
  }

  return formattedDate
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

export function RecordDetailPage({
  feature,
  recordName,
  onClose,
}: RecordDetailPageProps) {
  const [record, setRecord] = useState<MementoRecord | null>(null)

  const [metadata, setMetadata] =
    useState<DocTypeMetadata | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const isProject = feature.id === 'projects'

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      mementoApi.getDocTypeRecord(feature.doctype, recordName),
      mementoApi.getDocTypeMetadata(feature.doctype, 'form'),
    ])
      .then(([recordResponse, metadataResponse]) => {
        if (cancelled) return

        setRecord(recordResponse.data)
        setMetadata(metadataResponse.data)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [feature.doctype, recordName, retryKey])

  // async function handleDelete() {
  //   if (!record || !metadata?.capabilities.can_delete || deleting) {
  //     return
  //   }

  //   const recordTitle = plainText(
  //     isProject ? record.project_name : record.task_name,
  //   )

  //   const confirmed = window.confirm(
  //     `Delete "${recordTitle === 'Not set' ? record.name : recordTitle}"? This action cannot be undone.`,
  //   )

  //   if (!confirmed) return

  //   setDeleting(true)
  //   setDeleteError(null)

  //   try {
  //     await mementoApi.deleteDocTypeRecord(
  //       feature.doctype,
  //       record.name,
  //     )

  //     onClose()
  //   } catch (error: unknown) {
  //     setDeleteError(getErrorMessage(error))
  //   } finally {
  //     setDeleting(false)
  //   }
  // }

  if (loading) {
    return (
      <section className="record-detail record-detail--state">
        <p role="status">Loading record details…</p>
      </section>
    )
  }

  if (loadError || !record) {
    return (
      <section className="record-detail record-detail--state">
        <button
          type="button"
          className="record-detail__secondary"
          onClick={onClose}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to {feature.itemPlural}
        </button>

        <div className="record-detail__error" role="alert">
          <strong>Unable to open this record</strong>
          <p>{loadError ?? 'The requested record was not found.'}</p>

          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setLoadError(null)
              setRetryKey((value) => value + 1)
            }}
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  const recordTitle = plainText(
    isProject ? record.project_name : record.task_name,
  )

  const description = plainText(record.description)

  const detailFields: DetailField[] = isProject
    ? [
        { label: 'PROJECT ID', value: record.name },
        {
          label: 'START DATE',
          value: formatDate(record.start_date),
        },
        {
          label: 'END DATE',
          value: formatDate(record.end_date, true),
        },
        {
          label: 'CATEGORY',
          value: plainText(record.category),
        },
        {
          label: 'PRIORITY',
          value: plainText(record.priority_level),
        },
        {
          label: 'STATUS',
          value: plainText(record.status),
        },
        {
          label: 'OWNER',
          value: plainText(record.user),
        },
      ]
    : [
        { label: 'TASK ID', value: record.name },
        {
          label: 'FROM DATE',
          value: formatDate(record.from_date),
        },
        {
          label: 'TO DATE',
          value: formatDate(record.to_date),
        },
        {
          label: 'PROJECT',
          value: plainText(record.project),
        },
        {
          label: 'PRIORITY',
          value: plainText(record.priority),
        },
        {
          label: 'STATUS',
          value: plainText(record.status),
        },
        {
          label: 'CREATED BY',
          value: plainText(record.created_by),
        },
      ]

  return (
    <article
      className="record-detail"
      aria-labelledby="record-detail-title"
    >
      <div className="record-detail__actions">
        <button
          type="button"
          className="record-detail__secondary"
          onClick={onClose}
        >
          Close
        </button>

        {metadata?.capabilities.can_update && (
          <button
            type="button"
            className="record-detail__update"
            onClick={() => setIsUpdateOpen(true)}
          >
            <i className="ri-edit-line" aria-hidden="true" />
            Update
          </button>
        )}
      </div>

      {/* {deleteError && (
        <div className="record-detail__error" role="alert">
          <strong>Unable to delete this record</strong>
          <p>{deleteError}</p>
        </div>
      )} */}

      {
        updateMessage && (
          <div className='record-detail__notice' role='status'>
            <i className="ri-checkbox-circle-line" aria-hidden="true"/>
            {updateMessage}
          </div>
        )
      }

      <header className="record-detail__header">
        <span className="record-detail__eyebrow">
          MEMENTO / {isProject ? 'PROJECTS' : 'TASKS'} / {record.name}
        </span>

        <h1 id="record-detail-title">
          {recordTitle === 'Not set' ? record.name : recordTitle}
        </h1>

        {description !== 'Not set' && (
          <p className="record-detail__intro">
            {description.length > 240
              ? `${description.slice(0, 240).trimEnd()}…`
              : description}
          </p>
        )}

        <div className="record-detail__badges">
          {record.status != null && (
            <span className="record-detail__badge">
              {plainText(record.status)}
            </span>
          )}

          {record.priority_level != null && (
            <span className="record-detail__badge">
              {plainText(record.priority_level)}
            </span>
          )}

          {!isProject && record.priority != null && (
            <span className="record-detail__badge">
              {plainText(record.priority)}
            </span>
          )}
        </div>
      </header>

      <section
        className="record-detail__section"
        aria-labelledby="record-detail-fields-heading"
      >
        <h2 id="record-detail-fields-heading">
          {isProject ? 'Project Details' : 'Task Details'}
        </h2>

        <div className="record-detail__grid">
          {detailFields.map((field) => (
            <div
              className="record-detail__field"
              key={field.label}
            >
              <span>{field.label}</span>
              <strong>{field.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section
        className="record-detail__section record-detail__description-section"
        aria-labelledby="record-detail-description-heading"
      >
        <h2 id="record-detail-description-heading">
          {isProject ? 'Project Description' : 'Task Description'}
        </h2>

        <p className="record-detail__description">
          {description}
        </p>
      </section>


      {isUpdateOpen && (
        <RecordUpdateDialog
          key={`${feature.id}:${recordName}`}
          feature={feature}
          recordName={recordName}
          onClose={() => setIsUpdateOpen(false)}
          onUpdated={(result) => {
            setIsUpdateOpen(false)
            setLoading(true)
            setLoadError(null)
            setUpdateMessage(
              `Record ${result.name} updated successfully.`,
            )
            setRetryKey((value) => value + 1)
          }}
        />
      )}
    </article>
  )
}