import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { computeAllDates, lateDays, parseLocalDate } from '../datePlanner'
import type { ProjectDetail, ProjectNode } from '../types'

const VN_MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

// Nhãn 7 nhánh A–G (khớp file HTML gốc)
const STAGES = [
  'A. Ý tưởng & Duyệt',
  'B. Nghiên cứu bào chế',
  'C. Bao bì',
  'D. Khả thi sản xuất',
  'E. Công bố',
  'F. Ra mắt & Truyền thông',
  'G. Sản xuất lô đầu',
]

// ----- Tuần ISO 8601 (tuần bắt đầu Thứ Hai) -----
function getISOWeek(d: Date) {
  const t = new Date(d.valueOf())
  t.setHours(0, 0, 0, 0)
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
  const firstThursday = t.valueOf()
  t.setMonth(0, 1)
  if (t.getDay() !== 4) t.setMonth(0, 1 + (((4 - t.getDay()) + 7) % 7))
  return 1 + Math.ceil((firstThursday - t.valueOf()) / 604800000)
}

function getISOWeekYear(d: Date) {
  const t = new Date(d.valueOf())
  t.setHours(0, 0, 0, 0)
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
  return t.getFullYear()
}

function fmtDate(d: Date) {
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear()
  )
}

function fmtDayMonth(d: Date) {
  return d.getDate() + '/' + (d.getMonth() + 1)
}

type Week = { year: number; week: number; start: Date; end: Date }

type Step = {
  projectId: number
  id: string
  name: string
  end: Date
  week: number
  year: number
  status: string
  late: number
  stageLetter: string
  dept: string
  pic: string
  isActual: boolean // ngày lấy từ THỰC TẾ (true) hay DỰ KIẾN (false)
}

type ProjectRow = {
  project: ProjectDetail['project']
  steps: Step[]
}

type Gantt = {
  rows: ProjectRow[]
  weeks: Week[]
  minDate: Date | null
  maxDate: Date | null
  monthBar: { label: string; span: number }[]
}

// Dựng dữ liệu Gantt theo tuần cho tập bước lọc bởi includeNode (dùng chung Milestone + Ngày hàng về).
// dropEmpty = true -> bỏ dòng dự án không còn bước nào sau khi lọc (dùng khi lọc phòng ban).
function buildGantt(
  projects: ProjectDetail[],
  includeNode: (node: ProjectNode) => boolean,
  dropEmpty = false,
): Gantt {
  const sortedProjects = [...projects].sort((a, b) =>
    b.project.code.localeCompare(a.project.code, 'vi', { numeric: true }),
  )
  let rows: ProjectRow[] = sortedProjects.map((p) => {
    const dates = computeAllDates(p)
    const steps: Step[] = p.nodes
      .filter((n) => includeNode(n) && n.status !== 'Bỏ qua')
      .map((n) => {
        const actual = parseLocalDate(n.actual_date || null)
        const end = actual || dates[n.node_id]?.due || new Date()
        return {
          projectId: p.project.id,
          id: n.node_id,
          name: n.node_name || n.node_id,
          end,
          week: getISOWeek(end),
          year: getISOWeekYear(end),
          status: n.status,
          late: lateDays(p, n.node_id, dates),
          stageLetter: (n.node_id.charAt(0) || 'G').toUpperCase(),
          dept: (n.dept || '').trim(),
          pic: (n.pic || '').trim(),
          isActual: !!actual,
        }
      })
    return { project: p.project, steps }
  })

  if (dropEmpty) rows = rows.filter((r) => r.steps.length > 0)

  let minDate: Date | null = null
  let maxDate: Date | null = null
  for (const row of rows) {
    for (const s of row.steps) {
      if (!minDate || s.end < minDate) minDate = s.end
      if (!maxDate || s.end > maxDate) maxDate = s.end
    }
  }

  const weeks: Week[] = []
  if (minDate && maxDate) {
    const cur = new Date(minDate)
    cur.setHours(0, 0, 0, 0)
    cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7)) // về Thứ Hai
    const endLimit = new Date(maxDate)
    endLimit.setHours(0, 0, 0, 0)
    endLimit.setDate(endLimit.getDate() + (6 - ((endLimit.getDay() + 6) % 7))) // tới Chủ Nhật
    while (cur <= endLimit) {
      const end = new Date(cur)
      end.setDate(end.getDate() + 6)
      weeks.push({
        year: getISOWeekYear(cur),
        week: getISOWeek(cur),
        start: new Date(cur),
        end,
      })
      cur.setDate(cur.getDate() + 7)
    }
  }

  // Thanh tháng: gộp các tuần liền kề cùng năm-tháng
  const monthBar: { label: string; span: number }[] = []
  let prevYM = ''
  let groupStart = 0
  for (let i = 0; i < weeks.length; i++) {
    const ym = weeks[i].start.getFullYear() + '-' + weeks[i].start.getMonth()
    if (ym !== prevYM) {
      if (i > 0) {
        monthBar.push({
          label:
            VN_MONTHS[weeks[groupStart].start.getMonth()] +
            '/' +
            weeks[groupStart].start.getFullYear(),
          span: i - groupStart,
        })
      }
      groupStart = i
      prevYM = ym
    }
  }
  if (weeks.length > 0) {
    monthBar.push({
      label:
        VN_MONTHS[weeks[groupStart].start.getMonth()] +
        '/' +
        weeks[groupStart].start.getFullYear(),
      span: weeks.length - groupStart,
    })
  }

  return { rows, weeks, minDate, maxDate, monthBar }
}

type GanttTableProps = {
  gantt: Gantt
  projectColLabel: string
  chipLabel?: (step: Step) => string
  legend: React.ReactNode
  onChipClick: (projectId: number) => void
}

function GanttTable({ gantt, projectColLabel, chipLabel, legend, onChipClick }: GanttTableProps) {
  const today = new Date()
  const curWk = getISOWeek(today)
  const curYr = getISOWeekYear(today)

  if (!gantt.minDate) {
    return (
      <div className="mstone-wrap">
        <div className="report-empty" style={{ padding: 20 }}>
          Không có dữ liệu.
        </div>
      </div>
    )
  }

  return (
    <div className="mstone-wrap mstone-equal">
      <table className="mstone-table">
        <thead>
          <tr>
            <th className="mstone-col-project" rowSpan={2}>
              {projectColLabel}
            </th>
            {gantt.monthBar.map((m, i) => (
              <th key={i} className="mstone-month-bar" colSpan={m.span}>
                {m.label}
              </th>
            ))}
          </tr>
          <tr>
            {gantt.weeks.map((w) => {
              const isCurrent = w.year === curYr && w.week === curWk
              return (
                <th
                  key={`${w.year}-${w.week}-${w.start.getTime()}`}
                  className={`mstone-week-col ${isCurrent ? 'is-current' : ''}`}
                >
                  <span className="mstone-week-num">W{w.week}</span>
                  <span className="mstone-week-date">{fmtDayMonth(w.start)}</span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {gantt.rows.map((row) => (
            <tr key={row.project.id}>
              <td className="mstone-col-project">
                <div style={{ fontWeight: 700 }}>{row.project.code}</div>
                <div style={{ color: '#475569', marginTop: 2 }}>{row.project.name}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  {row.project.type} · {row.project.product_group || '—'}
                </div>
              </td>
              {gantt.weeks.map((w) => {
                const isCurrent = w.year === curYr && w.week === curWk
                const chips = row.steps.filter((s) => s.year === w.year && s.week === w.week)
                return (
                  <td
                    key={`${row.project.id}-${w.year}-${w.week}-${w.start.getTime()}`}
                    className={`mstone-cell ${isCurrent ? 'is-current-col' : ''}`}
                  >
                    {chips.map((s) => {
                      const cls =
                        'mstone-chip mstone-' +
                        s.stageLetter +
                        (s.status === 'Đã xong' ? ' is-done' : '') +
                        (s.late > 0 ? ' is-late' : '')
                      const title =
                        `${s.id} · ${s.name}\nNgày: ${fmtDate(s.end)}\nTrạng thái: ${s.status}` +
                        (s.late > 0 ? `\nTRỄ ${s.late} ngày` : '')
                      return (
                        <span
                          key={s.id}
                          className={cls}
                          title={title}
                          onClick={() => onChipClick(row.project.id)}
                        >
                          {chipLabel ? chipLabel(s) : s.id}
                        </span>
                      )
                    })}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {legend}
    </div>
  )
}

export function MilestonePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectDetail[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDept, setFilterDept] = useState('')
  const [showExport, setShowExport] = useState(false)
  // Chọn 1 tuần theo chỉ số trong mảng all.weeks (W## như trong bảng).
  const [exportWk, setExportWk] = useState('')
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  useEffect(() => {
    api
      .listProjectsWithNodes()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Danh sách phòng ban lấy từ dept của các bước hiện có.
  const deptOptions = useMemo(() => {
    if (!data) return [] as string[]
    const set = new Set<string>()
    for (const p of data)
      for (const n of p.nodes) {
        const d = (n.dept || '').trim()
        if (d) set.add(d)
      }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [data])

  const deptMatch = (n: ProjectNode) =>
    !filterDept || (n.dept || '').trim() === filterDept

  const all = useMemo(
    () => (data ? buildGantt(data, (n) => deptMatch(n), !!filterDept) : null),
    [data, filterDept],
  )
  const g4 = useMemo(
    () =>
      data
        ? buildGantt(data, (n) => n.node_id === 'G4' && deptMatch(n), !!filterDept)
        : null,
    [data, filterDept],
  )

  if (loading) return <div className="empty-state">Đang tải milestone...</div>
  if (error) return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>
  if (!data || data.length === 0) return <div className="empty-state">Chưa có dự án.</div>

  const openProject = (projectId: number) => navigate(`/projects/${projectId}`)

  // Mở hộp thoại xuất; mặc định = tuần hiện tại nếu có trong bảng, nếu không thì tuần đầu.
  const openExport = () => {
    const weeks = all?.weeks ?? []
    const today = new Date()
    const curWk = getISOWeek(today)
    const curYr = getISOWeekYear(today)
    const curIdx = weeks.findIndex((w) => w.week === curWk && w.year === curYr)
    setExportWk(weeks.length ? String(curIdx >= 0 ? curIdx : 0) : '')
    setExportMsg(null)
    setShowExport(true)
  }

  // Xuất Milestone của ĐÚNG 1 TUẦN đã chọn: 1 cột tuần, dòng = dự án, ô = mã bước
  // rơi vào tuần đó. Dùng đúng dữ liệu `all` (đã lọc phòng ban) để khớp bảng.
  const exportExcel = async () => {
    if (!all || all.weeks.length === 0) {
      setExportMsg('Không có dữ liệu để xuất.')
      return
    }
    const idx = parseInt(exportWk, 10)
    const week = all.weeks[idx]
    if (Number.isNaN(idx) || !week) {
      setExportMsg('Vui lòng chọn tuần cần xuất.')
      return
    }

    // Gom mọi bước rơi vào tuần đã chọn (theo mọi dự án), mỗi bước 1 dòng.
    type Coll = { code: string; name: string; step: Step }
    const collected: Coll[] = []
    for (const row of all.rows) {
      for (const s of row.steps) {
        if (s.year === week.year && s.week === week.week) {
          collected.push({ code: row.project.code, name: row.project.name, step: s })
        }
      }
    }
    if (collected.length === 0) {
      setExportMsg('Không có bước nào trong tuần đã chọn.')
      return
    }

    // Sắp theo mã dự án rồi theo mã bước.
    collected.sort(
      (a, b) =>
        a.code.localeCompare(b.code, 'vi', { numeric: true }) ||
        a.step.id.localeCompare(b.step.id, 'vi', { numeric: true }),
    )

    const stageNameOf = (letter: string) =>
      STAGES.find((s) => s.charAt(0) === letter) || letter

    const title = `BÁO CÁO MILESTONE — TUẦN W${week.week} (${fmtDate(week.start)} – ${fmtDate(
      week.end,
    )})${filterDept ? ` — Phòng ${filterDept}` : ''}`

    const header = [
      'Mã DA',
      'Dự án',
      'Giai đoạn',
      'Bước',
      'Tên bước',
      'Phòng',
      'PIC',
      'Trạng thái',
      'Ngày',
      'Loại ngày',
      'Trễ (ngày)',
    ]

    const aoa: (string | number)[][] = [[title], [`Số bước: ${collected.length}`], [], header]
    for (const c of collected) {
      const s = c.step
      aoa.push([
        c.code,
        c.name,
        stageNameOf(s.stageLetter),
        s.id,
        s.name,
        s.dept || '—',
        s.pic || '—',
        s.status,
        fmtDate(s.end),
        s.isActual ? 'Thực tế' : 'Dự kiến',
        s.late > 0 ? s.late : '',
      ])
    }

    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [
      { wch: 8 }, // Mã DA
      { wch: 32 }, // Dự án
      { wch: 22 }, // Giai đoạn
      { wch: 6 }, // Bước
      { wch: 30 }, // Tên bước
      { wch: 8 }, // Phòng
      { wch: 18 }, // PIC
      { wch: 12 }, // Trạng thái
      { wch: 12 }, // Ngày
      { wch: 10 }, // Loại ngày
      { wch: 10 }, // Trễ
    ]
    // Gộp ô tiêu đề trải hết các cột; cố định 4 dòng đầu khi cuộn.
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }]
    ws['!freeze'] = { xSplit: 0, ySplit: 4 }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Tuần W${week.week}`)
    const suffix = filterDept ? `_${filterDept}` : ''
    XLSX.writeFile(wb, `bao-cao-milestone_W${week.week}-${week.year}${suffix}.xlsx`)
    setShowExport(false)
  }

  const stageLegend = (
    <div className="mstone-legend">
      {STAGES.map((stage) => (
        <span className="item" key={stage}>
          <span className={`mstone-chip mstone-${stage.charAt(0)}`}>{stage.charAt(0)}</span>
          {stage}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: '#94a3b8' }}>
        Chip mờ + gạch ngang = đã xong · Viền đỏ = trễ hạn · Cột vàng = tuần hiện tại
      </span>
    </div>
  )

  const g4Legend = (
    <div className="mstone-legend">
      <span className="item">
        <span className="mstone-chip mstone-G">G4</span>G4 — Nhập kho (hàng về)
      </span>
      <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: '#94a3b8' }}>
        Vị trí = tuần hàng về (thực tế nếu có, nếu chưa thì dự kiến)
      </span>
    </div>
  )

  return (
    <>
      <div className="project-header" style={{ marginBottom: 14 }}>
        <div className="mstone-toolbar">
          <h2 style={{ margin: 0 }}>📅 Milestone — tiến độ theo tuần</h2>
          <div className="report-filters">
            <button type="button" className="btn sm" onClick={openExport}>
              ⬇ Xuất Excel
            </button>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">Tất cả phòng</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  Phòng: {d}
                </option>
              ))}
            </select>
            {filterDept && (
              <button type="button" className="btn sm" onClick={() => setFilterDept('')}>
                Xoá lọc
              </button>
            )}
          </div>
        </div>
        <div className="meta">
          <span>
            <strong>Số dự án:</strong> {all?.rows.length ?? 0}
          </span>
          {all?.minDate && (
            <span>
              <strong>Khoảng:</strong> {fmtDate(all.minDate)} – {fmtDate(all.maxDate as Date)} (
              {all.weeks.length} tuần)
            </span>
          )}
          <span style={{ color: '#64748b' }}>
            Mỗi chip = 1 bước (cả 27), vị trí = tuần hoàn thành (thực tế nếu có, nếu chưa thì dự
            kiến). Click chip → mở dự án.
          </span>
        </div>
      </div>
      {all && (
        <GanttTable
          gantt={all}
          projectColLabel="Dự án"
          legend={stageLegend}
          onChipClick={openProject}
        />
      )}

      <div className="project-header" style={{ margin: '22px 0 14px' }}>
        <h2>🚚 Ngày hàng về (chỉ bước G4 — Nhập kho)</h2>
        <div className="meta">
          {g4?.minDate && (
            <span>
              <strong>Khoảng:</strong> {fmtDate(g4.minDate)} – {fmtDate(g4.maxDate as Date)} (
              {g4.weeks.length} tuần)
            </span>
          )}
          <span style={{ color: '#64748b' }}>
            Cùng kiểu lịch tuần như Milestone, nhưng chỉ hiển thị bước G4. Chip ghi ngày hàng về.
            Click → mở dự án.
          </span>
        </div>
      </div>
      {g4 && (
        <GanttTable
          gantt={g4}
          projectColLabel="Dự án"
          chipLabel={(s) =>
            String(s.end.getDate()).padStart(2, '0') +
            '/' +
            String(s.end.getMonth() + 1).padStart(2, '0')
          }
          legend={g4Legend}
          onChipClick={openProject}
        />
      )}

      {showExport && (
        <div className="modal-backdrop" onClick={() => setShowExport(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="edit-modal-title">Xuất Excel — Milestone theo tuần</h3>
            <div className="modal-sub">
              Xuất báo cáo chi tiết các bước rơi vào <strong>đúng tuần đã chọn</strong> —
              mỗi dòng 1 bước (Giai đoạn, Bước, Tên bước, Phòng, PIC, Trạng thái, Ngày,
              Loại ngày, Trễ).
              {filterDept && (
                <>
                  {' '}
                  Đang lọc phòng <strong>{filterDept}</strong>.
                </>
              )}
            </div>
            <div className="report-filters" style={{ marginTop: 12 }}>
              <label>
                Tuần{' '}
                <select value={exportWk} onChange={(e) => setExportWk(e.target.value)}>
                  {all?.weeks.map((w, i) => (
                    <option key={`wk-${w.year}-${w.week}`} value={String(i)}>
                      W{w.week} ({fmtDayMonth(w.start)}/{w.year})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {exportMsg && (
              <div className="login-error" style={{ marginTop: 10 }}>
                {exportMsg}
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn action-btn"
                onClick={() => setShowExport(false)}
              >
                Huỷ
              </button>
              <button type="button" className="btn primary" onClick={() => void exportExcel()}>
                Tải file .xlsx
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
