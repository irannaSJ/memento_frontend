import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'memento-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const savedTheme = window.localStorage.getItem(
    THEME_STORAGE_KEY,
  )

  return savedTheme === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    getInitialTheme,
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      theme,
    )
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) =>
      currentTheme === 'light' ? 'dark' : 'light',
    )
  }

  return {
    theme,
    toggleTheme,
  }
}