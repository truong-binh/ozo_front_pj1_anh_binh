import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ReportPage } from './pages/ReportPage'
import { MilestonePage } from './pages/MilestonePage'
import { WorkflowMapPage } from './pages/WorkflowMapPage'
import { PicMembersPage } from './pages/PicMembersPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { LoginPage } from './pages/LoginPage'
import { AuthProvider, useAuth } from './auth'
import './App.css'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty-state">Đang tải...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/milestone" element={<MilestonePage />} />
          <Route path="/workflow-map" element={<WorkflowMapPage />} />
          <Route path="/pic-members" element={<PicMembersPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
