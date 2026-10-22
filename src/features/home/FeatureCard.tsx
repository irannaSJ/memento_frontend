import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useNavigate } from 'react-router-dom'

import {
  mementoApi,
  type MementoRecord,
} from '../../services/mementoApi'

import type { FeatureDefinition } from './featureData'

import './FeatureCard.css'

const MAX_PREVIEW_RECORDS = 5
const PREVIEW_INTERVAL = 2

interface FeatureCardProps {
  feature: FeatureDefinition
  onView: () => void
  onCreate: () => void
}

function plainText(value: unknown): string {
  if (value === null || value === undefined) return ''

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(plainText).filter(Boolean).join(', ')
  }

  if (typeof value !== 'string') return ''

  const text = value.trim()

  if (!text) return ''

  if (
    typeof DOMParser !== 'undefined' &&
    text.includes('<') &&
    text.includes('>')
  ) {
    return (
      new DOMParser()
        .parseFromString(text, 'text/html')
        .body.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim()
  }

  return text.replace(/\s+/g, ' ').trim()
}

function getTitle(
  feature: FeatureDefinition,
  record: MementoRecord,
): string {
  const fields: Record<FeatureDefinition['id'], string> = {
    projects: 'project_name',
    tasks: 'task_name',
    todo: 'description',
    activity: 'task_id',
  }

  const title = plainText(record[fields[feature.id]])

  if (title) return title

  if (feature.id === 'activity') {
    const date = plainText(record.today)
    return date ? `Activity on ${date}` : record.name
  }

  return record.name
}

function getDescription(
  feature: FeatureDefinition,
  record: MementoRecord,
): string {
  if (feature.id === 'projects') {
    return (
      plainText(record.description) ||
      'Project overview and planning details.'
    )
  }

  if (feature.id === 'tasks') {
    return (
      plainText(record.description) ||
      'Task details and progress.'
    )
  }

  if (feature.id === 'todo') {
    return (
      plainText(record.description) ||
      'Daily to-do details.'
    )
  }

  return 'Activity record and related work.'
}

function getDetails(
  feature: FeatureDefinition,
  record: MementoRecord,
): { label: string; value: string }[] {
  if (feature.id === 'projects') {
    return [
      { label: 'CATEGORY', value: plainText(record.category) },
      {
        label: 'PRIORITY',
        value: plainText(record.priority_level),
      },
      { label: 'START DATE', value: plainText(record.start_date) },
    ].filter((item) => item.value)
  }

  if (feature.id === 'tasks') {
    return [
      { label: 'PROJECT', value: plainText(record.project) },
      { label: 'PRIORITY', value: plainText(record.priority) },
      { label: 'START DATE', value: plainText(record.from_date) },
    ].filter((item) => item.value)
  }

  if (feature.id === 'todo') {
    return [
      { label: 'DATE', value: plainText(record.date) },
      { label: 'PRIORITY', value: plainText(record.priority) },
      { label: 'ASSIGNED TO', value: plainText(record.allocated_to) },
    ].filter((item) => item.value)
  }

  return [
    { label: 'DATE', value: plainText(record.today) },
    { label: 'TASK', value: plainText(record.task_id) },
  ].filter((item) => item.value)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unable to load the live preview.'
}

export function FeatureCard({
  feature,
  onView,
  onCreate,
}: FeatureCardProps) {
  const navigate = useNavigate()

  const [records, setRecords] = useState<MementoRecord[]>([])
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  const mockupRef = useRef<HTMLDivElement>(null)
  const exitTweenRef = useRef<gsap.core.Tween | null>(null)

  const activeRecord = records[activeIndex] ?? null

  // Load no more than five records for the preview.
  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)
    setRecords([])
    setRecordCount(null)
    setActiveIndex(0)

    void mementoApi
      .getDocTypeRecords({
        doctype: feature.doctype,
        start: 0,
        page_length: MAX_PREVIEW_RECORDS,
      })
      .then((response) => {
        if (cancelled) return

        setRecords(response.data.slice(0, MAX_PREVIEW_RECORDS))
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    void mementoApi
      .getDocTypeCount(feature.doctype)
      .then((response) => {
        if (!cancelled) {
          setRecordCount(response.data.count)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecordCount(null)
        }
      })

    return () => {
      cancelled = true
      exitTweenRef.current?.kill()
      exitTweenRef.current = null
    }
  }, [feature.doctype])

  // Animate the entire mockup, not its internal content.
  useLayoutEffect(() => {
    const mockup = mockupRef.current

    if (!mockup || !activeRecord) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduceMotion || records.length <= 1) {
      gsap.set(mockup, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
      })
      return
    }

    gsap.fromTo(
      mockup,
      {
        autoAlpha: 0,
        x: 18,
        y: 5,
        scale: 0.98,
      },
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.45,
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility',
      },
    )

    return () => {
      gsap.killTweensOf(mockup)
    }
  }, [activeRecord, records.length])

  // Advance to the next record only when multiple records exist.
  useEffect(() => {
    if (
      loading ||
      paused ||
      records.length <= 1 ||
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
    ) {
      return
    }

    const timer = gsap.delayedCall(PREVIEW_INTERVAL, () => {
      const mockup = mockupRef.current

      if (!mockup) {
        setActiveIndex((index) => (index + 1) % records.length)
        return
      }

      exitTweenRef.current = gsap.to(mockup, {
        autoAlpha: 0,
        x: -18,
        y: -5,
        scale: 0.98,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          setActiveIndex((index) => (index + 1) % records.length)
        },
      })
    })

    return () => {
      timer.kill()
      exitTweenRef.current?.kill()
      exitTweenRef.current = null
    }
  }, [activeIndex, loading, paused, records.length])

  function openRecord() {
    if (!activeRecord) return

    navigate(
      `/${feature.id}/${encodeURIComponent(activeRecord.name)}`,
    )
  }

  function pausePreview() {
    setPaused(true)
  }

  function resumePreview() {
    setPaused(false)
  }

  const recordTitle = activeRecord
    ? getTitle(feature, activeRecord)
    : ''

  const recordStatus = activeRecord
    ? plainText(activeRecord.status) ||
      (feature.id === 'activity' ? 'ACTIVITY' : 'RECORD')
    : ''

  const recordDetails = activeRecord
    ? getDetails(feature, activeRecord)
    : []

  return (
    <article
      id={`feature-card-${feature.id}`}
      className={`feature-card feature-card--${feature.layout}`}
      data-tone={feature.tone}
      data-feature-id={feature.id}
      aria-labelledby={`feature-title-${feature.id}`}
    >
      <div className="feature-card__visual">
        <div className="feature-card__visual-caption">
          <span>MEMENTO / {feature.number}</span>

          <span className="feature-card__preview-label">
            <span className="feature-card__status-dot" />
            LIVE PREVIEW
          </span>
        </div>

        <div className="feature-card__visual-main">
          <div
            className="feature-card__orb feature-card__orb--one"
            aria-hidden="true"
          />

          <div
            className="feature-card__orb feature-card__orb--two"
            aria-hidden="true"
          />

          {/* This entire rounded card changes for each record. */}
          <div
            ref={mockupRef}
            className="feature-card__mockup feature-card__record-mockup"
          >
            <div className="feature-card__mockup-header">
              <span className="feature-card__mockup-brand">
                <i className={feature.icon} aria-hidden="true" />
                <span>{feature.visualLabel}</span>
              </span>

              <span className="feature-card__record-number">
                {records.length > 0
                  ? `${String(activeIndex + 1).padStart(2, '0')} / ${String(records.length).padStart(2, '0')}`
                  : 'LIVE'}
              </span>
            </div>

            {loading ? (
              <div className="feature-card__record-state" role="status">
                Loading records…
              </div>
            ) : error ? (
              <div className="feature-card__record-state" role="status">
                {error}
              </div>
            ) : !activeRecord ? (
              <div className="feature-card__record-state">
                No {feature.itemPlural} available.
              </div>
            ) : (
              <button
                type="button"
                className="feature-card__record-content"
                onClick={openRecord}
                aria-label={`Open ${recordTitle}`}
                onMouseEnter={pausePreview}
                onMouseLeave={resumePreview}
                onFocus={pausePreview}
                onBlur={resumePreview}
              >
                <div className="feature-card__record-heading">
                  <div className="feature-card__metric-icon">
                    <i className={feature.icon} aria-hidden="true" />
                  </div>

                  <div className="feature-card__record-title-wrap">
                    <span className="feature-card__record-kicker">
                      {feature.id === 'projects'
                        ? 'PROJECT DETAILS'
                        : feature.id === 'tasks'
                          ? 'TASK DETAILS'
                          : feature.id === 'todo'
                            ? 'DAILY TO-DO'
                            : 'ACTIVITY DETAILS'}
                    </span>

                    <strong className="feature-card__record-title">
                      {recordTitle}
                    </strong>
                  </div>

                  <span className="feature-card__row-status">
                    {recordStatus}
                  </span>
                </div>

                <p className="feature-card__record-description">
                  {getDescription(feature, activeRecord)}
                </p>

                <div className="feature-card__record-details">
                  {recordDetails.map((detail) => (
                    <div
                      className="feature-card__record-detail-item"
                      key={detail.label}
                    >
                      <span>{detail.label}</span>
                      <strong>{detail.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="feature-card__record-footer">
                  <span>
                    {recordCount === null
                      ? 'WORKSPACE RECORD'
                      : `${recordCount.toLocaleString('en-IN')} TOTAL RECORDS`}
                  </span>

                  <span className="feature-card__record-open">
                    Open record
                    <i
                      className="ri-arrow-up-right-line"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="feature-card__visual-footer">
          <span>YOUR WORKSPACE, IN SYNC</span>
          <span>{feature.number} / 04</span>
        </div>
      </div>

      <div className="feature-card__content">
        <div className="feature-card__heading-row">
          <span className="feature-card__number">
            {feature.number}
          </span>

          <span className="feature-card__eyebrow">
            {feature.eyebrow}
          </span>
        </div>

        <h2
          className="feature-card__title"
          id={`feature-title-${feature.id}`}
        >
          {feature.title}
        </h2>

        <p className="feature-card__description">
          {feature.description}
        </p>

        <div className="feature-card__capabilities">
          {feature.capabilities.map((capability) => (
            <span
              className="feature-card__capability"
              key={capability}
            >
              <i className="ri-check-line" aria-hidden="true" />
              {capability}
            </span>
          ))}
        </div>

        <div className="feature-card__actions">
          <button
            className="feature-card__button feature-card__button--secondary"
            type="button"
            onClick={onView}
          >
            <span>{feature.viewLabel}</span>
            <i
              className="ri-arrow-up-right-line"
              aria-hidden="true"
            />
          </button>

          <button
            className="feature-card__button feature-card__button--primary"
            type="button"
            onClick={onCreate}
          >
            <i className="ri-add-line" aria-hidden="true" />
            <span>{feature.createLabel}</span>
          </button>
        </div>
      </div>
    </article>
  )
}