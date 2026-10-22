import {
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import {
  featureCards,
  type FeatureDefinition,
  // type FeatureId,
  // type FeatureRecord,
} from './featureData'

import type { NavigationItemId } from '../../components/navigation/FloatingNavigation'


import { FeatureCard } from './FeatureCard'
import './FeatureShowcase.css'

import {useNavigate} from 'react-router-dom'

gsap.registerPlugin(ScrollTrigger)

export interface FeatureNavigationRequest {
  item: NavigationItemId
  sequence: number
}

interface FeatureShowcaseProps {
  onActiveFeatureChange: (item: NavigationItemId) => void
  navigationRequest: FeatureNavigationRequest | null,
  onOpenRecords : (feature : FeatureDefinition) => void
}


// const emptyCreatedItems: Record<FeatureId, FeatureRecord[]> = {
//   projects: [],
//   tasks: [],
//   todo: [],
//   activity: [],
// }

export function FeatureShowcase({
  onActiveFeatureChange,
  navigationRequest,
  onOpenRecords,
}: FeatureShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const navigate = useNavigate()

  // const [createdItems, setCreatedItems] =
  //   useState<Record<FeatureId, FeatureRecord[]>>(
  //     emptyCreatedItems,
  //   )

  useLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>(
      '.feature-showcase__stage',
    )

    if (!stage) return

    const cards = gsap.utils.toArray<HTMLElement>(
      '.feature-card',
      stage,
    )

    if (cards.length === 0) return

    const media = gsap.matchMedia()
    let lastActiveIndex = -1

    function activateFeature(index: number) {
      const safeIndex = Math.max(
        0,
        Math.min(index, featureCards.length - 1),
      )

      if (lastActiveIndex === safeIndex) return

      lastActiveIndex = safeIndex
      setActiveIndex(safeIndex)
      onActiveFeatureChange(featureCards[safeIndex].navItem)
    }

    function setCardStack(active: number) {
      cards.forEach((card, index) => {
        const distance = Math.abs(index - active)

        const zIndex =
          index === active
            ? 30
            : index < active
              ? 20 - distance
              : 10 - distance

        card.style.zIndex = String(zIndex)
      })
    }

    media.add(
      '(min-width: 900px) and (prefers-reduced-motion: no-preference)',
      () => {
        gsap.set(cards, {
          autoAlpha: 0,
          y: 260,
          x: 0,
          scale: 0.82,
          transformOrigin: '50% 50%',
        })

        gsap.set(cards[0], {
          autoAlpha: 1,
          y: 0,
          x: 0,
          scale: 1,
        })

        // if (cards[1]) {
        //   gsap.set(cards[1], {
        //     autoAlpha: 0.34,
        //     y: 215,
        //     x: 70,
        //     scale: 0.82,
        //   })
        // }

        setCardStack(0)

        const timeline = gsap.timeline({
          scrollTrigger: {
            id: 'memento-feature-showcase',
            trigger: stage,
            start: 'top top',
            end: () =>
              `+=${window.innerHeight * (cards.length - 1)}`,
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
            invalidateOnRefresh: true,

            onEnter: () => activateFeature(0),

            onEnterBack: () =>
              activateFeature(cards.length - 1),

            onLeaveBack: () => {
              lastActiveIndex = -1
              setActiveIndex(0)
              onActiveFeatureChange('dashboard')
              setCardStack(0)
            },

            onLeave: () =>
              activateFeature(cards.length - 1),

            onUpdate: (self) => {
              if (!self.isActive) return

              const nextIndex = Math.round(
                self.progress * (cards.length - 1),
              )

              if (nextIndex !== lastActiveIndex) {
                activateFeature(nextIndex)
                setCardStack(nextIndex)
              }
            },
          },
        })

        for (let index = 0; index < cards.length - 1; index += 1) {
          const currentCard = cards[index]
          const nextCard = cards[index + 1]
          const nextPreviewCard = cards[index + 2]

          const exitDirection =
            index % 2 === 0 ? -65 : 65

          timeline.to(
            currentCard,
            {
              autoAlpha: 0,
              y: -210,
              x: exitDirection,
              scale: 0.78,
              duration: 1,
              ease: 'power2.inOut',
            },
            index,
          )

          timeline.to(
            nextCard,
            {
              autoAlpha: 1,
              y: 0,
              x: 0,
              scale: 1,
              duration: 1,
              ease: 'power2.inOut',
            },
            index,
          )

          if (nextPreviewCard) {
            const previewDirection =
              (index + 2) % 2 === 0 ? -70 : 70

            timeline.to(
              nextPreviewCard,
              {
                autoAlpha: 0.34,
                y: 215,
                x: previewDirection,
                scale: 0.82,
                duration: 1,
                ease: 'power2.inOut',
              },
              index,
            )
          }
        }

        return () => {
          cards.forEach((card) => {
            card.style.removeProperty('z-index')
          })
        }
      },
    )

    media.add(
      '(max-width: 899px) and (prefers-reduced-motion: no-preference)',
      () => {
        cards.forEach((card, index) => {
          gsap.fromTo(
            card,
            {
              autoAlpha: 0,
              y: 32,
            },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.65,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 88%',
                once: true,

                onEnter: () => activateFeature(index),
                onEnterBack: () => activateFeature(index),
              },
            },
          )
        })

        ScrollTrigger.create({
          trigger: stage,
          start: 'top top',
          onLeaveBack: () => {
            lastActiveIndex = -1
            setActiveIndex(0)
            onActiveFeatureChange('dashboard')
          },
        })
      },
    )

    media.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(cards, {
        clearProps: 'all',
      })

      cards.forEach((card, index) => {
        ScrollTrigger.create({
          trigger: card,
          start: 'top 70%',
          end: 'bottom 70%',
          onEnter: () => activateFeature(index),
          onEnterBack: () => activateFeature(index),
        })
      })
    })

    return () => {
      media.revert()

      cards.forEach((card) => {
        card.style.removeProperty('z-index')
      })
    }
  }, [onActiveFeatureChange])

  useEffect(() => {
    if (!navigationRequest) return

    const { item } = navigationRequest

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const behavior: ScrollBehavior = prefersReducedMotion
      ? 'auto'
      : 'smooth'

    if (item === 'dashboard') {
      window.scrollTo({
        top: 0,
        behavior,
      })

      return
    }

    const featureIndex = featureCards.findIndex(
      (feature) => feature.navItem === item,
    )

    if (featureIndex < 0) return

    const trigger = ScrollTrigger.getById(
      'memento-feature-showcase',
    )

    if (trigger && trigger.end > trigger.start) {
      const progress =
        featureIndex / (featureCards.length - 1)

      window.scrollTo({
        top:
          trigger.start +
          (trigger.end - trigger.start) * progress,
        behavior,
      })

      return
    }

    const feature = featureCards[featureIndex]

    document
      .getElementById(`feature-card-${feature.id}`)
      ?.scrollIntoView({
        behavior,
        block: 'center',
      })
  }, [navigationRequest])


  return (
    <section
      className="feature-showcase"
      aria-label="Memento features"
    >
      <div className="feature-showcase__intro">
        <div className="feature-showcase__intro-main">
          <span className="feature-showcase__eyebrow">
            LESS CLUTTER. MORE CLARITY.
          </span>

          <h1 className="feature-showcase__title">
            Everything you need
            <br />
            to move work forward.
          </h1>
        </div>

        <div className="feature-showcase__intro-aside">
          <p>
            Four connected spaces for planning projects,
            managing tasks, staying focused, and
            understanding what changed.
          </p>

          <div className="feature-showcase__feature-count">
            <span className="feature-showcase__count-line" />
            <span>04 PURPOSEFUL WORKSPACES</span>
          </div>
        </div>
      </div>

      <div className="feature-showcase__stage">
        <div className="feature-showcase__stage-meta">
          <span>EXPLORE YOUR WORKSPACE</span>

          <span className="feature-showcase__progress">
            <strong>
              {String(activeIndex + 1).padStart(2, '0')}
            </strong>
            <span>/</span>
            <span>04</span>
          </span>
        </div>

        <div className="feature-showcase__cards">
          {featureCards.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              onView={() => onOpenRecords(feature)}
              onCreate={() => {
                navigate(`/${feature.id}/new`)
              }}
            />
          ))}
        </div>

        <div className="feature-showcase__scroll-cue">
          <span>SCROLL TO EXPLORE</span>
          <i className="ri-arrow-down-line" aria-hidden="true" />
        </div>
      </div>

      
    </section>
  )
}