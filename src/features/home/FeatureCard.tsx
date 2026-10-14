import type { FeatureDefinition } from './featureData'
import './FeatureCard.css'

interface FeatureCardProps {
  feature: FeatureDefinition
  onView: () => void
  onCreate: () => void
}

export function FeatureCard({
  feature,
  onView,
  onCreate,
}: FeatureCardProps) {
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

          <div className="feature-card__mockup">
            <div className="feature-card__mockup-header">
              <span className="feature-card__mockup-brand">
                <i className={feature.icon} aria-hidden="true" />
                <span>{feature.visualLabel}</span>
              </span>

              <i
                className="ri-more-2-fill"
                aria-hidden="true"
              />
            </div>

            <div className="feature-card__metric">
              <div className="feature-card__metric-icon">
                <i className={feature.icon} aria-hidden="true" />
              </div>

              <div className="feature-card__metric-copy">
                <span>{feature.metricLabel}</span>
                <strong>{feature.metricValue}</strong>
              </div>

              <span className="feature-card__metric-decoration">
                <i className="ri-arrow-up-right-line" aria-hidden="true" />
              </span>
            </div>

            <div className="feature-card__mockup-list">
              {feature.sampleItems.slice(0, 3).map((item) => (
                <div
                  className="feature-card__mockup-row"
                  key={item.id}
                >
                  <span
                    className="feature-card__row-dot"
                    aria-hidden="true"
                  />

                  <div className="feature-card__row-copy">
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                  </div>

                  <span className="feature-card__row-status">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
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
            <i className="ri-arrow-up-right-line" aria-hidden="true" />
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