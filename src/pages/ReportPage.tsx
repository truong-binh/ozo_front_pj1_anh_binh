import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { computeAllDates, lateDays } from '../datePlanner'
import type { ProjectDetail, ProjectNode } from '../types'
import { formatLocalDate, getStatusClass } from '../utils'
import { usePicMembers, picMemberDepts } from '../picMembers'

type ReportPeriod = 'today' | 'week' | 'month'

type ReportItem = {
  project: ProjectDetail
  node: ProjectNode
  due: Date
  late: number
}

function getReportRange(period: ReportPeriod) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (period === 'week') {
    const dow = today.getDay()
    const offsetToMon = dow === 0 ? -6 : 1 - dow
    const start = new Date(today)
    start.setDate(today.getDate() + offsetToMon)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return {
      start,
      end,
      label: `${formatLocalDate(start)} – ${formatLocalDate(end)}`,
    }
  }

  if (period === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
    const month = String(today.getMonth() + 1).padStart(2, '0')
    return {
      start,
      end,
      label: `Tháng ${month}/${today.getFullYear()} (${formatLocalDate(start)} – ${formatLocalDate(end)})`,
    }
  }

  const end = new Date(today)
  end.setHours(23, 59, 59, 999)
  return { start: today, end, label: formatLocalDate(today) }
}

function isDueInRange(due: Date, start: Date, end: Date) {
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  return dueDay >= start && dueDay <= end
}

function isToday(due: Date) {
  const now = new Date()
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  )
}

export function ReportPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectDetail[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('today')
  const [filterDept, setFilterDept] = useState('')
  const [filterPic, setFilterPic] = useState('')
  const picMembers = usePicMembers()

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
    // Nguồn chính: danh bạ pic_members. Gộp thêm PIC đã gán trong dữ liệu
    // (kể cả tên cũ không có trong danh bạ) để vẫn lọc được.
    // PIC lọc: CHỈ lấy từ danh bạ pic_members (bỏ nhãn "Trưởng phòng ..." và tên ngoài DB).
    for (const m of picMembers) {
      const name = (m.pic_name || '').trim()
      if (name) picSet.add(name)
    }
    for (const d of picMemberDepts()) deptSet.add(d)
    for (const p of data) {
      for (const n of p.nodes) {
        const dept = (n.dept || '').trim()
        if (dept) deptSet.add(dept)
      }
    }
    return {
      depts: Array.from(deptSet).sort((a, b) => a.localeCompare(b, 'vi')),
      pics: Array.from(picSet).sort((a, b) => a.localeCompare(b, 'vi')),
    }
  }, [data, picMembers])

  const stats = useMemo(() => {
    if (!data) return { total: 0, running: 0, done: 0, lateSteps: 0 }
    let doneProjects = 0
    let lateSteps = 0
    for (const p of data) {
      const dates = computeAllDates(p)
      let done = 0
      let total = 0
      for (const n of p.nodes) {
        if (n.status === 'Bỏ qua') continue
        total += 1
        if (n.status === 'Đã xong') done += 1
        if (lateDays(p, n.node_id, dates) > 0) lateSteps += 1
      }
      if (total > 0 && done === total) doneProjects += 1
    }
    return {
      total: data.length,
      running: data.length - doneProjects,
      done: doneProjects,
      lateSteps,
    }
  }, [data])

  const reportRange = useMemo(() => getReportRange(reportPeriod), [reportPeriod])

  const reportItems = useMemo((): ReportItem[] => {
    if (!data) return []
    const items: ReportItem[] = []
    for (const p of data) {
      const dates = computeAllDates(p)
      for (const n of p.nodes) {
        if (n.status === 'Đã xong' || n.status === 'Bỏ qua') continue
        const due = dates[n.node_id]?.due
        if (!due) continue
        if (!isDueInRange(due, reportRange.start, reportRange.end)) continue
        items.push({ project: p, node: n, due, late: lateDays(p, n.node_id, dates) })
      }
    }
    items.sort((a, b) => a.due.getTime() - b.due.getTime())
    return items
  }, [data, reportRange])

  const hasRespFilter = !!(filterDept || filterPic)

  const respItems = useMemo((): ReportItem[] => {
    if (!data || !hasRespFilter) return []
    const items: ReportItem[] = []
    for (const p of data) {
      const dates = computeAllDates(p)
      for (const n of p.nodes) {
        if (n.status === 'Đã xong' || n.status === 'Bỏ qua') continue
        const dept = (n.dept || '').trim()
        const pic = (n.pic || '').trim()
        if (filterDept && dept !== filterDept) continue
        if (filterPic && pic !== filterPic) continue
        const due = dates[n.node_id]?.due
        if (!due) continue
        items.push({ project: p, node: n, due, late: lateDays(p, n.node_id, dates) })
      }
    }
    items.sort((a, b) => a.due.getTime() - b.due.getTime())
    return items
  }, [data, filterDept, filterPic, hasRespFilter])

  const respLabel = hasRespFilter
    ? [filterDept && `Phòng: ${filterDept}`, filterPic && `PIC: ${filterPic}`]
        .filter(Boolean)
        .join(' · ')
    : 'Chọn Phòng hoặc PIC để xem'

  const openProject = (projectId: number) => {
    navigate(`/projects/${projectId}`)
  }

  if (loading) return <div className="empty-state">Đang tải báo cáo...</div>
  if (error) return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>

  return (
    <>
      <div className="help-text">
        <strong>Cách tính ngày dự kiến:</strong> = ngày bắt đầu + số ngày{' '}
        <em>
          (bỏ Chủ Nhật và ngày lễ VN — Tết Dương/Âm, 30/4, 1/5, 2/9, Giỗ Tổ)
        </em>
        . Đổi cột &quot;Số ngày&quot; bằng nút +/− → tất cả bước phía sau dịch tự động.{' '}
        <strong>Khi bước trước có &quot;Ngày thực tế&quot;</strong>, các bước sau lấy ngày
        thực tế đó làm mốc (thay cho ngày dự kiến).
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Tổng dự án</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Đang chạy</div>
          <div className="value">{stats.running}</div>
        </div>
        <div className="stat-card">
          <div className="label">Hoàn tất</div>
          <div className="value">{stats.done}</div>
        </div>
        <div className="stat-card">
          <div className="label">Bước trễ hạn</div>
          <div
            className="value"
            style={{ color: stats.lateSteps ? '#b91c1c' : '#1e293b' }}
          >
            {stats.lateSteps}
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-head">
          <div className="left">
            <h3>Báo cáo deadline</h3>
            <span className="count-pill">{reportItems.length}</span>
            <span className="range-label">{reportRange.label}</span>
          </div>
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
          >
            <option value="today">Hôm nay</option>
            <option value="week">Tuần này (T2 – CN)</option>
            <option value="month">Tháng này</option>
          </select>
        </div>
        <div className="report-body">
          {reportItems.length === 0 ? (
            <div className="report-empty">
              Không có bước nào cần hoàn thành trong khoảng này.
            </div>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Mã DA</th>
                  <th>Dự án</th>
                  <th>Bước</th>
                  <th>Phòng</th>
                  <th>PIC</th>
                  <th>Trạng thái</th>
                  <th className="col-due">Ngày dự kiến</th>
                </tr>
              </thead>
              <tbody>
                {reportItems.map((it) => (
                  <tr
                    key={`${it.project.project.id}-${it.node.node_id}`}
                    onClick={() => openProject(it.project.project.id)}
                  >
                    <td>
                      <strong>{it.project.project.code}</strong>
                    </td>
                    <td>{it.project.project.name}</td>
                    <td>
                      <span className="node-id">{it.node.node_id}</span> ·{' '}
                      {it.node.node_name || it.node.node_id}
                    </td>
                    <td>{(it.node.dept || '').trim() || '—'}</td>
                    <td>{(it.node.pic || '').trim() || '—'}</td>
                    <td>
                      <span className={`status-pill ${getStatusClass(it.node.status)}`}>
                        {it.node.status}
                      </span>
                    </td>
                    <td
                      className={`col-due ${isToday(it.due) ? 'due-today' : 'due-upcoming'}`}
                    >
                      {formatLocalDate(it.due)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="report-card">
        <div className="report-head">
          <div className="left">
            <h3>Báo cáo theo Phòng / PIC</h3>
            {hasRespFilter && <span className="count-pill">{respItems.length}</span>}
            <span className="range-label">{respLabel}</span>
          </div>
          <div className="report-filters">
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">Tất cả phòng</option>
              {options.depts.map((d) => (
                <option key={d} value={d}>
                  Phòng: {d}
                </option>
              ))}
            </select>
            <select value={filterPic} onChange={(e) => setFilterPic(e.target.value)}>
              <option value="">Tất cả PIC</option>
              {options.pics.length === 0 && (
                <option disabled>(chưa có PIC nào được gán)</option>
              )}
              {options.pics.map((p) => (
                <option key={p} value={p}>
                  PIC: {p}
                </option>
              ))}
            </select>
            {hasRespFilter && (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setFilterDept('')
                  setFilterPic('')
                }}
              >
                Xoá lọc
              </button>
            )}
          </div>
        </div>
        <div className="report-body">
          {!hasRespFilter ? (
            <div className="report-empty">
              Chọn <strong>Phòng</strong> hoặc <strong>PIC</strong> ở thanh công cụ phía trên
              để xem các bước phụ trách.
            </div>
          ) : respItems.length === 0 ? (
            <div className="report-empty">Không có bước nào khớp bộ lọc.</div>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Mã DA</th>
                  <th>Dự án</th>
                  <th>Bước</th>
                  <th>Phòng</th>
                  <th>PIC</th>
                  <th>Trạng thái</th>
                  <th className="col-due">Dự kiến</th>
                  <th>Trễ</th>
                </tr>
              </thead>
              <tbody>
                {respItems.map((it) => (
                  <tr
                    key={`resp-${it.project.project.id}-${it.node.node_id}`}
                    onClick={() => openProject(it.project.project.id)}
                  >
                    <td>
                      <strong>{it.project.project.code}</strong>
                    </td>
                    <td>{it.project.project.name}</td>
                    <td>
                      <span className="node-id">{it.node.node_id}</span> ·{' '}
                      {it.node.node_name || it.node.node_id}
                    </td>
                    <td>{(it.node.dept || '').trim() || '—'}</td>
                    <td>
                      {(it.node.pic || '').trim() || (
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${getStatusClass(it.node.status)}`}>
                        {it.node.status}
                      </span>
                    </td>
                    <td className="col-due">{formatLocalDate(it.due)}</td>
                    <td>
                      {it.late > 0 ? (
                        <span className="late-text">{it.late} ngày</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
