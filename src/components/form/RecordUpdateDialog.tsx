import { useEffect, useRef } from 'react'

import type {
  RecordMutationResult,
} from '../../services/mementoApi'

import type { FeatureDefinition } from '../../features/home/featureData'
import { MetadataDrivenForm } from './MetadataDrivenForm'

import './RecordUpdateDialog.css'

interface RecordUpdateDialogProps {
  feature: FeatureDefinition
  recordName: string
  onClose: () => void
  onUpdated: (record: RecordMutationResult) => void
}

export function RecordUpdateDialog({
  feature,
  recordName,
  onClose,
  onUpdated,
}: RecordUpdateDialogProps) {
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
      className="record-update-dialog__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="record-update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-update-dialog-title"
      >
        <header className="record-update-dialog__header">
          <div>
            <span className="record-update-dialog__eyebrow">
              MEMENTO / {feature.doctype.toUpperCase()}
            </span>

            <h2 id="record-update-dialog-title">
              Update {feature.id === 'projects' ? 'project' : 'task'}
            </h2>

            <p>{recordName}</p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="record-update-dialog__close"
            onClick={onClose}
            aria-label="Close update dialog"
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </header>

        <MetadataDrivenForm
          doctype={feature.doctype}
          mode="update"
          recordName={recordName}
          onCancel={onClose}
          onSuccess={onUpdated}
        />
      </section>
    </div>
  )
}