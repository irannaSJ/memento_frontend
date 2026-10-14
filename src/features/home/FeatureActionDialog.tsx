import { useEffect, useRef } from 'react'

import type { FeatureDefinition } from './featureData'
import { MetadataDrivenForm } from '../../components/form/MetadataDrivenForm'

import './FeatureActionDialog.css'

interface FeatureActionDialogProps {
  feature: FeatureDefinition
  onClose: () => void
  onCreated: () => void
}

export function FeatureActionDialog({
  feature,
  onClose,
  onCreated,
}: FeatureActionDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="feature-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="feature-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-dialog-title"
        aria-describedby="feature-dialog-description"
      >
        <div className="feature-dialog__header">
          <div className="feature-dialog__heading">
            <span className="feature-dialog__eyebrow">
              MEMENTO WORKSPACE
            </span>

            <h2 id="feature-dialog-title">
              {feature.createDialogTitle}
            </h2>

            <p id="feature-dialog-description">
              Create a new record in {feature.doctype}.
              The available fields are loaded from Memento's backend.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            className="feature-dialog__close"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <MetadataDrivenForm
          doctype={feature.doctype}
          mode="create"
          onCancel={onClose}
          onSuccess={onCreated}
        />
      </section>
    </div>
  )
}