import { Link } from 'react-router-dom'
import type { ProjectSummary } from '../types'
import { formatDate } from '../utils'

type Props = {
  project: ProjectSummary
}

export function ProjectCard({ project }: Props) {
  return (
    <Link to={`/projects/${project.id}`} className="project-card">
      <div className="pid">{project.code}</div>
      <div className="pname">{project.name}</div>
      <div className="pmeta">
        <span>{project.type}</span>
        <span>{project.product_group || '-'}</span>
        <span>{project.owner || '-'}</span>
      </div>
      <div className="current-step">Ngày bắt đầu: {formatDate(project.start_date)}</div>
    </Link>
  )
}

