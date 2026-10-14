import {
  useCallback,
  useRef,
  useState,
} from 'react'

import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import './App.css'

import {
  FloatingNavigation,
  type NavigationItemId,
} from './components/navigation/FloatingNavigation'

import { useTheme } from './hooks/useTheme'

import {
  FeatureShowcase,
  type FeatureNavigationRequest,
} from './features/home/FeatureShowcase'

import {
  featureCards,
  type FeatureDefinition,
} from './features/home/featureData'

import { RecordDetailPage } from './features/records/RecordDetailsPage'

import { RecordPage } from './features/records/RecordPage'

function RecordsRoute({
  onBack,
}: {
  onBack: () => void
}) {
  const { featureId } = useParams<{ featureId: string }>()

  const feature = featureCards.find(
    (item) => item.id === featureId,
  )

  if (!feature) {
    return <Navigate to="/" replace />
  }

  return (
    <RecordPage
      key={feature.id} 
      feature={feature}
      onBack={onBack}
    />
  )
}


function RecordDetailRoute() {
  const { featureId, recordName } = useParams<{
    featureId: string
    recordName: string
  }>()

  const navigate = useNavigate()

  const feature = featureCards.find(
    (item) => item.id === featureId,
  )

  if (
    !feature ||
    (feature.id !== 'projects' && feature.id !== 'tasks') ||
    !recordName
  ) {
    return <Navigate to="/" replace />
  }

  return (
    <RecordDetailPage
      key={`${feature.id}:${recordName}`}
      feature={feature}
      recordName={recordName}
      onClose={() => navigate(`/${feature.id}`, { replace: true })}
    />
  )
}




function MementoApp() {
  const navigate = useNavigate()
  const location = useLocation()

  const [dashboardActiveItem, setDashboardActiveItem] =
    useState<NavigationItemId>('dashboard')

  const [navigationRequest, setNavigationRequest] =
    useState<FeatureNavigationRequest | null>(null)

  const navigationSequence = useRef(0)

  const { theme, toggleTheme } = useTheme()

  const currentFeature: FeatureDefinition | undefined =
    featureCards.find(
      (feature) =>
        location.pathname === `/${feature.id}` ||
        location.pathname.startsWith(`/${feature.id}/`),
    )

  const activeItem: NavigationItemId =
    location.pathname === '/'
      ? dashboardActiveItem
      : currentFeature?.navItem ?? 'dashboard'

  const requestDashboardScroll = useCallback(() => {
    navigationSequence.current += 1

    setNavigationRequest({
      item: 'dashboard',
      sequence: navigationSequence.current,
    })
  }, [])

  const handleNavigate = useCallback(
    (item: NavigationItemId) => {
      if (item === 'dashboard') {
        setDashboardActiveItem('dashboard')
        requestDashboardScroll()
        navigate('/')
        return
      }

      const feature = featureCards.find(
        (candidate) => candidate.navItem === item,
      )

      if (feature) {
        navigate(`/${feature.id}`)
      }
    },
    [navigate, requestDashboardScroll],
  )

  const handleActiveFeatureChange = useCallback(
    (item: NavigationItemId) => {
      setDashboardActiveItem(item)
    },
    [],
  )

  const handleOpenRecords = useCallback(
    (feature: FeatureDefinition) => {
      navigate(`/${feature.id}`)
    },
    [navigate],
  )

  const handleBackToOverview = useCallback(() => {
    setDashboardActiveItem('dashboard')
    requestDashboardScroll()
    navigate('/')
  }, [navigate, requestDashboardScroll])

  return (
    <div className="app">
      <FloatingNavigation
        activeItem={activeItem}
        onNavigate={handleNavigate}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <FeatureShowcase
                onActiveFeatureChange={handleActiveFeatureChange}
                navigationRequest={navigationRequest}
                onOpenRecords={handleOpenRecords}
              />
            }
          />


          <Route
            path="/:featureId/:recordName"
            element={<RecordDetailRoute />}
          />

          <Route
            path="/:featureId"
            element={
              <RecordsRoute
                onBack={handleBackToOverview}
              />
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <MementoApp />
    </HashRouter>
  )
}

export default App