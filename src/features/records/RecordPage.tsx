import { useEffect, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import { useNavigate } from 'react-router-dom'

import {
  mementoApi,
  type DocTypeMetadata,
  type MementoRecord,
  type PaginationInfo,
} from '../../services/mementoApi'
import type { FeatureDefinition } from '../home/featureData'
import { RecordTable } from '../../components/list/RecordTable'
import { RecordCard } from '../../components/list/RecordCard'
import { RecordUpdateDialog } from '../../components/form/RecordUpdateDialog'

import './RecordPage.css'

const PAGE_LENGTH = 20

interface RecordPageProps {
  feature: FeatureDefinition
  onBack: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong while loading records.'
}

export function RecordPage({ feature, onBack }: RecordPageProps) {
  const doctype = feature.doctype
  const navigate = useNavigate()
  const pageRef = useRef<HTMLElement>(null)

  const isCardFeature = feature.id === 'projects' || feature.id === 'tasks'

  const [metadata, setMetadata] = useState<DocTypeMetadata | null>(null)
  const [records, setRecords] = useState<MementoRecord[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [editingRecordName, setEditingRecordName] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [start, setStart] = useState(0)

  const [metadataLoading, setMetadataLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0)
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0)

  // Stores which feature has completed its top-section entrance animation.
  // This also handles navigation between Projects and Tasks when this component
  // instance is reused by the router.
  const [introFeatureId, setIntroFeatureId] = useState<string | null>(null)

  // Animate the top section of Projects and Tasks on entry.
  useEffect(() => {
    if (!isCardFeature) return

    const root = pageRef.current
    if (!root) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    // Keep content visible and skip animation for reduced-motion preferences.
    if (reduceMotion) return

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: 'power2.out' },
        onComplete: () => setIntroFeatureId(feature.id),
      })

      timeline
        .fromTo(
          '.record-page__back',
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.2 },
        )
        .fromTo(
          '.record-page__heading > *',
          { autoAlpha: 0, y: 10 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.25,
            stagger: 0.04,
          },
          '-=0.08',
        )
        .fromTo(
          '.record-page__toolbar',
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.23 },
          '-=0.08',
        )
        .fromTo(
          '.record-page__summary',
          { autoAlpha: 0, y: 6 },
          { autoAlpha: 1, y: 0, duration: 0.2 },
          '-=0.06',
        )
    }, root)

    return () => context.revert()
  }, [feature.id, isCardFeature])

  // Reveal records only after the top section has finished and the current
  // request has completed. This prevents the cards from appearing too early.
  useEffect(() => {
    if (!isCardFeature || recordsLoading || !metadata) return

    const root = pageRef.current
    if (!root) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduceMotion) return

    // If the intro has not completed for this feature, wait for its timeline.
    if (introFeatureId !== feature.id) return

    const context = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.record-card')
      if (cards.length === 0) return

      gsap.fromTo(
        cards,
        {
          autoAlpha: 0,
          y: 16,
          scale: 0.99,
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.3,
          stagger: 0.045,
          ease: 'power2.out',
          clearProps: 'opacity,visibility,transform',
        },
      )
    }, root)

    return () => context.revert()
  }, [
    records,
    recordsLoading,
    metadata,
    isCardFeature,
    introFeatureId,
    feature.id,
  ])

  // Load the visible list columns and field metadata.
  useEffect(() => {
    let cancelled = false

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

  // Load records whenever search, page, feature, or refresh state changes.
  useEffect(() => {
    let cancelled = false

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

    if (activeSearch === '' && start === 0) return

    setRecordsLoading(true)
    setRecordsError(null)
    setStart(0)
    setActiveSearch('')
  }

  const pageNumber = Math.floor(start / PAGE_LENGTH) + 1

  return (
    <section
      ref={pageRef}
      className="record-page"
      aria-labelledby="record-page-title"
    >
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
          <span className="record-page__eyebrow">MEMENTO / WORKSPACE</span>

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
          <span className="record-page__summary-label">CURRENT PAGE</span>
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
              canUpdate={metadata.capabilities.can_update}
              updating={editingRecordName !== null}
              isUpdating={editingRecordName === record.name}
              onReadMore={() => {
                navigate(`/${feature.id}/${encodeURIComponent(record.name)}`)
              }}
              onUpdate={() => setEditingRecordName(record.name)}
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
            disabled={!pagination?.has_more || recordsLoading}
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

      {editingRecordName && (
        <RecordUpdateDialog
          key={`${feature.id}:${editingRecordName}`}
          feature={feature}
          recordName={editingRecordName}
          onClose={() => setEditingRecordName(null)}
          onUpdated={(result) => {
            setEditingRecordName(null)
            setRecordsLoading(true)
            setRecordsError(null)
            setActionMessage(`Record ${result.name} updated successfully.`)
            setRecordsRefreshKey((value) => value + 1)
          }}
        />
      )}
    </section>
  )
}
