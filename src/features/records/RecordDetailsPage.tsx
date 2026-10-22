
import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import {
  mementoApi,
  type DocTypeMetadata,
  type MementoRecord,
} from '../../services/mementoApi'

import type { FeatureDefinition } from '../home/featureData'
import { RecordUpdateDialog } from '../../components/form/RecordUpdateDialog'

import './RecordDetailsPage.css'

gsap.registerPlugin(ScrollTrigger)

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

function getDetailIcon(label: string): string {
  const icons: Record<string, string> = {
    'PROJECT ID': 'ri-fingerprint-line',
    'TASK ID': 'ri-fingerprint-line',
    'START DATE': 'ri-calendar-event-line',
    'END DATE': 'ri-calendar-check-line',
    'FROM DATE': 'ri-calendar-event-line',
    'TO DATE': 'ri-calendar-check-line',
    CATEGORY: 'ri-folders-line',
    PRIORITY: 'ri-flag-2-line',
    STATUS: 'ri-pulse-line',
    OWNER: 'ri-user-3-line',
    PROJECT: 'ri-folder-line',
    'CREATED BY': 'ri-user-line',
  }

  return icons[label] ?? 'ri-checkbox-circle-line'
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function scrollToSection(element: HTMLElement | null) {
  if (!element) return

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  element.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  })
}

export function RecordDetailPage({
  feature,
  recordName,
  onClose,
}: RecordDetailPageProps) {
  const [record, setRecord] = useState<MementoRecord | null>(null)
  const [metadata, setMetadata] = useState<DocTypeMetadata | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const rootRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const detailSectionRef = useRef<HTMLElement>(null)
  const descriptionSectionRef = useRef<HTMLElement>(null)
  const descriptionContentRef = useRef<HTMLDivElement>(null)
  const readingProgressRef = useRef<HTMLDivElement>(null)

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

  const recordTitle = record
    ? plainText(isProject ? record.project_name : record.task_name)
    : ''

  const rawDescriptionHtml =
    typeof record?.description === 'string'
      ? record.description
      : ''

  const safeDescriptionHtml = DOMPurify.sanitize(
    rawDescriptionHtml,
    {
      USE_PROFILES: { html: true },
    },
  )

  const description = record
    ? plainText(record.description)
    : 'Not set'

  const wordCount =
    description === 'Not set'
      ? 0
      : description.split(/\s+/).filter(Boolean).length

  const readingMinutes =
    wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0

  const statusValue = record
    ? plainText(record.status)
    : 'Not set'

  const priorityValue = record
    ? plainText(isProject ? record.priority_level : record.priority)
    : 'Not set'

  const detailFields: DetailField[] = record
    ? isProject
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
    : []

  // Animate the hero and reveal detail sections with GSAP.
  useEffect(() => {
    if (loading || !record || !rootRef.current) {
      return
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduceMotion) {
      return
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          ease: 'power3.out',
        },
      })

      timeline
        .fromTo(
          '.record-detail__hero-art',
          {
            autoAlpha: 0,
            scale: 0.86,
            rotate: -7,
          },
          {
            autoAlpha: 1,
            scale: 1,
            rotate: 0,
            duration: 0.8,
          },
          0,
        )
        .fromTo(
          '.record-detail__eyebrow',
          {
            autoAlpha: 0,
            y: 10,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.35,
          },
          0.08,
        )
        .fromTo(
          '.record-detail__title-row',
          {
            autoAlpha: 0,
            y: 22,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
          },
          0.15,
        )
        .fromTo(
          '.record-detail__intro',
          {
            autoAlpha: 0,
            y: 12,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
          },
          0.3,
        )
        .fromTo(
          '.record-detail__badge',
          {
            autoAlpha: 0,
            scale: 0.92,
            y: 8,
          },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.07,
          },
          0.38,
        )
        .fromTo(
          '.record-detail__hero-foot',
          {
            autoAlpha: 0,
            y: 10,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.35,
          },
          0.48,
        )

      gsap.fromTo(
        '.record-detail__field',
        {
          autoAlpha: 0,
          y: 18,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          stagger: 0.065,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: detailSectionRef.current,
            start: 'top 82%',
            once: true,
          },
        },
      )

      gsap.fromTo(
        '.record-detail__reading-card',
        {
          autoAlpha: 0,
          y: 22,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: descriptionSectionRef.current,
            start: 'top 85%',
            once: true,
          },
        },
      )
    }, rootRef)

    return () => {
      context.revert()
    }
  }, [loading, record, recordName])

  // Update the description reading progress without forcing a React
  // render for every scroll event.
  useEffect(() => {
    const section = descriptionSectionRef.current
    const progressBar = readingProgressRef.current

    if (!section || !progressBar) return

    const updateProgress = () => {
      const bounds = section.getBoundingClientRect()
      const totalDistance = bounds.height + window.innerHeight
      const travelled = window.innerHeight - bounds.top

      const progress = totalDistance > 0
        ? Math.round(
            Math.max(0, Math.min(100, (travelled / totalDistance) * 100)),
          )
        : 0

      progressBar.style.width = `${progress}%`
      progressBar.setAttribute('aria-valuenow', String(progress))
    }

    updateProgress()

    window.addEventListener('scroll', updateProgress, {
      passive: true,
    })
    window.addEventListener('resize', updateProgress)

    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [safeDescriptionHtml, recordName])

  // Make embedded description images open in an accessible preview.
  useEffect(() => {
    const container = descriptionContentRef.current
    if (!container) return

    const images = Array.from(container.querySelectorAll('img'))

    const cleanups = images.map((image) => {
      const previousTabIndex = image.getAttribute('tabindex')
      const previousRole = image.getAttribute('role')
      const previousLabel = image.getAttribute('aria-label')

      image.setAttribute('tabindex', '0')
      image.setAttribute('role', 'button')
      image.setAttribute(
        'aria-label',
        image.alt.trim()
          ? `Enlarge image: ${image.alt}`
          : 'Enlarge description image',
      )

      const openPreview = () => {
        const source = image.currentSrc || image.src
        if (source) setImagePreview(source)
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPreview()
        }
      }

      image.addEventListener('click', openPreview)
      image.addEventListener('keydown', handleKeyDown)

      return () => {
        image.removeEventListener('click', openPreview)
        image.removeEventListener('keydown', handleKeyDown)

        if (previousTabIndex === null) {
          image.removeAttribute('tabindex')
        } else {
          image.setAttribute('tabindex', previousTabIndex)
        }

        if (previousRole === null) {
          image.removeAttribute('role')
        } else {
          image.setAttribute('role', previousRole)
        }

        if (previousLabel === null) {
          image.removeAttribute('aria-label')
        } else {
          image.setAttribute('aria-label', previousLabel)
        }
      }
    })

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [safeDescriptionHtml, loading, recordName])

  // Allow Escape to close an enlarged image.
  useEffect(() => {
    if (!imagePreview) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImagePreview(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [imagePreview])

  async function handleCopyRecordId() {
    if (!record) return

    try {
      await navigator.clipboard.writeText(record.name)
      setCopyMessage('Record ID copied')
    } catch {
      setCopyMessage('Unable to copy automatically')
    }
  }

  if (loading) {
    return (
      <section className="record-detail record-detail--state">
        <div className="record-detail__state-indicator" aria-hidden="true">
          <span />
        </div>
        <p role="status">Preparing your {isProject ? 'project' : 'task'} details…</p>
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
            Try again
          </button>
        </div>
      </section>
    )
  }

  const displayTitle = recordTitle === 'Not set'
    ? record.name
    : recordTitle

  return (
    <article
      ref={rootRef}
      className="record-detail"
      data-record-type={feature.id}
      aria-labelledby="record-detail-title"
    >
      <div className="record-detail__actions">
        <button
          type="button"
          className="record-detail__secondary"
          onClick={onClose}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to {feature.itemPlural}
        </button>

        <div className="record-detail__actions-spacer" />

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

      {updateMessage && (
        <div className="record-detail__notice" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{updateMessage}</span>
          <button
            type="button"
            className="record-detail__notice-dismiss"
            aria-label="Dismiss notification"
            onClick={() => setUpdateMessage(null)}
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>
      )}

      <header
        ref={headerRef}
        className="record-detail__header"
      >
        <div className="record-detail__hero-art" aria-hidden="true">
          <span className="record-detail__hero-orb record-detail__hero-orb--one" />
          <span className="record-detail__hero-orb record-detail__hero-orb--two" />
          <span className="record-detail__hero-grid" />
        </div>

        <div className="record-detail__hero-content">
          <div className="record-detail__eyebrow">
            <span>MEMENTO</span>
            <i className="ri-arrow-right-s-line" aria-hidden="true" />
            <span>{isProject ? 'PROJECTS' : 'TASKS'}</span>
            <i className="ri-arrow-right-s-line" aria-hidden="true" />
            <span className="record-detail__eyebrow-id">{record.name}</span>
          </div>

          <div className="record-detail__title-row">
            <div
              className="record-detail__hero-icon"
              aria-hidden="true"
            >
              <i
                className={
                  isProject
                    ? 'ri-folders-line'
                    : 'ri-task-line'
                }
              />
            </div>

            <div className="record-detail__title-copy">
              <h1 id="record-detail-title">
                {displayTitle}
              </h1>

              <p className="record-detail__type-label">
                {isProject ? 'PROJECT OVERVIEW' : 'TASK OVERVIEW'}
                <span aria-hidden="true"> · </span>
                Your workspace, in detail
              </p>
            </div>
          </div>

          {description !== 'Not set' && (
            <p className="record-detail__intro">
              {description.length > 240
                ? `${description.slice(0, 240).trimEnd()}…`
                : description}
            </p>
          )}

          <div className="record-detail__badges">
            {statusValue !== 'Not set' && (
              <span
                className={`record-detail__badge record-detail__badge--status record-detail__badge--${slugify(statusValue)}`}
              >
                <span className="record-detail__badge-dot" aria-hidden="true" />
                {statusValue}
              </span>
            )}

            {priorityValue !== 'Not set' && (
              <span
                className={`record-detail__badge record-detail__badge--priority record-detail__badge--${slugify(priorityValue)}`}
              >
                <i className="ri-flag-2-line" aria-hidden="true" />
                {priorityValue} priority
              </span>
            )}
          </div>

          <div className="record-detail__hero-foot">
            <div className="record-detail__record-reference">
              <span className="record-detail__record-reference-icon">
                <i className="ri-hashtag" aria-hidden="true" />
              </span>

              <span className="record-detail__record-reference-copy">
                <span>RECORD ID</span>
                <strong>{record.name}</strong>
              </span>

              <button
                type="button"
                className="record-detail__copy-button"
                onClick={() => void handleCopyRecordId()}
                aria-label="Copy record ID"
                title="Copy record ID"
              >
                <i
                  className={
                    copyMessage === 'Record ID copied'
                      ? 'ri-check-line'
                      : 'ri-file-copy-line'
                  }
                  aria-hidden="true"
                />
              </button>
            </div>

            <button
              type="button"
              className="record-detail__read-button"
              onClick={() => scrollToSection(descriptionSectionRef.current)}
            >
              Explore description
              <i className="ri-arrow-down-line" aria-hidden="true" />
            </button>
          </div>

          {copyMessage && (
            <p className="record-detail__copy-feedback" role="status">
              {copyMessage}
            </p>
          )}
        </div>
      </header>

      {/* <nav
        className="record-detail__section-nav"
        aria-label="Record sections"
      >
        <span className="record-detail__section-nav-label">
          EXPLORE THIS RECORD
        </span>

        <button
          type="button"
          onClick={() => scrollToSection(headerRef.current)}
        >
          <i className="ri-layout-top-line" aria-hidden="true" />
          Overview
        </button>

        <button
          type="button"
          onClick={() => scrollToSection(detailSectionRef.current)}
        >
          <i className="ri-list-check-2" aria-hidden="true" />
          Details
        </button>

        <button
          type="button"
          onClick={() => scrollToSection(descriptionSectionRef.current)}
        >
          <i className="ri-book-open-line" aria-hidden="true" />
          Description
        </button>
      </nav> */}

      <section
        ref={descriptionSectionRef}
        className="record-detail__section record-detail__description-section"
        aria-labelledby="record-detail-description-heading"
      >
        <div className="record-detail__section-heading record-detail__description-heading">
          <div>
            <span className="record-detail__section-index">01 / THE FULL STORY</span>

            <h2 id="record-detail-description-heading">
              {isProject ? 'Project description' : 'Task description'}
            </h2>

            <p>
              Take a closer look at the context, notes, and information
              saved with this record.
            </p>
          </div>

          <span className="record-detail__section-symbol" aria-hidden="true">
            <i className="ri-book-open-line" />
          </span>
        </div>

        <div className="record-detail__reading-card">
          <div className="record-detail__reading-topline">
            <div className="record-detail__reading-label">
              <span className="record-detail__reading-icon" aria-hidden="true">
                <i className="ri-book-2-line" />
              </span>

              <span>
                <strong>Project notes</strong>
                <small>
                  {wordCount > 0
                    ? `${wordCount.toLocaleString('en-IN')} words`
                    : 'Record description'}
                  {readingMinutes > 0
                    ? ` · ${readingMinutes} min read`
                    : ''}
                </small>
              </span>
            </div>

            <span className="record-detail__reading-hint">
              <i className="ri-focus-3-line" aria-hidden="true" />
              Reading view
            </span>
          </div>

          <div
            className="record-detail__reading-progress"
            role="progressbar"
            aria-label="Description reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
          >
            <div
              ref={readingProgressRef}
              className="record-detail__reading-progress-fill"
            />
          </div>

          {safeDescriptionHtml.trim() && description !== 'Not set' ? (
            <div
              ref={descriptionContentRef}
              className="record-detail__description"
              dangerouslySetInnerHTML={{
                __html: safeDescriptionHtml,
              }}
            />
          ) : (
            <div className="record-detail__empty-description">
              <span className="record-detail__empty-icon" aria-hidden="true">
                <i className="ri-quill-pen-line" />
              </span>

              <h3>Nothing written here yet</h3>

              <p>
                Add a description to capture important context, links,
                images, and notes for this {isProject ? 'project' : 'task'}.
              </p>

              {metadata?.capabilities.can_update && (
                <button
                  type="button"
                  className="record-detail__empty-action"
                  onClick={() => setIsUpdateOpen(true)}
                >
                  <i className="ri-edit-line" aria-hidden="true" />
                  Add description
                </button>
              )}
            </div>
          )}

          <div className="record-detail__reading-footer">
            <span>
              <i className="ri-shield-check-line" aria-hidden="true" />
              End of description
            </span>

            <button
              type="button"
              onClick={() => scrollToSection(headerRef.current)}
            >
              Back to top
              <i className="ri-arrow-up-line" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>


      <section
        ref={detailSectionRef}
        className="record-detail__section"
        aria-labelledby="record-detail-fields-heading"
      >
        <div className="record-detail__section-heading">
          <div>
            <span className="record-detail__section-index">02 / THE BASICS</span>

            <h2 id="record-detail-fields-heading">
              {isProject ? 'Project details' : 'Task details'}
            </h2>

            <p>
              Everything important about this {isProject ? 'project' : 'task'},
              organised in one place.
            </p>
          </div>

          <span className="record-detail__section-symbol" aria-hidden="true">
            <i className="ri-layout-grid-line" />
          </span>
        </div>

        <div className="record-detail__grid">
          {detailFields.map((field, index) => (
            <div
              className="record-detail__field"
              key={field.label}
              data-field-index={index}
            >
              <div className="record-detail__field-icon" aria-hidden="true">
                <i className={getDetailIcon(field.label)} />
              </div>

              <div className="record-detail__field-copy">
                <span>{field.label}</span>
                <strong>{field.value}</strong>
              </div>

              <span className="record-detail__field-decoration" aria-hidden="true">
                <i className="ri-arrow-up-right-line" />
              </span>
            </div>
          ))}
        </div>
      </section>






      {imagePreview && (
        <div className="record-detail__image-preview">
          <button
            type="button"
            className="record-detail__image-backdrop"
            aria-label="Close image preview"
            onClick={() => setImagePreview(null)}
          />

          <div
            className="record-detail__image-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-detail-image-title"
          >
            <div className="record-detail__image-dialog-header">
              <div>
                <span>IMAGE PREVIEW</span>
                <h2 id="record-detail-image-title">
                  {displayTitle}
                </h2>
              </div>

              <button
                type="button"
                className="record-detail__image-close"
                onClick={() => setImagePreview(null)}
                aria-label="Close image preview"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <img
              src={imagePreview}
              alt={`Description image from ${displayTitle}`}
            />
          </div>
        </div>
      )}

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
