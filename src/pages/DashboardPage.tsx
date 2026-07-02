import { useEffect, useState } from 'react'
import { api } from '../api'
import { ProjectCard } from '../components/ProjectCard'
import type { ProjectSummary } from '../types'

export function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'Mỹ phẩm',
    product_group: 'A1',
    owner: 'RD',
    start_date: new Date().toISOString().slice(0, 10),
  })

  async function loadProjects() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listProjects()
      setProjects(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
  }, [])

  async function handleCreateProject() {
    try {
      await api.createProject(form)
      setShowCreate(false)
      setForm({
        code: '',
        name: '',
        type: 'Mỹ phẩm',
        product_group: 'A1',
        owner: 'RD',
        start_date: new Date().toISOString().slice(0, 10),
      })
      await loadProjects()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDeleteLastProject() {
    if (projects.length === 0) return
    const target = projects[projects.length - 1]
    const ok = window.confirm(`Xóa dự án ${target.code} - ${target.name}?`)
    if (!ok) return
    try {
      await api.deleteProject(target.id)
      await loadProjects()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleExportJson() {
    const full = await api.listProjectsWithNodes()
    const payload = {
      projects: full.map((item) => ({
        id: item.project.code,
        name: item.project.name,
        type: item.project.type,
        group: item.project.product_group || '',
        owner: item.project.owner || '',
        startDate: item.project.start_date,
        nodes: Object.fromEntries(
          item.nodes.map((n) => [
            n.node_id,
            {
              status: n.status,
              pic: n.pic || '',
              duration: n.duration,
              actualDate: n.actual_date || '',
              notes: n.notes || '',
              after: n.after || [],
              dept: n.dept || '',
              attachments: [],
            },
          ]),
        ),
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feelex-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportCsv() {
    const full = await api.listProjectsWithNodes()
    const headers = [
      'ProjectCode',
      'ProjectName',
      'Type',
      'Group',
      'Owner',
      'NodeId',
      'NodeName',
      'Status',
      'PIC',
      'Duration',
      'ActualDate',
      'Dept',
      'After',
      'Notes',
    ]
    const rows: string[][] = [headers]
    full.forEach((item) => {
      item.nodes.forEach((n) => {
        rows.push([
          item.project.code,
          item.project.name,
          item.project.type,
          item.project.product_group || '',
          item.project.owner || '',
          n.node_id,
          n.node_name || n.node_id,
          n.status,
          n.pic || '',
          String(n.duration),
          n.actual_date || '',
          n.dept || '',
          (n.after || []).join('|'),
          n.notes || '',
        ])
      })
    })
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell)
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
              return `"${s.replace(/"/g, '""')}"`
            }
            return s
          })
          .join(','),
      )
      .join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feelex-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportJson(file: File) {
    const text = await file.text()
    const parsed = JSON.parse(text) as { projects?: unknown[] }
    const projectsPayload = parsed.projects || []
    await api.seedFromPayload({ projects: projectsPayload })
    await loadProjects()
  }

  if (loading) return <div className="empty-state">Đang tải danh sách dự án...</div>
  if (error) return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>

  return (
    <>
      <div className="project-header">
        <h2>Tổng quan dự án</h2>
        <div className="meta">
          <span>Tổng số dự án: {projects.length}</span>
        </div>
        <div className="actions">
          <button className="btn action-btn" onClick={() => setShowCreate(true)}>
            + Dự án mới
          </button>
          <button className="btn action-btn" onClick={() => void handleExportCsv()}>
            Xuất CSV
          </button>
          <button className="btn action-btn" onClick={() => void handleExportJson()}>
            Backup JSON
          </button>
          <label className="btn action-btn file-btn">
            Khôi phục JSON
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  void handleImportJson(file)
                }
              }}
            />
          </label>
          <button className="btn action-btn danger-btn" onClick={() => void handleDeleteLastProject()}>
            Xóa dự án cuối
          </button>
        </div>
      </div>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Tạo dự án mới</h3>
            <div className="form-grid">
              <input
                placeholder="Mã dự án"
                value={form.code}
                onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
              />
              <input
                placeholder="Tên dự án"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                placeholder="Loại sản phẩm"
                value={form.type}
                onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
              />
              <input
                placeholder="Nhóm"
                value={form.product_group}
                onChange={(e) =>
                  setForm((s) => ({ ...s, product_group: e.target.value }))
                }
              />
              <input
                placeholder="Owner"
                value={form.owner}
                onChange={(e) => setForm((s) => ({ ...s, owner: e.target.value }))}
              />
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((s) => ({ ...s, start_date: e.target.value }))
                }
              />
            </div>
            <div className="modal-actions">
              <button className="btn action-btn" onClick={() => setShowCreate(false)}>
                Hủy
              </button>
              <button className="btn action-btn" onClick={() => void handleCreateProject()}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

