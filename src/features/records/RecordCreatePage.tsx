import { MetadataDrivenForm } from '../../components/form/MetadataDrivenForm'
import type { FeatureDefinition } from '../home/featureData'
import './RecordCreatePage.css'

interface RecordCreatePageProps {
  feature: FeatureDefinition
  onCancel: () => void
  onCreated: () => void
}

export function RecordCreatePage({
  feature,
  onCancel,
  onCreated,
}: RecordCreatePageProps) {
  const isProject = feature.id === 'projects'

  const recordLabel = isProject
    ? 'project'
    : feature.id === 'tasks'
      ? 'task'
      : feature.id === 'todo'
        ? 'to-do item'
        : 'activity entry'

  return (
    <main
      className="record-create-page"
      aria-labelledby="record-create-title"
    >
      <div className="record-create-page__container">
        <button
          type="button"
          className="record-create-page__back"
          onClick={onCancel}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to {feature.itemPlural}
        </button>

        <header className="record-create-page__header">
          <span className="record-create-page__eyebrow">
            MEMENTO / WORKSPACE / CREATE
          </span>

          <div className="record-create-page__title-row">
            <div className="record-create-page__icon">
              <i className={feature.icon} aria-hidden="true" />
            </div>

            <div>
              <h1 id="record-create-title">
                Create {recordLabel}
              </h1>

              <p>
                Add a new {recordLabel} to your workspace.
                Complete the details below and save your record.
              </p>
            </div>
          </div>
        </header>

        <section
          className="record-create-page__form-card"
          aria-label={`${recordLabel} information`}
        >
          <div className="record-create-page__form-heading">
            <div>
              <span className="record-create-page__section-label">
                NEW RECORD
              </span>

              <h2>
                {isProject
                  ? 'Project information'
                  : `${recordLabel.charAt(0).toUpperCase()}${recordLabel.slice(1)} information`}
              </h2>

              <p>
                Fields and validation are loaded from the backend.
              </p>
            </div>

            <span className="record-create-page__form-icon">
              <i className="ri-file-list-3-line" aria-hidden="true" />
            </span>
          </div>

          <div className="record-create-page__form-body">
            <MetadataDrivenForm
              doctype={feature.doctype}
              mode="create"
              onCancel={onCancel}
              onSuccess={() => onCreated()}
            />
          </div>
        </section>

        <p className="record-create-page__footnote">
          <i className="ri-shield-check-line" aria-hidden="true" />
          Your record will be saved using Memento's existing
          backend API and permission checks.
        </p>
      </div>
    </main>
  )
}