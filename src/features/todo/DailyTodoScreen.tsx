import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  mementoApi,
  type MementoRecord,
} from '../../services/mementoApi'
import { dailyTodoStorage } from './dailyTodoStorage'
import type {
  DailyTodoPriority,
  DailyTodoProjectOption,
  LocalDailyTodoItem,
} from './dailyTodoTypes'

import './DailyTodoScreen.css'

const PRIORITIES: DailyTodoPriority[] = ['Low', 'Medium', 'High', 'Urgent']
type TodoViewFilter = 'all' | 'open' | 'completed'

interface DailyTodoScreenProps {
  /** Pass cached/local project options here later if desired. */
  projects?: DailyTodoProjectOption[]
  onBack?: () => void
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDateHeading(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getText(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (typeof DOMParser === 'undefined') return value.trim()

  const parsed = new DOMParser().parseFromString(value, 'text/html')
  return (parsed.body.textContent ?? value).replace(/\s+/g, ' ').trim()
}

export function DailyTodoScreen({ projects: suppliedProjects, onBack }: DailyTodoScreenProps) {
  const [items, setItems] = useState<LocalDailyTodoItem[]>(() => dailyTodoStorage.load())
  const [projectOptions, setProjectOptions] = useState<DailyTodoProjectOption[]>(suppliedProjects ?? [])
  const [projectLoadNote, setProjectLoadNote] = useState<string | null>(null)
  const [viewFilter, setViewFilter] = useState<TodoViewFilter>('all')
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState<DailyTodoPriority>('Medium')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    dailyTodoStorage.save(items)
  }, [items])

  // Project names are read-only choices. To-do items themselves stay local.
  // A parent may provide local/cached project options to avoid this request.
  useEffect(() => {
    if (suppliedProjects) {
      setProjectOptions(suppliedProjects)
      setProjectLoadNote(null)
      return
    }

    let cancelled = false

    void mementoApi.getDocTypeRecords({
      doctype: 'My Projects',
      start: 0,
      page_length: 100,
    }).then((response) => {
      if (cancelled) return

      const options = response.data
        .map((record: MementoRecord) => ({
          id: record.name,
          label: getText(record.project_name) || record.name,
        }))
        .filter((option) => Boolean(option.id))

      setProjectOptions(options)
      setProjectLoadNote(options.length === 0 ? 'No projects were returned. You can still create an unassigned to-do.' : null)
    }).catch(() => {
      if (cancelled) return
      setProjectOptions([])
      setProjectLoadNote('Projects could not be loaded. You can still create an unassigned to-do.')
    })

    return () => {
      cancelled = true
    }
  }, [suppliedProjects])

  const visibleItems = useMemo(() => {
    const matching = items.filter((item) => {
      if (viewFilter === 'open') return !item.completed
      if (viewFilter === 'completed') return item.completed
      return true
    })

    return [...matching].sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [items, viewFilter])

  const completedCount = items.filter((item) => item.completed).length
  const openCount = items.length - completedCount
  const selectedProject = projectOptions.find((project) => project.id === projectId)

  function resetForm() {
    setTitle('')
    setProjectId('')
    setPriority('Medium')
    setEditingId(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    const now = new Date().toISOString()
    const selected = projectOptions.find((project) => project.id === projectId)

    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? {
        ...item,
        title: cleanTitle,
        projectId,
        projectLabel: selected?.label ?? '',
        priority,
        updatedAt: now,
      } : item))
      resetForm()
      return
    }

    const newItem: LocalDailyTodoItem = {
      id: createId(),
      title: cleanTitle,
      projectId,
      projectLabel: selected?.label ?? '',
      priority,
      completed: false,
      createdAt: now,
      startedAt: now,
      completedAt: null,
      updatedAt: now,
    }

    setItems((current) => [newItem, ...current])
    resetForm()
  }

  function toggleCompleted(id: string, completed: boolean) {
    const now = new Date().toISOString()

    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      completed,
      completedAt: completed ? now : null,
      updatedAt: now,
    } : item))
  }

  function beginEdit(item: LocalDailyTodoItem) {
    setEditingId(item.id)
    setTitle(item.title)
    setProjectId(item.projectId)
    setPriority(item.priority)
    document.getElementById('daily-todo-title')?.focus()
  }

  return (
    <main className="daily-todo-screen" aria-labelledby="daily-todo-heading">
      <header className="daily-todo-screen__header">
        <div className="daily-todo-screen__heading-copy">
          {onBack && (
            <button className="daily-todo-screen__back" type="button" onClick={onBack}>
              <i className="ri-arrow-left-line" aria-hidden="true" />
              Back to tasks
            </button>
          )}
          <span className="daily-todo-screen__eyebrow">MEMENTO / PERSONAL WORKSPACE</span>
          <h1 id="daily-todo-heading">Daily To-Do</h1>
          <p>Capture the next small step. Keep your focus clear and your progress visible.</p>
          <span className="daily-todo-screen__date">{formatDateHeading(new Date())}</span>
        </div>

        <div className="daily-todo-screen__stats" aria-label="To-do summary">
          <div className="daily-todo-screen__stat">
            <span>ALL ITEMS</span>
            <strong>{items.length}</strong>
          </div>
          <div className="daily-todo-screen__stat">
            <span>TO DO</span>
            <strong>{openCount}</strong>
          </div>
          <div className="daily-todo-screen__stat">
            <span>COMPLETED</span>
            <strong>{completedCount}</strong>
          </div>
        </div>
      </header>

      <section className="daily-todo-screen__list-section" aria-labelledby="daily-todo-list-heading">
        <div className="daily-todo-screen__section-heading">
          <div>
            <span className="daily-todo-screen__eyebrow">YOUR CHECKLIST</span>
            <h2 id="daily-todo-list-heading">Today’s items</h2>
          </div>
          <div className="daily-todo-screen__filters" role="group" aria-label="Filter to-do items">
            {([
              ['all', `All (${items.length})`],
              ['open', `To do (${openCount})`],
              ['completed', `Completed (${completedCount})`],
            ] as const).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                className={`daily-todo-screen__filter${viewFilter === filter ? ' is-active' : ''}`}
                aria-pressed={viewFilter === filter}
                onClick={() => setViewFilter(filter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="daily-todo-screen__empty">
            <span className="daily-todo-screen__empty-icon" aria-hidden="true">
              <i className="ri-checkbox-circle-line" />
            </span>
            <h3>{viewFilter === 'completed' ? 'Nothing completed yet' : viewFilter === 'open' ? 'You are all caught up' : 'A little room for what matters'}</h3>
            <p>{viewFilter === 'completed' ? 'Completed items will appear here.' : 'Add one clear next step using the form below.'}</p>
          </div>
        ) : (
          <div className="daily-todo-screen__items">
            {visibleItems.map((item) => (
              <article key={item.id} className={`daily-todo-item${item.completed ? ' is-completed' : ''}`}>
                <label className="daily-todo-item__check-wrap" aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}>
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(event) => toggleCompleted(item.id, event.target.checked)}
                  />
                  <span className="daily-todo-item__custom-check" aria-hidden="true">
                    <i className="ri-check-line" />
                  </span>
                </label>

                <div className="daily-todo-item__main">
                  <h3 className="daily-todo-item__title">{item.title}</h3>
                  <div className="daily-todo-item__meta">
                    {item.projectLabel && (
                      <span className="daily-todo-item__project">
                        <i className="ri-folder-3-line" aria-hidden="true" />
                        {item.projectLabel}
                      </span>
                    )}
                    <span className={`daily-todo-item__priority is-${item.priority.toLowerCase()}`}>
                      <i className="ri-flag-line" aria-hidden="true" />
                      {item.priority}
                    </span>
                  </div>
                  <p className="daily-todo-item__timestamp">
                    <i className="ri-play-circle-line" aria-hidden="true" />
                    Started {formatDateTime(item.startedAt)}
                    {item.completedAt && (
                      <span className="daily-todo-item__completed-at">
                        <i className="ri-check-double-line" aria-hidden="true" />
                        Completed {formatDateTime(item.completedAt)}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="daily-todo-item__edit"
                  onClick={() => beginEdit(item)}
                  aria-label={`Modify ${item.title}`}
                  title="Modify to-do"
                >
                  <i className="ri-edit-line" aria-hidden="true" />
                  <span>Modify</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="daily-todo-composer" aria-labelledby="daily-todo-composer-heading">
        <div className="daily-todo-composer__header">
          <div>
            <span className="daily-todo-screen__eyebrow">{editingId ? 'MAKE AN ADJUSTMENT' : 'ONE THING AT A TIME'}</span>
            <h2 id="daily-todo-composer-heading">{editingId ? 'Modify to-do item' : 'What needs your attention?'}</h2>
            <p>{editingId ? 'Update the title, project, or priority.' : 'Add a short action. You can add project context and priority too.'}</p>
          </div>
          <span className="daily-todo-composer__icon" aria-hidden="true">
            <i className={editingId ? 'ri-edit-2-line' : 'ri-add-line'} />
          </span>
        </div>

        <form className="daily-todo-composer__form" onSubmit={handleSubmit}>
          <label className="daily-todo-composer__field daily-todo-composer__field--title" htmlFor="daily-todo-title">
            <span>To-do item <b aria-hidden="true">*</b></span>
            <input
              id="daily-todo-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Review project requirements"
              maxLength={180}
              required
              autoComplete="off"
            />
          </label>

          <label className="daily-todo-composer__field" htmlFor="daily-todo-project">
            <span>Project</span>
            <select
              id="daily-todo-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">No project selected</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>{project.label}</option>
              ))}
            </select>
          </label>

          <label className="daily-todo-composer__field" htmlFor="daily-todo-priority">
            <span>Priority</span>
            <select
              id="daily-todo-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as DailyTodoPriority)}
            >
              {PRIORITIES.map((itemPriority) => (
                <option key={itemPriority} value={itemPriority}>{itemPriority}</option>
              ))}
            </select>
          </label>

          {projectLoadNote && (
            <p className="daily-todo-composer__note" role="status">{projectLoadNote}</p>
          )}

          <div className="daily-todo-composer__actions">
            {editingId && (
              <button className="daily-todo-composer__cancel" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            )}
            <button className="daily-todo-composer__submit" type="submit" disabled={!title.trim()}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} aria-hidden="true" />
              {editingId ? 'Save changes' : 'Add to-do'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
