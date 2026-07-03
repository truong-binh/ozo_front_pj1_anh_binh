import { useState } from 'react'
import type { Attachment, NodePatchPayload, ProjectNode } from '../types'
import { DEFAULT_DEPTS, PIC_DIRECTORY, STATUS_OPTIONS } from '../constants'
import { formatLocalDate } from '../utils'
import type { NodeDates } from '../datePlanner'
import { afterStringToArray, createsCycle, getAfter } from '../nodeDeps'
import { picBadge } from '../picDirectory'
import { NODE_DESCRIPTIONS } from '../nodeDescriptions'

type Props = {
  nodes: ProjectNode[]
  allNodes: ProjectNode[]
  deptList: string[]
  datesByNodeId: Record<string, NodeDates>
  lateByNodeId: Record<string, number>
  onSaveNode: (nodeId: string, payload: NodePatchPayload) => Promise<void>
  onToast?: (message: string) => void
}

function formatDateDMY(d?: Date) {
  if (!d) return '—'
  return formatLocalDate(d)
}

function todayIso() {
  const d = new Date()
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

function statusSelectClass(status: string) {
  if (status === 'Đã xong') return 'ed-cell stsel-done'
  if (status === 'Đang làm') return 'ed-cell stsel-doing'
  return 'ed-cell'
}

export function NodeTable({
  nodes,
  allNodes,
  deptList,
  datesByNodeId,
  lateByNodeId,
  onSaveNode,
  onToast,
}: Props) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const validIds = new Set(allNodes.map((n) => n.node_id))
  const depts = Array.from(new Set([...DEFAULT_DEPTS, ...deptList])).filter(Boolean).sort((a, b) =>
    a.localeCompare(b, 'vi'),
  )

  async function save(nodeId: string, payload: NodePatchPayload) {
    setSavingKey(nodeId)
    try {
      await onSaveNode(nodeId, payload)
    } finally {
      setSavingKey(null)
    }
  }

  function toast(msg: string) {
    onToast?.(msg)
  }

  return (
    <>
      <datalist id="picDirectoryList">
        {PIC_DIRECTORY.map(([name, dept]) => (
          <option key={name} value={name}>
            {dept}
          </option>
        ))}
      </datalist>

      <table className="node-table">
        <thead>
          <tr>
            <th className="col-id">Mã</th>
            <th className="col-name">Tên bước</th>
            <th className="col-dept">Phòng</th>
            <th className="col-pic">PIC</th>
            <th className="col-dur">Số ngày</th>
            <th className="col-status">Trạng thái</th>
            <th className="col-date">Bắt đầu</th>
            <th className="col-date">Dự kiến</th>
            <th className="col-date">Thực tế</th>
            <th className="col-late">Trễ</th>
            <th className="col-deps">Sau bước</th>
            <th className="col-notes">Ghi chú</th>
            <th className="col-att">Đính kèm</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const disabled = savingKey === node.node_id
            const badge = picBadge(node.pic || '')
            const attachments = Array.isArray(node.attachments) ? node.attachments : []
            const late = lateByNodeId[node.node_id] || 0
            const dates = datesByNodeId[node.node_id]

            return (
              <tr key={node.node_id}>
                <td>
                  <span className="node-id">{node.node_id}</span>
                </td>
                <td
                  className={node.status === 'Bỏ qua' ? 'name-skipped' : ''}
                  title={NODE_DESCRIPTIONS[node.node_id] || undefined}
                >
                  {node.node_name || node.node_id}
                  {NODE_DESCRIPTIONS[node.node_id] && (
                    <span
                      className="node-desc-info"
                      title={NODE_DESCRIPTIONS[node.node_id]}
                      style={{ marginLeft: 4, color: '#94a3b8', cursor: 'help' }}
                    >
                      ℹ️
                    </span>
                  )}
                </td>
                <td>
                  <select
                    className="ed-cell"
                    value={node.dept || ''}
                    disabled={disabled}
                    onChange={(e) => void save(node.node_id, { dept: e.target.value })}
                  >
                    <option value="">—</option>
                    {[...(node.dept && !depts.includes(node.dept) ? [node.dept] : []), ...depts].map(
                      (d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ),
                    )}
                  </select>
                </td>
                <td>
                  <div className="pic-cell">
                    <input
                      key={`${node.node_id}-pic-${node.pic || ''}`}
                      className="ed-cell"
                      list="picDirectoryList"
                      defaultValue={node.pic || ''}
                      placeholder="Chọn / gõ tên"
                      disabled={disabled}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value !== (node.pic || '').trim()) {
                          void save(node.node_id, { pic: value })
                        }
                      }}
                    />
                    {badge && (
                      <span title={badge.title} style={{ color: badge.color, fontWeight: 700 }}>
                        {badge.symbol}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="dur-stepper">
                    <button
                      type="button"
                      title="Giảm 1 ngày"
                      disabled={disabled}
                      onClick={() =>
                        void save(node.node_id, {
                          duration: Math.max(0, (node.duration || 0) - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <input
                      key={`${node.node_id}-dur-${node.duration}`}
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={node.duration}
                      disabled={disabled}
                      onBlur={(e) => {
                        let value = parseInt(e.target.value, 10)
                        if (Number.isNaN(value) || value < 0) value = 0
                        if (value !== node.duration) {
                          void save(node.node_id, { duration: value })
                        }
                      }}
                    />
                    <button
                      type="button"
                      title="Tăng 1 ngày"
                      disabled={disabled}
                      onClick={() =>
                        void save(node.node_id, {
                          duration: (node.duration || 0) + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </td>
                <td>
                  <select
                    className={statusSelectClass(node.status)}
                    value={node.status}
                    disabled={disabled}
                    onChange={(e) => {
                      const value = e.target.value
                      const payload: NodePatchPayload = { status: value }
                      if (value === 'Đã xong') {
                        if (!node.actual_date) payload.actual_date = todayIso()
                      } else {
                        payload.actual_date = null
                      }
                      void save(node.node_id, payload)
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="col-date">{formatDateDMY(dates?.start)}</td>
                <td className="col-date">{formatDateDMY(dates?.due)}</td>
                <td>
                  <input
                    key={`${node.node_id}-actual-${node.actual_date || ''}`}
                    type="date"
                    className="ed-cell"
                    defaultValue={node.actual_date || ''}
                    disabled={disabled}
                    onBlur={(e) => {
                      const value = e.target.value
                      const current = node.actual_date || ''
                      if (value !== current) {
                        void save(node.node_id, { actual_date: value || null })
                      }
                    }}
                  />
                </td>
                <td className="col-late">
                  {late > 0 ? <span className="late-text">{late}</span> : '—'}
                </td>
                <td>
                  <input
                    key={`${node.node_id}-after-${getAfter(node, validIds).join(',')}`}
                    className="ed-cell"
                    defaultValue={getAfter(node, validIds).join(', ')}
                    placeholder="VD: B3, B4"
                    title="Mã bước, cách nhau dấu phẩy"
                    disabled={disabled}
                    onBlur={(e) => {
                      const tokens = afterStringToArray(e.target.value)
                      for (const t of tokens) {
                        if (!validIds.has(t)) {
                          toast(`Mã bước không tồn tại: ${t}`)
                          e.target.value = getAfter(node, validIds).join(', ')
                          return
                        }
                        if (t === node.node_id) {
                          toast('Bước không thể phụ thuộc chính nó')
                          e.target.value = getAfter(node, validIds).join(', ')
                          return
                        }
                      }
                      if (createsCycle(allNodes, node.node_id, tokens, validIds)) {
                        toast('⚠ Phụ thuộc này tạo vòng lặp — không lưu')
                        e.target.value = getAfter(node, validIds).join(', ')
                        return
                      }
                      const current = getAfter(node, validIds).join(', ')
                      const next = tokens.join(', ')
                      if (next !== current) {
                        void save(node.node_id, { after: tokens })
                      }
                    }}
                  />
                </td>
                <td>
                  <input
                    key={`${node.node_id}-notes-${node.notes || ''}`}
                    className="ed-cell"
                    defaultValue={node.notes || ''}
                    placeholder="Ghi chú"
                    disabled={disabled}
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value !== (node.notes || '').trim()) {
                        void save(node.node_id, { notes: value })
                      }
                    }}
                  />
                </td>
                <td className="col-att">
                  {attachments.map((att, idx) => (
                    <span key={`${att.url}-${idx}`} className="att-chip">
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={att.url}
                      >
                        {att.name || att.url}
                      </a>
                      <button
                        type="button"
                        className="att-x"
                        title="Xoá"
                        disabled={disabled}
                        onClick={() => {
                          const next = attachments.filter((_, i) => i !== idx)
                          void save(node.node_id, { attachments: next })
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="btn sm att-add"
                    title="Gắn link file đính kèm"
                    disabled={disabled}
                    onClick={() => {
                      const url = (
                        prompt(
                          'Dán link file đính kèm (link Google Drive, hoặc đường dẫn file trên ổ Z:\\...):',
                        ) || ''
                      ).trim()
                      if (!url) return
                      const name = (
                        prompt('Tên hiển thị cho file (để trống = dùng link):', '') || ''
                      ).trim()
                      const next: Attachment[] = [...attachments, { name, url }]
                      void save(node.node_id, { attachments: next })
                    }}
                  >
                    📎 +
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
