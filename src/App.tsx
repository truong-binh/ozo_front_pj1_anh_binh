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

// Khách "chỉ xem" chỉ được ở /milestone (nơi hiện đúng bảng Ngày hàng về).
// Backend cũng chặn độc lập — đây chỉ là lớp điều hướng cho gọn UI.
function BlockGuest({ children }: { children: ReactNode }) {
  const { isGuest } = useAuth()
  if (isGuest) return <Navigate to="/milestone" replace />
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
          <Route path="/milestone" element={<MilestonePage />} />
          <Route
            path="/"
            element={
              <BlockGuest>
                <DashboardPage />
              </BlockGuest>
            }
          />
          <Route
            path="/report"
            element={
              <BlockGuest>
                <ReportPage />
              </BlockGuest>
            }
          />
          <Route
            path="/workflow-map"
            element={
              <BlockGuest>
                <WorkflowMapPage />
              </BlockGuest>
            }
          />
          <Route
            path="/pic-members"
            element={
              <BlockGuest>
                <PicMembersPage />
              </BlockGuest>
            }
          />
          <Route
            path="/feedback"
            element={
              <BlockGuest>
                <FeedbackPage />
              </BlockGuest>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <BlockGuest>
                <ProjectDetailPage />
              </BlockGuest>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
