import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import mementoLogo from '../../assets/memento-logo.svg'
import type { Theme } from '../../hooks/useTheme.ts'
import './FloatingNavigation.css'

export type NavigationItemId =
  | 'dashboard'
  | 'projects'
  | 'tasks'
  | 'todo'
  | 'activity'

interface FloatingNavigationProps {
  activeItem: NavigationItemId
  onNavigate: (item: NavigationItemId) => void
  theme: Theme
  onToggleTheme: () => void
}

const navigationItems: Array<{
  id: NavigationItemId
  label: string
  icon: string
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-line',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'ri-folder-3-line',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
  },
  {
    id: 'todo',
    label: 'Daily To-Do',
    icon: 'ri-calendar-check-line',
  },
  {
    id: 'activity',
    label: 'Activity Logs',
    icon: 'ri-history-line',
  },
]

export function FloatingNavigation({
  activeItem,
  onNavigate,
  theme,
  onToggleTheme,
}: FloatingNavigationProps) {
  const navigationRef = useRef<HTMLElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    const navigation = navigationRef.current

    if (!navigation) return

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reducedMotion) return

    const context = gsap.context(() => {
      gsap.fromTo(
        navigation,
        {
          autoAlpha: 0,
          y: -12,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          ease: 'power2.out',
          clearProps: 'transform',
        },
      )
    })

    return () => context.revert()
  }, [])

  function handleNavigate(item:NavigationItemId){
    onNavigate(item)
    setIsMenuOpen(false)
  }

  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <div className="floating-navigation-positioner">
      <header
        className={`floating-navigation${
          isMenuOpen ? ' is-menu-open' : ''
        }`}
        ref={navigationRef}
      >
        {/* Mobile menu button: top-left */}
        <button
          className="floating-navigation__menu-toggle"
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={
            isMenuOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
          }
          aria-expanded={isMenuOpen}
          aria-controls="memento-navigation-content"
        >
          <i
            className={
              isMenuOpen ? 'ri-close-line' : 'ri-menu-line'
            }
            aria-hidden="true"
          />
        </button>

        {/* Brand: left on desktop, right on mobile */}
        <a
          className="floating-navigation__brand"
          href="#memento-home"
          aria-label="Memento home"
          onClick={(event) => {
            event.preventDefault()
            handleNavigate('dashboard')
          }}
        >
          <span
            className="floating-navigation__logo-window"
            aria-hidden="true"
          >
            <img
              className="floating-navigation__logo"
              src={mementoLogo}
              alt=""
            />
          </span>

          <span className="floating-navigation__brand-name">
            Memento
          </span>
        </a>

        <span
          className="floating-navigation__divider"
          aria-hidden="true"
        />

        {/* Navigation options and theme control */}
        <div
          className="floating-navigation__content"
          id="memento-navigation-content"
        >
          <nav
            className="floating-navigation__links"
            aria-label="Primary navigation"
          >
            {navigationItems.map((item) => {
              const isActive = activeItem === item.id

              return (
                <button
                  className={`floating-navigation__link${
                    isActive ? ' is-active' : ''
                  }`}
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <i
                    className={item.icon}
                    aria-hidden="true"
                  />

                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <button
            className="floating-navigation__theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
          >
            <i
              className={
                theme === 'light'
                  ? 'ri-moon-line'
                  : 'ri-sun-line'
              }
              aria-hidden="true"
            />
          </button>
        </div>
      </header>
    </div>
  )
}