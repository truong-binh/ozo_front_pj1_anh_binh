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
  // Chọn khoảng tuần theo chỉ số trong mảng all.weeks (W## như trong bảng).
  const [exportFromWk, setExportFromWk] = useState('')
  const [exportToWk, setExportToWk] = useState('')
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

  // Mở hộp thoại xuất; mặc định = từ tuần đầu tới tuần cuối của bảng.
  const openExport = () => {
    const n = all?.weeks.length ?? 0
    setExportFromWk(n ? '0' : '')
    setExportToWk(n ? String(n - 1) : '')
    setExportMsg(null)
    setShowExport(true)
  }

  // Xuất ma trận Milestone theo dạng LỊCH (giống mẫu): cột nhóm theo THÁNG, mỗi
  // tuần là 1 cột 'Tuần N' (thứ tự tuần trong tháng), dòng = sản phẩm, ô = tên bước
  // kèm phòng ban "Tên bước (Phòng)". Dùng đúng dữ liệu `all` (đã lọc phòng ban).
  const exportExcel = async () => {
    if (!all || all.weeks.length === 0) {
      setExportMsg('Không có dữ liệu để xuất.')
      return
    }
    let fromIdx = parseInt(exportFromWk, 10)
    let toIdx = parseInt(exportToWk, 10)
    if (Number.isNaN(fromIdx) || Number.isNaN(toIdx)) {
      setExportMsg('Vui lòng chọn đủ tuần bắt đầu và tuần kết thúc.')
      return
    }
    if (fromIdx > toIdx) [fromIdx, toIdx] = [toIdx, fromIdx] // đảo nếu chọn ngược

    // Tuần thuộc tháng chứa THỨ NĂM của nó (chuẩn ISO) -> gán tháng đúng cho tuần
    // vắt qua ranh giới tháng (vd Mon 30/6–6/7 thuộc Tháng 7).
    const thu = (w: Week) => {
      const t = new Date(w.start)
      t.setDate(t.getDate() + 3)
      return t
    }

    const weeks = all.weeks.slice(fromIdx, toIdx + 1)

    // Nội dung 1 ô: gộp các bước của dự án rơi vào tuần đó -> "Tên bước (Phòng)".
    const cellFor = (row: ProjectRow, w: Week) => {
      const chips = row.steps.filter((s) => s.year === w.year && s.week === w.week)
      return chips
        .map((s) => s.name + (s.dept ? ` (${s.dept})` : ''))
        .join('\n')
    }

    // Bỏ dự án không có bước nào trong khoảng tuần đã chọn.
    const rows = all.rows.filter((row) =>
      weeks.some((w) => row.steps.some((s) => s.year === w.year && s.week === w.week)),
    )
    if (rows.length === 0) {
      setExportMsg('Không có bước nào trong khoảng tuần đã chọn.')
      return
    }

    // ---- Dòng 0: "Ngày update" + nhãn THÁNG (gộp theo nhóm tháng liên tiếp) ----
    const today = new Date()
    const updateLabel = `Ngày update: ${String(today.getDate()).padStart(2, '0')}/${String(
      today.getMonth() + 1,
    ).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`
    const monthRow: string[] = [updateLabel]
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
    let gStart = 1
    const monthLabel = (w: Week) => `Tháng ${thu(w).getMonth() + 1}/${thu(w).getFullYear()}`
    weeks.forEach((w, k) => {
      const col = k + 1
      const label = monthLabel(w)
      const prevLabel = k > 0 ? monthLabel(weeks[k - 1]) : ''
      if (k === 0 || label !== prevLabel) {
        if (k > 0 && col - 1 > gStart)
          merges.push({ s: { r: 0, c: gStart }, e: { r: 0, c: col - 1 } })
        gStart = col
        monthRow[col] = label
      } else {
        monthRow[col] = ''
      }
    })
    if (weeks.length > gStart)
      merges.push({ s: { r: 0, c: gStart }, e: { r: 0, c: weeks.length } })

    // ---- Dòng 1: "Sản phẩm" + "Week NN" (số tuần ISO) ----
    const weekRow: string[] = ['Sản phẩm', ...weeks.map((w) => `Week ${w.week}`)]

    // ---- Các dòng sản phẩm ----
    const aoa: string[][] = [monthRow, weekRow]
    for (const row of rows) {
      aoa.push([
        `${row.project.code} - ${row.project.name}`,
        ...weeks.map((w) => cellFor(row, w)),
      ])
    }

    const XLSX = await import('xlsx-js-style')
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 42 }, ...weeks.map(() => ({ wch: 22 }))]
    ws['!merges'] = merges
    ws['!freeze'] = { xSplit: 1, ySplit: 2 }

    // ----- Style: viền, wrap-text (mỗi bước 1 dòng), header đậm -----
    const border = {
      top: { style: 'thin', color: { rgb: 'D0D5DD' } },
      bottom: { style: 'thin', color: { rgb: 'D0D5DD' } },
      left: { style: 'thin', color: { rgb: 'D0D5DD' } },
      right: { style: 'thin', color: { rgb: 'D0D5DD' } },
    }
    const nCols = weeks.length + 1
    const nRows = aoa.length
    const rowHeights: { hpt: number }[] = []
    for (let r = 0; r < nRows; r++) {
      let maxLines = 1
      for (let c = 0; c < nCols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (!cell) continue
        const isHeader = r <= 1
        const isProductCol = c === 0
        if (r === 0 || r === 1) {
          // Dòng tháng + dòng tuần: đậm, canh giữa, nền xám nhạt.
          cell.s = {
            font: { bold: true, sz: r === 0 ? 12 : 11 },
            alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'EEF2F6' } },
            border,
          }
        } else {
          cell.s = {
            font: { bold: isProductCol },
            alignment: { wrapText: true, vertical: 'top', horizontal: 'left' },
            border,
          }
        }
        if (!isHeader) {
          const lines = String(cell.v || '').split('\n').length
          if (lines > maxLines) maxLines = lines
        }
      }
      rowHeights.push({ hpt: r <= 1 ? 20 : Math.max(18, maxLines * 15) })
    }
    ws['!rows'] = rowHeights

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Milestone')
    const suffix = filterDept ? `_${filterDept}` : ''
    XLSX.writeFile(
      wb,
      `milestone_W${weeks[0].week}-den-W${weeks[weeks.length - 1].week}${suffix}.xlsx`,
    )
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
              Xuất dạng lịch: cột nhóm theo <strong>tháng / tuần</strong>, dòng = sản phẩm,
              mỗi ô ghi <strong>tên bước (phòng)</strong>. Chọn khoảng tuần cần xuất.
              {filterDept && (
                <>
                  {' '}
                  Đang lọc phòng <strong>{filterDept}</strong>.
                </>
              )}
            </div>
            <div className="report-filters" style={{ marginTop: 12 }}>
              <label>
                Từ tuần{' '}
                <select value={exportFromWk} onChange={(e) => setExportFromWk(e.target.value)}>
                  {all?.weeks.map((w, i) => (
                    <option key={`from-${w.year}-${w.week}`} value={String(i)}>
                      W{w.week} ({fmtDayMonth(w.start)}/{w.year})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Đến tuần{' '}
                <select value={exportToWk} onChange={(e) => setExportToWk(e.target.value)}>
                  {all?.weeks.map((w, i) => (
                    <option key={`to-${w.year}-${w.week}`} value={String(i)}>
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
