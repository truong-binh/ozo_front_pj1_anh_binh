import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ReportPage } from './pages/ReportPage'
import { MilestonePage } from './pages/MilestonePage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/milestone" element={<MilestonePage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
