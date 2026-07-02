import { useState } from 'react'
import type { NodePatchPayload, ProjectNode } from '../types'
import { STATUS_OPTIONS } from '../constants'
import { formatDate, getStatusClass } from '../utils'
import type { NodeDates } from '../datePlanner'

type Props = {
  nodes: ProjectNode[]
  datesByNodeId: Record<string, NodeDates>
  lateByNodeId: Record<string, number>
  onSaveNode: (nodeId: string, payload: NodePatchPayload) => Promise<void>
  onOpenEdit: (nodeId: string) => void
}

export function NodeTable({
  nodes,
  datesByNodeId,
  lateByNodeId,
  onSaveNode,
  onOpenEdit,
}: Props) {
  const [savingNodeId, setSavingNodeId] = useState<string | null>(null)

  return (
    <table className="node-table">
      <thead>
        <tr>
          <th className="col-id">Mã</th>
          <th className="col-name">Bước</th>
          <th className="col-dept">Phòng</th>
          <th className="col-pic">PIC</th>
          <th className="col-dur">Số ngày</th>
          <th className="col-status">Trạng thái</th>
          <th className="col-date">Ngày dự kiến</th>
          <th className="col-late">Trễ</th>
          <th className="col-date">Ngày thực tế</th>
          <th className="col-notes">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((node) => (
          <tr
            key={node.node_id}
            onClick={() => onOpenEdit(node.node_id)}
            style={{ cursor: 'pointer' }}
          >
            <td className="node-id">{node.node_id}</td>
            <td>{node.node_name || node.node_id}</td>
            <td>{node.dept || '-'}</td>
            <td>{(node.pic || '').trim() || '-'}</td>
            <td style={{ textAlign: 'center' }}>{node.duration}</td>
            <td
              onClick={(e) => {
                // prevent row click when changing select
                e.stopPropagation()
              }}
            >
              <select
                className={`ed-cell ${getStatusClass(node.status)}`}
                value={node.status}
                disabled={savingNodeId === node.node_id}
                onChange={async (event) => {
                  event.stopPropagation()
                  setSavingNodeId(node.node_id)
                  try {
                    await onSaveNode(node.node_id, { status: event.target.value })
                  } finally {
                    setSavingNodeId(null)
                  }
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </td>
            <td style={{ textAlign: 'center' }}>
              {formatDateDMY(datesByNodeId[node.node_id]?.due)}
            </td>
            <td className={lateByNodeId[node.node_id] > 0 ? 'late-text' : ''}>
              {lateByNodeId[node.node_id]}
            </td>
            <td>{formatDate(node.actual_date)}</td>
            <td>{node.notes || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatDateDMY(d?: Date) {
  if (!d) return '-'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yy = dt.getFullYear()
  return `${dd}/${mm}/${yy}`
}

