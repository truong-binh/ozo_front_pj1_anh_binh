import { useEffect, useMemo, useState } from 'react'
import type { NodePatchPayload, ProjectDetail, ProjectNode } from '../types'
import { computeAllDates } from '../datePlanner'
import { STATUS_OPTIONS } from '../constants'
import { usePicMembers, picBadge, picDeptOf } from '../picMembers'

function fmtDateDMY(d: Date | null | undefined) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yy = dt.getFullYear()
  return `${dd}/${mm}/${yy}`
}

function afterStringToArray(input: string) {
  const raw = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set(raw))
}

export function NodeEditModal({
  open,
  project,
  node,
  onClose,
  onSave,
}: {
  open: boolean
  project: ProjectDetail
  node: ProjectNode
  onClose: () => void
  onSave: (nodeId: string, payload: NodePatchPayload) => Promise<void>
}) {
  const [status, setStatus] = useState(node.status)
  const [duration, setDuration] = useState<number>(node.duration)
  const [pic, setPic] = useState(node.pic || '')
  const picMembers = usePicMembers()
  const [afterStr, setAfterStr] = useState((node.after || []).join(', '))
  const [actualDate, setActualDate] = useState<string>(node.actual_date || '')
  const [notes, setNotes] = useState(node.notes || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStatus(node.status)
    setDuration(node.duration)
    setPic(node.pic || '')
    setAfterStr((node.after || []).join(', '))
    setActualDate(node.actual_date || '')
    setNotes(node.notes || '')
  }, [open, node])

  const editedProject = useMemo<ProjectDetail>(() => {
    const editedNodes = project.nodes.map((n) => {
      if (n.node_id !== node.node_id) return n
      return {
        ...n,
        status,
        duration,
        pic,
        actual_date: actualDate ? actualDate : null,
        notes,
        after: afterStringToArray(afterStr),
      }
    })
    return { ...project, nodes: editedNodes }
  }, [project, node.node_id, status, duration, pic, actualDate, notes, afterStr])

  const dates = useMemo(() => computeAllDates(editedProject), [editedProject])
  const nodeDates = dates[node.node_id]

  async function handleSave() {
    setSaving(true)
    try {
      const dept = picDeptOf(pic)
      const payload: NodePatchPayload = {
        status,
        pic,
        duration,
        actual_date: actualDate ? actualDate : null,
        notes,
        after: afterStringToArray(afterStr),
        // Chọn PIC nào thì Phòng của bước tự điền theo phòng ban PIC đó.
        ...(dept ? { dept } : {}),
      }
      await onSave(node.node_id, payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const start = nodeDates?.start || null
  const due = nodeDates?.due || null

  return (
    <div className="modal-backdrop show" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Cập nhật bước</h3>
        <div className="modal-sub">
          {node.node_id} - {node.node_name}
        </div>

        <div className="row2">
          <div>
            <label>Trạng thái</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Số ngày để thực hiện</label>
            <div className="dur-stepper">
              <button
                type="button"
                onClick={() => setDuration((d) => Math.max(0, d - 1))}
                disabled={status === 'Bỏ qua'}
              >
                -
              </button>
              <input
                type="number"
                value={duration}
                min={0}
                onChange={(e) => setDuration(Math.max(0, Number(e.target.value || 0)))}
                disabled={status === 'Bỏ qua'}
              />
              <button type="button" onClick={() => setDuration((d) => d + 1)} disabled={status === 'Bỏ qua'}>
                +
              </button>
            </div>
          </div>
        </div>

        <label>
          Người phụ trách (PIC)
          {pic.trim() &&
            (() => {
              const b = picBadge(pic)
              return b ? (
                <span title={b.title} style={{ color: b.color, fontWeight: 700, marginLeft: 6 }}>
                  {b.symbol}
                </span>
              ) : null
            })()}
        </label>
        <input
          type="text"
          value={pic}
          list="picMembersModalList"
          placeholder="Chọn / gõ tên PIC"
          onChange={(e) => setPic(e.target.value)}
        />
        <datalist id="picMembersModalList">
          {picMembers.map((m) => (
            <option key={m.email || m.pic_name} value={m.pic_name}>
              {[m.dept, m.email].filter(Boolean).join(' · ')}
            </option>
          ))}
        </datalist>

        <div className="row2">
          <div>
            <label>Ngày bắt đầu <span className="hint">(tự tính)</span></label>
            <input type="text" value={fmtDateDMY(start)} readOnly />
          </div>
          <div>
            <label>Ngày dự kiến hoàn thành <span className="hint">(tự tính)</span></label>
            <input type="text" value={fmtDateDMY(due)} readOnly />
          </div>
        </div>

        <label>Sau bước (phụ thuộc) <span className="hint">(mã bước, cách nhau dấu phẩy — trống = bước khởi đầu)</span></label>
        <input
          type="text"
          value={afterStr}
          placeholder="VD: C6, D7"
          onChange={(e) => setAfterStr(e.target.value)}
        />

        <div className="row2">
          <div>
            <label>Ngày hoàn thành thực tế</label>
            <input
              type="date"
              value={actualDate}
              onChange={(e) => {
                const v = e.target.value
                setActualDate(v)
                // Điền ngày thực tế -> tự chuyển sang 'Đã xong' (vẫn đổi lại được).
                if (v) setStatus('Đã xong')
              }}
            />
          </div>
          <div>
            <label>Ghi chú / Link tài liệu</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="computed-note">
          <div><b>After:</b> {(node.after || []).join(', ') || '(khởi đầu)'}</div>
          <div><b>Trạng thái hiện tại:</b> {status}</div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>Huỷ</button>
          <button className="btn primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

