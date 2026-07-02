import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { STAGE_ORDER } from '../constants'
import { NodeTable } from '../components/NodeTable'
import { NodeEditModal } from '../components/NodeEditModal'
import type { NodePatchPayload, ProjectDetail, ProjectNode } from '../types'
import { formatDate } from '../utils'
import { computeAllDates, lateDays } from '../datePlanner'

function groupNodesByStage(nodes: ProjectNode[]) {
  const grouped = new Map<string, ProjectNode[]>()
  for (const node of nodes) {
    const stageKey = (node.node_id?.charAt(0) || 'X').toUpperCase()
    if (!grouped.has(stageKey)) grouped.set(stageKey, [])
    grouped.get(stageKey)?.push(node)
  }
  return grouped
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getProjectDetail(projectId)
      .then(setDetail)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [projectId])

  const groupedNodes = useMemo(
    () => groupNodesByStage(detail?.nodes || []),
    [detail?.nodes],
  )

  async function handleSaveNode(nodeId: string, payload: NodePatchPayload) {
    if (!detail) return
    await api.patchProjectNode(detail.project.id, nodeId, payload)
    const refreshed = await api.getProjectDetail(projectId)
    setDetail(refreshed)
  }

  const datesByNodeId = useMemo(() => {
    if (!detail) return {}
    return computeAllDates(detail)
  }, [detail])

  const lateByNodeId = useMemo(() => {
    if (!detail) return {}
    const out: Record<string, number> = {}
    for (const n of detail.nodes) {
      out[n.node_id] = lateDays(detail, n.node_id, datesByNodeId)
    }
    return out
  }, [detail, datesByNodeId])

  if (loading) return <div className="empty-state">Đang tải chi tiết dự án...</div>
  if (error) return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>
  if (!detail) return <div className="empty-state">Không tìm thấy dự án.</div>

  return (
    <>
      <Link to="/" className="back-link">
        ← Quay lại danh sách
      </Link>

      <div className="project-header">
        <h2>
          {detail.project.code} - {detail.project.name}
        </h2>
        <div className="meta">
          <span>Loại: {detail.project.type}</span>
          <span>Nhóm: {detail.project.product_group || '-'}</span>
          <span>Owner: {detail.project.owner || '-'}</span>
          <span>Bắt đầu: {formatDate(detail.project.start_date)}</span>
        </div>
      </div>

      {STAGE_ORDER.map((stage) => {
        const nodes = groupedNodes.get(stage) || []
        if (!nodes.length) return null
        return (
          <section key={stage} className={`stage-group stage-${stage}`}>
            <div className="stage-header">
              <span>Giai đoạn {stage}</span>
              <span className="stage-progress">{nodes.length} bước</span>
            </div>
            <NodeTable
              nodes={nodes}
              datesByNodeId={datesByNodeId}
              lateByNodeId={lateByNodeId}
              onSaveNode={handleSaveNode}
              onOpenEdit={(nodeId) => setEditingNodeId(nodeId)}
            />
          </section>
        )
      })}

      {editingNodeId && (
        <NodeEditModal
          open={true}
          project={detail}
          node={detail.nodes.find((n) => n.node_id === editingNodeId)!}
          onClose={() => setEditingNodeId(null)}
          onSave={async (nodeId, payload) => {
            await handleSaveNode(nodeId, payload)
          }}
        />
      )}
    </>
  )
}

