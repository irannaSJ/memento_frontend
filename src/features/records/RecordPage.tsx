import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import { useLocation, useNavigate } from 'react-router-dom'

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

const FILTER_FIELDS_BY_FEATURE: Record<
  FeatureDefinition['id'],
  string[]
> = {
  projects: ['status', 'category', 'priority_level'],
  tasks: ['status', 'priority', 'project'],
  todo: ['status', 'priority', 'date'],
  activity: ['task_id', 'today'],
}

const LINK_FILTER_DOCTYPES: Partial<
  Record<FeatureDefinition['id'], Record<string, string>>
> = {
  tasks: {
    project: 'My Projects',
  },
  activity: {
    task_id: 'Tasks',
  },
}

interface FilterOption {
  value: string
  label: string
}

function getSelectOptions(options: unknown): string[] {
  if (typeof options !== 'string') return []

  return options
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean)
}



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

  const location = useLocation()

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )

  const activeFilters = useMemo<Record<string, unknown>>(() => {
    const result: Record<string, unknown> = {}

    for (const fieldname of FILTER_FIELDS_BY_FEATURE[feature.id]) {
      const value = queryParams.get(fieldname)

      if (value) {
        result[fieldname] = value
      }
    }

    return result
  }, [feature.id, queryParams])

  const [linkFilterOptions, setLinkFilterOptions] =
    useState<Record<string, FilterOption[]>>({})

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

  const relationContext = useMemo(() => {
    if (feature.id === 'tasks') {
      const project = queryParams.get('project')
      if (project) {
        return {
          fieldname: 'project',
          label: queryParams.get('project_label') || project,
          message: 'Tasks for project',
        }
      }
    }

    if (feature.id === 'activity') {
      const task = queryParams.get('task_id')
      if (task) {
        return {
          fieldname: 'task_id',
          label: queryParams.get('task_label') || task,
          message: 'Activity for task',
        }
      }
    }

    return null
  }, [feature.id, queryParams])

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
    setMetadataLoading(true)
    setMetadataError(null)

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

  // Load records whenever search, filters, page, feature, or refresh state changes.
  useEffect(() => {
    let cancelled = false
    setRecordsLoading(true)
    setRecordsError(null)

    void mementoApi.getDocTypeRecords({
        doctype,
        start,
        page_length: PAGE_LENGTH,
        ...(activeSearch ? { search: activeSearch } : {}),
        ...(Object.keys(activeFilters).length > 0
          ? { filters: activeFilters }
          : {}),
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
  }, [doctype, start, activeSearch, activeFilters, recordsRefreshKey])



  useEffect(() => {
    setStart(0)
    setRecordsError(null)
  }, [feature.id, location.search])

  useEffect(() => {
    let cancelled = false

    async function loadLinkFilterOptions() {
      const linkedDoctypes =
        LINK_FILTER_DOCTYPES[feature.id] ?? {}

      const entries = await Promise.all(
        Object.entries(linkedDoctypes).map(
          async ([fieldname, linkedDoctype]) => {
            try {
              const response = await mementoApi.getDocTypeRecords({
                doctype: linkedDoctype,
                start: 0,
                page_length: 100,
              })

              const choices: FilterOption[] = response.data.map(
                (record) => ({
                  value: record.name,
                  label: String(
                    record.project_name ??
                      record.task_name ??
                      record.name,
                  ),
                }),
              )

              return [fieldname, choices] as const
            } catch {
              return [fieldname, [] as FilterOption[]] as const
            }
          },
        ),
      )

      if (cancelled) return

      const nextOptions: Record<string, FilterOption[]> = {}

      for (const [fieldname, choices] of entries) {
        nextOptions[fieldname] = choices
      }

      setLinkFilterOptions(nextOptions)
    }

    void loadLinkFilterOptions()

    return () => {
      cancelled = true
    }
  }, [feature.id])



  function updateFilter(fieldname: string, value: string) {
    const params = new URLSearchParams(location.search)

    if (value) {
      params.set(fieldname, value)
    } else {
      params.delete(fieldname)
    }

    // Keep the selected project's/task's readable label in the URL.
    const contextLabelKey =
      feature.id === 'tasks' && fieldname === 'project'
        ? 'project_label'
        : feature.id === 'activity' && fieldname === 'task_id'
          ? 'task_label'
          : null

    if (contextLabelKey) {
      const option = linkFilterOptions[fieldname]?.find(
        (item) => item.value === value,
      )

      if (option) {
        params.set(contextLabelKey, option.label)
      } else if (!value) {
        params.delete(contextLabelKey)
      }
    }

    setStart(0)
    setRecordsLoading(true)
    setRecordsError(null)

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    )
  }

  function clearFilters() {
    const params = new URLSearchParams(location.search)

    for (const fieldname of FILTER_FIELDS_BY_FEATURE[feature.id]) {
      params.delete(fieldname)
    }

    params.delete('project_label')
    params.delete('task_label')

    setStart(0)
    setRecordsLoading(true)
    setRecordsError(null)

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    )
  }





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

  // const pageNumber = Math.floor(start / PAGE_LENGTH) + 1

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



        <div className="record-page__filters">
          <div className="record-page__filters-heading">
            <i className="ri-equalizer-2-line" aria-hidden="true" />
            <span>Filter records</span>
          </div>

          {FILTER_FIELDS_BY_FEATURE[feature.id]
            .map((fieldname) =>
              metadata?.fields.find(
                (field) => field.fieldname === fieldname,
              ),
            )
            .filter((field) => field && !field.hidden)
            .map((field) => {
              if (!field) return null

              const fieldname = field.fieldname
              const value = String(activeFilters[fieldname] ?? '')
              const options = getSelectOptions(
                'options' in field ? field.options : undefined
              )
              const linkOptions = linkFilterOptions[fieldname] ?? []

              const selectedLabel =
                fieldname === 'project'
                  ? queryParams.get('project_label')
                  : fieldname === 'task_id'
                    ? queryParams.get('task_label')
                    : null

              const choices =
                value && !linkOptions.some((option) => option.value === value)
                  ? [
                      {
                        value,
                        label: selectedLabel || value,
                      },
                      ...linkOptions,
                    ]
                  : linkOptions

              return (
                <label
                  className="record-page__filter-field"
                  key={fieldname}
                >
                  <span>{field.label}</span>

                  {field.fieldtype === 'Select' ? (
                    <select
                      value={value}
                      onChange={(event) =>
                        updateFilter(fieldname, event.target.value)
                      }
                    >
                      <option value="">All {field.label}</option>

                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.fieldtype === 'Date' ? (
                    <input
                      type="date"
                      value={value}
                      aria-label={`Filter by ${field.label}`}
                      onChange={(event) =>
                        updateFilter(fieldname, event.target.value)
                      }
                    />
                  ) : field.fieldtype === 'Link' ? (
                    <select
                      value={value}
                      onChange={(event) =>
                        updateFilter(fieldname, event.target.value)
                      }
                    >
                      <option value="">
                        All {field.label}
                      </option>

                      {choices.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={value}
                      aria-label={`Filter by ${field.label}`}
                      placeholder={`Enter ${field.label}`}
                      onChange={(event) =>
                        updateFilter(fieldname, event.target.value)
                      }
                    />
                  )}
                </label>
              )
            })}

          {Object.keys(activeFilters).length > 0 && (
            <button
              type="button"
              className="record-page__clear-filters"
              onClick={clearFilters}
            >
              <i className="ri-close-line" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>

        {relationContext && (
          <div className="record-page__relation-context" role="status">
            <div>
              <span>{relationContext.message}</span>
              <strong>{relationContext.label}</strong>
            </div>
            <button type="button" onClick={() => {
              const params = new URLSearchParams(location.search)
              params.delete(relationContext.fieldname)
              params.delete(feature.id === 'tasks' ? 'project_label' : 'task_label')
              setStart(0)
              setRecordsLoading(true)
              setRecordsError(null)
              navigate({
                pathname: location.pathname,
                search: params.toString() ? `?${params.toString()}` : '',
              }, { replace: true })
            }}>
              Show all {feature.id === 'tasks' ? 'tasks' : 'activity'}
            </button>
          </div>
        )}
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

      {/* <div className="record-page__summary">
        <div>
          <span className="record-page__summary-label">CURRENT PAGE</span>
          <strong>{String(pageNumber).padStart(2, '0')}</strong>
        </div>

        <span className="record-page__summary-note">
          {activeSearch
            ? `Search results for “${activeSearch}”`
            : relationContext
              ? `${relationContext.message}: ${relationContext.label}`
              : Object.keys(activeFilters).length > 0
                ? 'Filtered workspace records'
                : 'Workspace records'}
        </span>
      </div> */}

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
              onCardClick={() => {
                if (feature.id === 'projects') {
                  const projectLabel = String(
                    record.project_name ?? record.name,
                  )

                  navigate(
                    `/tasks?project=${encodeURIComponent(record.name)}&project_label=${encodeURIComponent(projectLabel)}`,
                  )

                  return
                }

                if (feature.id === 'tasks') {
                  const taskLabel = String(
                    record.task_name ?? record.name,
                  )

                  navigate(
                    `/activity?task_id=${encodeURIComponent(record.name)}&task_label=${encodeURIComponent(taskLabel)}`,
                  )
                }
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
