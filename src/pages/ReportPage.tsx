import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { ProjectDetail } from '../types'

type DueItem = {
  projectId: number
  projectCode: string
  projectName: string
  nodeId: string
  nodeName: string
  due: Date
  status: string
  late: number
  pic: string
  dept: string
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

// Danh sách lễ (copy từ bản HTML gốc – có thể mở rộng thêm)
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

export function ReportPage() {
  const [data, setData] = useState<ProjectDetail[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month'>(
    'today',
  )
  const [filterDept, setFilterDept] = useState('')
  const [filterPic, setFilterPic] = useState('')

  useEffect(() => {
    api
      .listProjectsWithNodes()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const options = useMemo(() => {
    if (!data) return { depts: [] as string[], pics: [] as string[] }
    const deptSet = new Set<string>()
    const picSet = new Set<string>()
    for (const p of data) {
      for (const n of p.nodes) {
        const dept = (n.dept || '').trim()
        const pic = (n.pic || '').trim()
        if (dept) deptSet.add(dept)
        if (pic) picSet.add(pic)
      }
    }
    return {
      depts: Array.from(deptSet).sort((a, b) => a.localeCompare(b, 'vi')),
      pics: Array.from(picSet).sort((a, b) => a.localeCompare(b, 'vi')),
    }
  }, [data])

  const dueItems = useMemo(() => {
    if (!data) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const msDay = 1000 * 60 * 60 * 24

    const range = (() => {
      if (reportPeriod === 'today') {
        return { start: new Date(today), end: new Date(today.getTime() + msDay - 1) }
      }
      if (reportPeriod === 'week') {
        const dow = today.getDay() // 0=CN..6=T7
        const offsetToMon = dow === 0 ? -6 : 1 - dow
        const start = new Date(today)
        start.setDate(today.getDate() + offsetToMon)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start.getTime() + 6 * msDay + msDay - 1)
        return { start, end }
      }
      // month
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    })()

    const isInRange = (d: Date) => d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime()

    const calcLate = (status: string, due: Date | undefined) => {
      if (status === 'Đã xong' || status === 'Bỏ qua') return 0
      if (!due) return 0
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      const diff = Math.floor((today.getTime() - dueDay.getTime()) / msDay)
      return diff > 0 ? diff : 0
    }

    const items: DueItem[] = []
    for (const p of data) {
      const dueMap = computeDueDates(p)
      for (const n of p.nodes) {
        if (n.status === 'Đã xong' || n.status === 'Bỏ qua') continue
        const due = dueMap.get(n.node_id)
        if (!due) continue
        if (!isInRange(due)) continue
        const dept = (n.dept || '').trim()
        const pic = (n.pic || '').trim()
        if (filterDept && dept !== filterDept) continue
        if (filterPic && pic !== filterPic) continue

        items.push({
          projectId: p.project.id,
          projectCode: p.project.code,
          projectName: p.project.name,
          nodeId: n.node_id,
          nodeName: n.node_name || n.node_id,
          due,
          status: n.status,
          late: calcLate(n.status, due),
          pic,
          dept,
        })
      }
    }
    items.sort((a, b) => a.due.getTime() - b.due.getTime())
    return items.slice(0, 200)
  }, [data, reportPeriod, filterDept, filterPic])

  if (loading) return <div className="empty-state">Đang tải báo cáo...</div>
  if (error) return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>

  return (
    <>
      <div className="project-header">
        <h2>📊 Báo cáo deadline</h2>
        <div className="meta">
          <span>
            {reportPeriod === 'today' ? 'Hôm nay' : reportPeriod === 'week' ? 'Tuần này' : 'Tháng này'}:{' '}
            {dueItems.length} việc
          </span>
          <span>
            Dữ liệu: <code>/api/projects/with-nodes</code>
          </span>
        </div>
      </div>

      <div className="filter-bar">
        <span className="filter-label">Khoảng</span>
        <select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value as any)}>
          <option value="today">today</option>
          <option value="week">week</option>
          <option value="month">month</option>
        </select>

        <span className="filter-label" style={{ marginLeft: 8 }}>
          Phòng
        </span>
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">Tất cả</option>
          {options.depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <span className="filter-label" style={{ marginLeft: 8 }}>
          PIC
        </span>
        <select value={filterPic} onChange={(e) => setFilterPic(e.target.value)}>
          <option value="">Tất cả</option>
          {options.pics.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="stage-group">
        <div className="stage-header">
          <span>Danh sách đầu việc</span>
          <span className="stage-progress">Click dự án để mở chi tiết</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="node-table">
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Bước</th>
                <th>Phòng</th>
                <th>PIC</th>
                <th>Due (dự kiến)</th>
                <th>Trễ</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {dueItems.map((item) => (
                <tr key={`${item.projectId}-${item.nodeId}`}>
                  <td>
                    <Link to={`/projects/${item.projectId}`}>
                      {item.projectCode} - {item.projectName}
                    </Link>
                  </td>
                  <td>
                    {item.nodeId} - {item.nodeName}
                  </td>
                  <td>{item.dept || '-'}</td>
                  <td>{item.pic || '-'}</td>
                  <td
                    className={
                      item.late > 0 ? 'due-today' : 'due-upcoming'
                    }
                  >
                    {item.due.toLocaleDateString('vi-VN')}
                  </td>
                  <td className={item.late > 0 ? 'late-text' : ''}>
                    {item.late || 0}
                  </td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

