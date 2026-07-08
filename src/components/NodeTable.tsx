import { useState } from 'react'
import type { Attachment, NodePatchPayload, ProjectNode } from '../types'
import { DEFAULT_DEPTS, STATUS_OPTIONS } from '../constants'
import { formatLocalDate } from '../utils'
import type { NodeDates } from '../datePlanner'
import { afterStringToArray, createsCycle, getAfter } from '../nodeDeps'
import { picBadge, usePicMembers, picDeptOf, picMemberDepts } from '../picMembers'
import { NODE_DESCRIPTIONS } from '../nodeDescriptions'
import { api } from '../api'

type Props = {
  nodes: ProjectNode[]
  allNodes: ProjectNode[]
  deptList: string[]
  datesByNodeId: Record<string, NodeDates>
  lateByNodeId: Record<string, number>
  onSaveNode: (nodeId: string, payload: NodePatchPayload) => Promise<void>
  onToast?: (message: string) => void
  canEditRow?: (node: ProjectNode) => boolean
  projectInfo?: { code: string; name: string }
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

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(url)
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
  canEditRow,
  projectInfo,
}: Props) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveTick, setSaveTick] = useState(0)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [notesEdit, setNotesEdit] = useState<{
    nodeId: string
    value: string
    editable: boolean
  } | null>(null)
  const [imgPreview, setImgPreview] = useState<{
    url: string
    name: string
    nodeId: string
    nodeName: string
  } | null>(null)
  const picMembers = usePicMembers()
  const validIds = new Set(allNodes.map((n) => n.node_id))
  const depts = Array.from(new Set([...DEFAULT_DEPTS, ...picMemberDepts(), ...deptList])).filter(Boolean).sort((a, b) =>
    a.localeCompare(b, 'vi'),
  )

  // Nhóm PIC theo phòng để mỗi ô chỉ xổ PIC của phòng bước đó (vd RD -> chỉ PIC RD).
  // Bước không có phòng / phòng chưa có PIC nào -> fallback danh sách đầy đủ.
  const membersByDept = new Map<string, typeof picMembers>()
  for (const m of picMembers) {
    const d = (m.dept || '').trim()
    if (!d) continue
    if (!membersByDept.has(d)) membersByDept.set(d, [])
    membersByDept.get(d)!.push(m)
  }
  const deptEntries = Array.from(membersByDept.entries())
  const deptIndex = new Map(deptEntries.map(([d], i) => [d, i]))
  const picListIdFor = (dept?: string | null) => {
    const d = (dept || '').trim()
    const i = deptIndex.get(d)
    return i === undefined ? 'picList-all' : `picList-d${i}`
  }

  async function save(nodeId: string, payload: NodePatchPayload) {
    setSavingKey(nodeId)
    try {
      await onSaveNode(nodeId, payload)
    } catch (e) {
      // Bị từ chối (vd chuyển PIC khác phòng) -> báo lỗi; ô sẽ reset về giá trị cũ.
      toast((e as Error).message || 'Lưu không thành công')
    } finally {
      setSavingKey(null)
      setSaveTick((t) => t + 1)
    }
  }

  function toast(msg: string) {
    onToast?.(msg)
  }

  async function saveNotes() {
    if (!notesEdit) return
    const value = notesEdit.value.trim()
    const node = allNodes.find((n) => n.node_id === notesEdit.nodeId)
    if (node && value !== (node.notes || '').trim()) {
      await save(notesEdit.nodeId, { notes: value })
    }
    setNotesEdit(null)
  }

  return (
    <>
      {/* Fallback: đầy đủ (bước không có phòng hoặc phòng chưa có PIC). */}
      <datalist id="picList-all">
        {picMembers.map((m) => (
          <option key={m.email || m.pic_name} value={m.pic_name}>
            {[m.dept, m.email].filter(Boolean).join(' · ')}
          </option>
        ))}
      </datalist>
      {/* Mỗi phòng 1 datalist -> ô của bước chỉ xổ PIC cùng phòng. */}
      {deptEntries.map(([dept, mems], i) => (
        <datalist id={`picList-d${i}`} key={dept}>
          {mems.map((m) => (
            <option key={m.email || m.pic_name} value={m.pic_name}>
              {[m.dept, m.email].filter(Boolean).join(' · ')}
            </option>
          ))}
        </datalist>
      ))}

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
            <th className="col-att">Đính kèm ảnh</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const rowEditable = canEditRow ? canEditRow(node) : true
            const disabled = savingKey === node.node_id || !rowEditable
            const badge = picBadge(node.pic || '')
            const attachments = Array.isArray(node.attachments) ? node.attachments : []
            const late = lateByNodeId[node.node_id] || 0
            const dates = datesByNodeId[node.node_id]

            return (
              <tr
                key={node.node_id}
                className={node.status === 'Đã xong' ? 'row-done' : ''}
              >
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
                      key={`${node.node_id}-pic-${node.pic || ''}-${saveTick}`}
                      className="ed-cell"
                      list={picListIdFor(node.dept)}
                      defaultValue={node.pic || ''}
                      placeholder="Chọn / gõ tên"
                      disabled={disabled}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value !== (node.pic || '').trim()) {
                          // Chọn PIC nào thì Phòng của bước tự điền theo phòng ban PIC đó.
                          const dept = picDeptOf(value)
                          void save(node.node_id, dept ? { pic: value, dept } : { pic: value })
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
                        // Điền ngày thực tế -> tự chuyển bước sang 'Đã xong'.
                        void save(
                          node.node_id,
                          value
                            ? { actual_date: value, status: 'Đã xong' }
                            : { actual_date: null },
                        )
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
                  <button
                    type="button"
                    className="notes-cell-btn"
                    title={node.notes || 'Bấm để ghi chú'}
                    onClick={() =>
                      setNotesEdit({
                        nodeId: node.node_id,
                        value: node.notes || '',
                        editable: !disabled,
                      })
                    }
                  >
                    {node.notes ? (
                      node.notes
                    ) : (
                      <span className="notes-placeholder">Ghi chú…</span>
                    )}
                  </button>
                </td>
                <td className="col-att">
                  {attachments.map((att, idx) => (
                    <span key={`${att.url}-${idx}`} className="att-chip">
                      {isImageUrl(att.url) ? (
                        <a
                          href={att.url}
                          title="Xem ảnh"
                          onClick={(e) => {
                            e.preventDefault()
                            setImgPreview({
                              url: att.url,
                              name: att.name || att.url,
                              nodeId: node.node_id,
                              nodeName: node.node_name || node.node_id,
                            })
                          }}
                        >
                          {att.name || att.url}
                        </a>
                      ) : (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={att.url}
                        >
                          {att.name || att.url}
                        </a>
                      )}
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
                  <label
                    className={`btn sm att-add ${disabled || uploadingKey === node.node_id ? 'is-disabled' : ''}`}
                    title="Tải file đính kèm lên"
                  >
                    {uploadingKey === node.node_id ? 'Đang tải…' : '📎 +'}
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      disabled={disabled || uploadingKey === node.node_id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        setUploadingKey(node.node_id)
                        try {
                          const att = await api.uploadFile(file)
                          const next: Attachment[] = [...attachments, att]
                          await save(node.node_id, { attachments: next })
                        } catch (err) {
                          toast((err as Error).message)
                        } finally {
                          setUploadingKey(null)
                        }
                      }}
                    />
                  </label>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {imgPreview && (
        <div className="modal-backdrop" onClick={() => setImgPreview(null)}>
          <div
            className="img-preview-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="img-preview-head">
              <span className="img-preview-name" title={imgPreview.name}>
                Bước {imgPreview.nodeId}
                {imgPreview.nodeName !== imgPreview.nodeId
                  ? `: ${imgPreview.nodeName}`
                  : ''}{' '}
                — {imgPreview.name}
              </span>
              <div className="img-preview-actions">
                <a
                  href={imgPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn sm"
                >
                  Mở tab mới
                </a>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setImgPreview(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <img
              className="img-preview-img"
              src={imgPreview.url}
              alt={imgPreview.name}
            />
          </div>
        </div>
      )}

      {notesEdit && (
        <div className="modal-backdrop" onClick={() => setNotesEdit(null)}>
          <div
            className="modal-card notes-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="notes-modal-title">
              Ghi chú — bước {notesEdit.nodeId}
              {(() => {
                const node = allNodes.find(
                  (n) => n.node_id === notesEdit.nodeId,
                )
                const nm = node?.node_name
                return nm && nm !== notesEdit.nodeId ? `: ${nm}` : ''
              })()}
            </h3>
            {projectInfo && (
              <div className="notes-modal-sub">
                {projectInfo.code} — {projectInfo.name}
              </div>
            )}
            <textarea
              className="notes-textarea"
              autoFocus
              value={notesEdit.value}
              readOnly={!notesEdit.editable}
              placeholder="Nhập ghi chú..."
              onChange={(e) =>
                setNotesEdit((s) => (s ? { ...s, value: e.target.value } : s))
              }
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn action-btn"
                onClick={() => setNotesEdit(null)}
              >
                {notesEdit.editable ? 'Huỷ' : 'Đóng'}
              </button>
              {notesEdit.editable && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void saveNotes()}
                >
                  Lưu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
