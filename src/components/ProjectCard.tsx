import { Link } from 'react-router-dom'
import type { ProjectSummary } from '../types'
import { formatDate } from '../utils'

type Props = {
  project: ProjectSummary
  stats?: {
    done: number
    total: number
    late: number
    pct: number
    currentStep: string
  }
}

export function ProjectCard({ project, stats }: Props) {
  const badge = !stats
    ? null
    : stats.pct >= 1
      ? { text: 'HOÀN TẤT', cls: 'badge badge-done' }
      : stats.late > 0
        ? { text: `${stats.late} trễ`, cls: 'badge badge-late' }
        : { text: 'Đúng tiến độ', cls: 'badge badge-ok' }

  return (
    <Link to={`/projects/${project.id}`} className="project-card">
      {badge && <span className={badge.cls}>{badge.text}</span>}
      <div className="pid">{project.code}</div>
      <div className="pname">{project.name}</div>
      <div className="pmeta">
        <span>{project.type}</span>
        <span>Nhóm: {project.product_group || '-'}</span>
        <span>Ngành hàng: {project.category || '-'}</span>
        <span>Chủ trì: {project.owner || '-'}</span>
        <span>Bắt đầu: {formatDate(project.start_date)}</span>
      </div>
      {stats && (
        <>
          <div className="progress-bar">
            <div style={{ width: `${Math.max(0, Math.min(100, stats.pct * 100)).toFixed(1)}%` }} />
          </div>
          <div className="progress-label">
            <span>
              {stats.done}/{stats.total} bước
            </span>
            <span>{Math.round(stats.pct * 100)}%</span>
          </div>
          <div className="current-step">
            <strong>Bước hiện tại:</strong> {stats.currentStep}
          </div>
        </>
      )}
    </Link>
  )
}

