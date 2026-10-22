export type DailyTodoPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

export interface DailyTodoProjectOption {
  id: string
  label: string
}

export interface LocalDailyTodoItem {
  id: string
  title: string
  projectId: string
  projectLabel: string
  priority: DailyTodoPriority
  completed: boolean
  /** When the item was created (ISO timestamp). */
  createdAt: string
  /** When work on the item started; initially the same as createdAt. */
  startedAt: string
  /** Set when completed, cleared if the item is reopened. */
  completedAt: string | null
  updatedAt: string
}
