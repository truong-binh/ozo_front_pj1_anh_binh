import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { ProjectDetail } from '../types'

type Week = {
  year: number
  week: number
  start: Date
}

function isoLocal(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseLocalDate(input: string | null | undefined): Date | null {
  if (!input) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

// ISO week helpers
function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getISOWeekYear(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

// Làm tròn về thứ 2 đầu tuần
function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function addWeeks(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

// Minimal working-day calc (CN + 1 số lễ 2026)
const VN_HOLIDAYS = new Set([
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-04-26',
  '2026-04-30',
  '2026-05-01',
  '2026-09-02',
  '2026-09-03',
])

function isWorkingDay(date: Date) {
  if (date.getDay() === 0) return false
  if (VN_HOLIDAYS.has(isoLocal(date))) return false
  return true
}

function addWorkingDays(start: Date, n: number) {
  const cur = new Date(start)
  if (n <= 0) return cur
  let added = 0
  while (added < n) {
    cur.setDate(cur.getDate() + 1)
    if (isWorkingDay(cur)) added++
  }
  return cur
}

function computeDueDates(project: ProjectDetail) {
  const cache = new Map<string, Date>()
  const visiting = new Set<string>()
  const start = parseLocalDate(project.project.start_date) || new Date()
  const nodeById = new Map(project.nodes.map((n) => [n.node_id, n]))

  function dueOf(nodeId: string): Date {
    const cached = cache.get(nodeId)
    if (cached) return cached
    if (visiting.has(nodeId)) return start
    visiting.add(nodeId)

    const node = nodeById.get(nodeId)
    if (!node) return start

    const deps = (node.after || []).filter((d) => d !== nodeId)
    const startAt =
      deps.length === 0
        ? start
        : new Date(
            Math.max(
              ...deps.map((depId) => {
                const dep = nodeById.get(depId)
                const actual = parseLocalDate(dep?.actual_date || null)
                const due = dueOf(depId)
                return (actual || due).getTime()
              }),
            ),
          )

    const duration = node.status === 'Bỏ qua' ? 0 : node.duration || 0
    const due = addWorkingDays(startAt, duration)
    visiting.delete(nodeId)
    cache.set(nodeId, due)
    return due
  }

  for (const n of project.nodes) dueOf(n.node_id)
  return cache
}

type Chip = {
  projectId: number
  projectCode: string
  projectName: string
  nodeId: string
  nodeName: string
  week: number
  year: number
  status: string
  stageLetter: string
  late: number
}

const STAGE_COLORS: Record<string, string> = {
  A: '#7c3aed',
  B: '#059669',
  C: '#ca8a04',
  D: '#ea580c',
  E: '#2563eb',
  F: '#dc2626',
  G: '#475569',
}

export function MilestonePage() {
  const [data, setData] = useState<ProjectDetail[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listProjectsWithNodes()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const { weeks, chipsByProject } = useMemo(() => {
    if (!data || data.length === 0) return { weeks: [] as Week[], chipsByProject: new Map<number, Chip[]>() }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const msDay = 1000 * 60 * 60 * 24

    const calcLate = (status: string, due: Date | undefined) => {
      if (status === 'Đã xong' || status === 'Bỏ qua') return 0
      if (!due) return 0
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      const diff = Math.floor((today.getTime() - dueDay.getTime()) / msDay)
      return diff > 0 ? diff : 0
    }

    let min: Date | null = null
    let max: Date | null = null
    const chipsByProject = new Map<number, Chip[]>()

    for (const p of data) {
      const dueMap = computeDueDates(p)
      for (const n of p.nodes) {
        const actual = parseLocalDate(n.actual_date || null)
        const end = actual || dueMap.get(n.node_id) || new Date()
        if (!min || end < min) min = end
        if (!max || end > max) max = end

        const stageLetter = (n.node_id?.charAt(0) || 'G').toUpperCase()
        const late = calcLate(n.status, dueMap.get(n.node_id))

        const chip: Chip = {
          projectId: p.project.id,
          projectCode: p.project.code,
          projectName: p.project.name,
          nodeId: n.node_id,
          nodeName: n.node_name || n.node_id,
          week: getISOWeek(end),
          year: getISOWeekYear(end),
          status: n.status,
          stageLetter,
          late,
        }
        if (!chipsByProject.has(p.project.id)) chipsByProject.set(p.project.id, [])
        chipsByProject.get(p.project.id)?.push(chip)
      }
    }

    if (!min || !max) return { weeks: [] as Week[], chipsByProject }

    const start = startOfWeek(min)
    const end = startOfWeek(max)
    const weeks: Week[] = []
    let cur = new Date(start)
    while (cur <= end) {
      weeks.push({ year: getISOWeekYear(cur), week: getISOWeek(cur), start: new Date(cur) })
      cur = addWeeks(cur, 1)
    }

    return { weeks, chipsByProject }
  }, [data])

  if (loading) return <div className="empty-state">Đang tải milestone...</div>
  if (error) return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>
  if (!data || data.length === 0) return <div className="empty-state">Chưa có dự án.</div>

  return (
    <>
      <div className="project-header">
        <h2>📅 Milestone (theo tuần)</h2>
        <div className="meta">
          <span>Số dự án: {data.length}</span>
          <span>Số tuần hiển thị: {weeks.length}</span>
          <span style={{ color: '#64748b' }}>
            Mỗi chip = 1 bước, vị trí = tuần hoàn thành (thực tế nếu có, nếu chưa thì dự kiến).
          </span>
        </div>
      </div>

      <div className="stage-group" style={{ overflowX: 'auto' }}>
        <table className="node-table" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: '#f8fafc', zIndex: 2 }}>Dự án</th>
              {weeks.map((w) => (
                <th key={`${w.year}-${w.week}`} style={{ textAlign: 'center', minWidth: 56 }}>
                  W{w.week}
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{w.start.toLocaleDateString('vi-VN')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => {
              const chips = chipsByProject.get(p.project.id) || []
              return (
                <tr key={p.project.id}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                    <div style={{ fontWeight: 700 }}>
                      <Link to={`/projects/${p.project.id}`}>{p.project.code}</Link>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{p.project.name}</div>
                  </td>
                  {weeks.map((w) => {
                    const inWeek = chips.filter((c) => c.year === w.year && c.week === w.week)
                    return (
                      <td key={`${p.project.id}-${w.year}-${w.week}`} style={{ textAlign: 'center' }}>
                        {inWeek.slice(0, 4).map((c) => (
                          <span
                            key={c.nodeId}
                            title={`${c.nodeId} - ${c.nodeName} (${c.status})`}
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              margin: '1px',
                              borderRadius: 4,
                              background: STAGE_COLORS[c.stageLetter] || STAGE_COLORS.G,
                              color: '#fff',
                              fontSize: 10,
                              opacity: c.status === 'Đã xong' ? 0.45 : 1,
                              textDecoration: c.status === 'Đã xong' ? 'line-through' : 'none',
                              boxShadow:
                                c.late > 0 ? '0 0 0 2px rgba(185, 28, 28, 0.95)' : undefined,
                            }}
                          >
                            {c.nodeId}
                          </span>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mstone-legend">
        {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => (
          <span className="item" key={l}>
            <span
              className="mstone-chip"
              style={{
                background: STAGE_COLORS[l] || STAGE_COLORS.G,
              }}
            >
              {l}
            </span>
            {l}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: '#94a3b8' }}>
          Nền theo nhánh A–G · Vệt đỏ = trễ hạn · Gạch ngang = đã xong
        </span>
      </div>
    </>
  )
}

