import type { LocalDailyTodoItem } from './dailyTodoTypes'

const STORAGE_KEY = 'memento.daily-todos.v1'

function isTodoItem(value: unknown): value is LocalDailyTodoItem {
  if (typeof value !== 'object' || value === null) return false

  const item = value as Partial<LocalDailyTodoItem>

  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.projectId === 'string' &&
    typeof item.projectLabel === 'string' &&
    typeof item.priority === 'string' &&
    typeof item.completed === 'boolean' &&
    typeof item.createdAt === 'string' &&
    typeof item.startedAt === 'string' &&
    (typeof item.completedAt === 'string' || item.completedAt === null) &&
    typeof item.updatedAt === 'string'
  )
}

/**
 * Local-first storage boundary. When Daily To-Do is connected to ERPNext,
 * replace this implementation with an API-backed repository while keeping
 * the screen and item shape stable.
 */
export const dailyTodoStorage = {
  load(): LocalDailyTodoItem[] {
    if (typeof window === 'undefined') return []

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []

      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(isTodoItem) : []
    } catch {
      return []
    }
  },

  save(items: LocalDailyTodoItem[]): void {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (error) {
      // Storage quota/privacy failures should not crash the whole screen.
      console.error('Unable to save Daily To-Do items locally.', error)
    }
  },
}
