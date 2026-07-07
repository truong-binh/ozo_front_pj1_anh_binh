import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { DEFAULT_DEPTS } from '../constants'
import { loadPicMembers } from '../picMembers'

type EditRow = {
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
  const [add, setAdd] = useState<EditRow>({ email: '', pic_name: '', dept: '', lead: '' })

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
            email: m.email,
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

  function patchRow(email: string, p: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.email === email ? { ...r, ...p } : r)))
  }

  async function saveRow(r: EditRow) {
    if (!r.pic_name.trim()) {
      setMsg('Tên PIC không được trống')
      return
    }
    setBusy(r.email)
    setMsg('')
    try {
      await api.savePicMember({
        email: r.email,
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

  async function removeRow(email: string, name: string) {
    if (!window.confirm(`Xoá PIC "${name}" (${email})?`)) return
    setBusy(email)
    setMsg('')
    try {
      await api.deletePicMember(email)
      await loadPicMembers(true)
      await load()
      setMsg(`Đã xoá ${name}`)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function addRow() {
    if (!add.email.trim() || !add.pic_name.trim()) {
      setMsg('Cần email và tên PIC để thêm')
      return
    }
    setBusy('__add__')
    setMsg('')
    try {
      await api.savePicMember({
        email: add.email.trim(),
        pic_name: add.pic_name.trim(),
        dept: add.dept.trim() || null,
        lead_depts: toLeadArray(add.lead),
      })
      setAdd({ email: '', pic_name: '', dept: '', lead: '' })
      await loadPicMembers(true)
      await load()
      setMsg('Đã thêm PIC')
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
          Trưởng phòng: nhập mã phòng vào cột “Trưởng phòng”, nhiều phòng cách nhau dấu phẩy (vd: <code>RD, BGĐ</code>).
          Người có ô này khác trống = trưởng phòng của (các) phòng đó.
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
              {/* Dòng thêm mới */}
              <tr>
                <td>
                  <input
                    className="ed-cell"
                    placeholder="Tên"
                    value={add.pic_name}
                    onChange={(e) => setAdd({ ...add, pic_name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="ed-cell"
                    placeholder="email@..."
                    value={add.email}
                    onChange={(e) => setAdd({ ...add, email: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="ed-cell"
                    value={add.dept}
                    onChange={(e) => setAdd({ ...add, dept: e.target.value })}
                  >
                    <option value="">—</option>
                    {deptOptions.map((d) => (
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
                    value={add.lead}
                    onChange={(e) => setAdd({ ...add, lead: e.target.value })}
                  />
                </td>
                <td>
                  <button className="btn" disabled={busy === '__add__'} onClick={() => void addRow()}>
                    + Thêm
                  </button>
                </td>
              </tr>

              {rows.map((r) => (
                <tr key={r.email}>
                  <td>
                    <input
                      className="ed-cell"
                      value={r.pic_name}
                      onChange={(e) => patchRow(r.email, { pic_name: e.target.value })}
                    />
                  </td>
                  <td>
                    <span title="Đổi email: xoá rồi thêm lại" style={{ color: '#475569' }}>
                      {r.email}
                    </span>
                  </td>
                  <td>
                    <select
                      className="ed-cell"
                      value={r.dept}
                      onChange={(e) => patchRow(r.email, { dept: e.target.value })}
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
                      onChange={(e) => patchRow(r.email, { lead: e.target.value })}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" disabled={busy === r.email} onClick={() => void saveRow(r)}>
                      Lưu
                    </button>
                    <button
                      className="btn danger"
                      disabled={busy === r.email}
                      onClick={() => void removeRow(r.email, r.pic_name)}
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
