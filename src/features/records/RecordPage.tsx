import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  mementoApi,
  type DocTypeMetadata,
  type MementoRecord,
  type PaginationInfo,
} from '../../services/mementoApi'

import type { FeatureDefinition } from '../home/featureData'

import { RecordTable } from '../../components/list/RecordTable'

import { useNavigate } from 'react-router-dom'
import { RecordCard } from '../../components/list/RecordCard'

import './RecordPage.css'

const PAGE_LENGTH = 20

/**
 * Connects existing homepage feature IDs to approved backend DocTypes.
 * All records and field definitions still come from the backend.
 */
// const FEATURE_DOCTYPES: Record<FeatureId, string> = {
//   projects: 'My Projects',
//   tasks: 'Tasks',
//   todo: 'Daily ToDo',
//   activity: 'Task Log',
// }


interface RecordPageProps {
  feature: FeatureDefinition
  onBack: () => void
}


function plainTextForDelete(value: unknown): string {
  if (typeof value !== 'string') {
    return value == null ? '' : String(value)
  }

  if (typeof document === 'undefined') {
    return value
  }

  const parsed = new DOMParser().parseFromString(
    value,
    'text/html',
  )

  return (parsed.body.textContent ?? value)
    .replace(/\s+/g, ' ')
    .trim()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong while loading records.'
}

export function RecordPage({
  feature,
  onBack,
}: RecordPageProps) {
  // const doctype = FEATURE_DOCTYPES[feature.id]
  const doctype = feature.doctype
  const navigate = useNavigate()

  const isCardFeature =
    feature.id === 'projects' || feature.id === 'tasks'

  const [metadata, setMetadata] =
    useState<DocTypeMetadata | null>(null)

  const [records, setRecords] =
    useState<MementoRecord[]>([])

  const [pagination, setPagination] =
    useState<PaginationInfo | null>(null)


  const [deletingRecordName, setDeletingRecordName] =
    useState<string | null>(null)

  const [deleteError, setDeleteError] =
    useState<string | null>(null)

  const [actionMessage, setActionMessage] =
    useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [start, setStart] = useState(0)

  const [metadataLoading, setMetadataLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(true)

  const [metadataError, setMetadataError] = useState<string | null>(
    null,
  )

  const [recordsError, setRecordsError] = useState<string | null>(
    null,
  )

  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0)
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0)

  // Load the visible list columns and field metadata.
  useEffect(() => {
    let cancelled = false

    // setMetadataLoading(true)
    // setMetadataError(null)

    void mementoApi
      .getDocTypeMetadata(doctype, 'list')
      .then((response) => {
        if (!cancelled) {
          setMetadata(response.data)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMetadataError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetadataLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [doctype, metadataRefreshKey])

  // Load records whenever search, page, or refresh state changes.
  useEffect(() => {
    let cancelled = false

    // setRecordsLoading(true)
    // setRecordsError(null)

    void mementoApi
      .getDocTypeRecords({
        doctype,
        start,
        page_length: PAGE_LENGTH,
        ...(activeSearch ? { search: activeSearch } : {}),
      })
      .then((response) => {
        if (cancelled) return

        setRecords(response.data)
        setPagination(response.pagination ?? null)
      })
      .catch((error: unknown) => {
        if (cancelled) return

        setRecords([])
        setPagination(null)
        setRecordsError(getErrorMessage(error))
      })
      .finally(() => {
        if (!cancelled) {
          setRecordsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [doctype, start, activeSearch, recordsRefreshKey])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextSearch = searchInput.trim()

    setRecordsLoading(true)
    setRecordsError(null)

    if (nextSearch === activeSearch && start === 0) {
        setRecordsRefreshKey((value) => value + 1)
        return
    }

    setStart(0)
    setActiveSearch(nextSearch)
    }


    function clearSearch() {
        setSearchInput('')

        if (activeSearch === '' && start === 0) {
            return
        }

        setRecordsLoading(true)
        setRecordsError(null)
        setStart(0)
        setActiveSearch('')
        }




  async function handleDeleteRecord(record: MementoRecord) {
    if (
      !isCardFeature ||
      !metadata?.capabilities.can_delete ||
      deletingRecordName !== null
    ) {
      return
    }

    const recordTitle = plainTextForDelete(
      feature.id === 'projects'
        ? record.project_name
        : record.task_name,
    ) || record.name

    const confirmed = window.confirm(
      `Delete "${recordTitle}"? This action cannot be undone.`,
    )

    if (!confirmed) return

    setDeletingRecordName(record.name)
    setDeleteError(null)
    setActionMessage(null)

    try {
      const response = await mementoApi.deleteDocTypeRecord(
        doctype,
        record.name,
      )

      setRecords((current) =>
        current.filter((item) => item.name !== record.name),
      )

      setActionMessage(
        response.message ?? `"${recordTitle}" was deleted.`,
      )

      if (records.length === 1 && start > 0) {
        setStart((current) => Math.max(0, current - PAGE_LENGTH))
      } else {
        setRecordsRefreshKey((current) => current + 1)
      }
    } catch (error: unknown) {
      setDeleteError(getErrorMessage(error))
    } finally {
      setDeletingRecordName(null)
    }
  }

  const pageNumber = Math.floor(start / PAGE_LENGTH) + 1

  return (
    <section className="record-page" aria-labelledby="record-page-title">
      <div className="record-page__header">
        <button
          type="button"
          className="record-page__back"
          onClick={onBack}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to overview
        </button>

        <div className="record-page__heading">
          <span className="record-page__eyebrow">
            MEMENTO / WORKSPACE
          </span>

          <h1 id="record-page-title">
            {metadata?.label ?? feature.itemPlural}
          </h1>

          <p>{feature.description}</p>
        </div>

        <div className="record-page__toolbar">
          <form
            className="record-page__search"
            onSubmit={handleSearch}
            role="search"
          >
            <i className="ri-search-line" aria-hidden="true" />

            <input
              type="search"
              aria-label={`Search ${metadata?.label ?? feature.itemPlural}`}
              placeholder={`Search ${metadata?.label ?? 'records'}…`}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

            <button type="submit">Search</button>
          </form>

          {activeSearch && (
            <button
              type="button"
              className="record-page__secondary-button"
              onClick={clearSearch}
            >
              Clear search
            </button>
          )}

          <button
            type="button"
            className="record-page__secondary-button"
            disabled={recordsLoading}
            onClick={() => {
                setRecordsLoading(true)
                setRecordsError(null)
                setRecordsRefreshKey((value) => value + 1)
                }}
          >
            <i className="ri-refresh-line" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>


      {actionMessage && (
        <div className="record-page__notice" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          {actionMessage}
        </div>
      )}

      {deleteError && (
        <div className="record-page__error" role="alert">
          <div>
            <strong>Unable to delete record</strong>
            <p>{deleteError}</p>
          </div>

          <button
            type="button"
            onClick={() => setDeleteError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {metadataError && (
        <div className="record-page__error" role="alert">
          <div>
            <strong>Unable to load column definitions</strong>
            <p>{metadataError}</p>
          </div>

          <button
            type="button"
            onClick={() => {
                setMetadataLoading(true)
                setMetadataError(null)
                setMetadataRefreshKey((value) => value + 1)
                }}
          >
            Retry
          </button>
        </div>
      )}

      {recordsError && (
        <div className="record-page__error" role="alert">
          <div>
            <strong>Unable to load records</strong>
            <p>{recordsError}</p>
          </div>

          <button
            type="button"
            onClick={() => {
                setRecordsLoading(true)
                setRecordsError(null)
                setRecordsRefreshKey((value) => value + 1)
                }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="record-page__summary">
        <div>
          <span className="record-page__summary-label">
            CURRENT PAGE
          </span>

          <strong>{String(pageNumber).padStart(2, '0')}</strong>
        </div>

        <span className="record-page__summary-note">
          {activeSearch
            ? `Search results for “${activeSearch}”`
            : 'Workspace records'}
        </span>
      </div>

      {metadataLoading && !metadata ? (
        <div className="record-page__loading" role="status">
          Loading list configuration…
        </div>
      ) : metadata && isCardFeature ? (
        <div className="record-card-grid">
          {records.map((record) => (
            <RecordCard
              key={record.name}
              feature={feature}
              record={record}
              canDelete={metadata.capabilities.can_delete}
              deleting={deletingRecordName !== null}
              isDeleting={deletingRecordName === record.name}
              onReadMore={() => {
                navigate(
                  `/${feature.id}/${encodeURIComponent(record.name)}`,
                )
              }}
              onDelete={() => {
                void handleDeleteRecord(record)
              }}
            />
          ))}

          {recordsLoading && records.length === 0 && (
            <div className="record-page__loading" role="status">
              Loading {feature.itemPlural}…
            </div>
          )}

          {!recordsLoading && records.length === 0 && !recordsError && (
            <div className="record-page__loading">
              {activeSearch
                ? 'No matching records found.'
                : `No ${feature.itemPlural} found.`}
            </div>
          )}
        </div>
      ) : metadata ? (
        <RecordTable
          fields={metadata.fields}
          records={records}
          loading={recordsLoading}
        />
      ) : null}

      <div className="record-page__pagination">
        <span>
          {pagination
            ? `${pagination.returned} record${pagination.returned === 1 ? '' : 's'} on this page`
            : recordsLoading
              ? 'Loading records…'
              : `${records.length} records`}
        </span>

        <div className="record-page__pagination-actions">
          <button
            type="button"
            className="record-page__secondary-button"
            disabled={start === 0 || recordsLoading}
            onClick={() => {
                setRecordsLoading(true)
                setRecordsError(null)
                setStart((value) => Math.max(0, value - PAGE_LENGTH))
                }}
          >
            <i className="ri-arrow-left-line" aria-hidden="true" />
            Previous
          </button>

          <button
            type="button"
            className="record-page__secondary-button"
            disabled={
              !pagination?.has_more || recordsLoading
            }
            onClick={() => {
                if (pagination?.next_start == null) return

                setRecordsLoading(true)
                setRecordsError(null)
                setStart(pagination.next_start)
                }}
          >
            Next
            <i className="ri-arrow-right-line" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}