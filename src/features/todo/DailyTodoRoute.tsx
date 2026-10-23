import { useNavigate } from 'react-router-dom'

import { DailyTodoScreen } from './DailyTodoScreen'

/** Route adapter for the local-first Daily To-Do screen. */
export function DailyTodoRoute() {
  const navigate = useNavigate()

  return (
    <DailyTodoScreen
      onBack={() => navigate('/tasks')}
    />
  )
}
