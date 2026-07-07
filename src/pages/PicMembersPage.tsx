import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { DEFAULT_DEPTS } from '../constants'
import { loadPicMembers } from '../picMembers'

type EditRow = {
  open_id: string
  email: string
  pic_name: string
  dept: string
  lead: string // lead_depts dạng "RD, BGĐ"
}

function toLeadArray(s: string) {
  return Array.from(
    new Set(
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  )
}

export function PicMembersPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  const [rows, setRows] = useState<EditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string>('')

  async function load() {
    setLoading(true)
    try {
      const data = await api.listPicMembers()
      setRows(
        data.map((m) => {
          // Ưu tiên lead_depts; nếu trống mà is_leader (kiểu cũ) thì suy ra từ dept.
          const leads =
            m.lead_depts && m.lead_depts.length
              ? m.lead_depts
              : m.is_leader && m.dept
                ? [m.dept]
                : []
          return {
            open_id: m.open_id || '',
            email: m.email || '',
            pic_name: m.pic_name || '',
            dept: (m.dept || '').trim(),
            lead: leads.join(', '),
          }
        }),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function patchRow(openId: string, p: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.open_id === openId ? { ...r, ...p } : r)))
  }

  async function saveRow(r: EditRow) {
    if (!r.pic_name.trim()) {
      setMsg('Tên PIC không được trống')
      return
    }
    setBusy(r.open_id)
    setMsg('')
    try {
      await api.savePicMember({
        open_id: r.open_id || null,
        email: r.email || null,
        pic_name: r.pic_name.trim(),
        dept: r.dept.trim() || null,
        lead_depts: toLeadArray(r.lead),
      })
      await loadPicMembers(true)
      setMsg(`Đã lưu ${r.pic_name}`)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function removeRow(r: EditRow) {
    if (!window.confirm(`Xoá PIC "${r.pic_name}"?`)) return
    setBusy(r.open_id)
    setMsg('')
    try {
      await api.deletePicMember(r.open_id)
      await loadPicMembers(true)
      await load()
      setMsg(`Đã xoá ${r.pic_name}`)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!isManager) {
    return (
      <div className="empty-state">
        Chỉ <b>Quản lý</b> mới xem/sửa được danh bạ PIC. Hãy bấm “Quản lý” trên thanh trên để nâng quyền.
      </div>
    )
  }

  const deptOptions = Array.from(new Set([...DEFAULT_DEPTS])).sort((a, b) =>
    a.localeCompare(b, 'vi'),
  )

  return (
    <div className="pic-admin">
      <div className="pic-admin-head">
        <h2>Quản lý PIC</h2>
        <div className="hint">
          Thành viên tự đồng bộ từ Lark khi được thêm vào nhóm. Quản lý chỉ phân <b>Phòng</b> và <b>Trưởng phòng</b>:
          nhập mã phòng vào cột “Trưởng phòng”, nhiều phòng cách nhau dấu phẩy (vd: <code>RD, BGĐ</code>).
          Người đăng ký Lark bằng SĐT/ẩn mail vẫn nhận nhắc qua open_id (cột Email có thể trống).
        </div>
        {msg && <div className="pic-admin-msg">{msg}</div>}
      </div>

      {loading ? (
        <div className="empty-state">Đang tải...</div>
      ) : (
        <div className="mstone-wrap" style={{ maxHeight: 'unset' }}>
          <table className="node-table">
            <thead>
              <tr>
                <th>Tên PIC</th>
                <th>Email</th>
                <th>Phòng</th>
                <th>Trưởng phòng (mã phòng)</th>
                <th style={{ width: 150 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.open_id || r.email || r.pic_name}>
                  <td>
                    <input
                      className="ed-cell"
                      value={r.pic_name}
                      onChange={(e) => patchRow(r.open_id, { pic_name: e.target.value })}
                    />
                  </td>
                  <td>
                    <span style={{ color: r.email ? '#475569' : '#d97706' }}>
                      {r.email || '(không có / đăng ký bằng SĐT)'}
                    </span>
                  </td>
                  <td>
                    <select
                      className="ed-cell"
                      value={r.dept}
                      onChange={(e) => patchRow(r.open_id, { dept: e.target.value })}
                    >
                      <option value="">—</option>
                      {(r.dept && !deptOptions.includes(r.dept)
                        ? [r.dept, ...deptOptions]
                        : deptOptions
                      ).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="ed-cell"
                      placeholder="vd: RD, BGĐ"
                      value={r.lead}
                      onChange={(e) => patchRow(r.open_id, { lead: e.target.value })}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" disabled={busy === r.open_id} onClick={() => void saveRow(r)}>
                      Lưu
                    </button>
                    <button
                      className="btn danger"
                      disabled={busy === r.open_id}
                      onClick={() => void removeRow(r)}
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
