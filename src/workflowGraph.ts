// Sơ đồ quy trình chuẩn 28 bước (A–G) để vẽ dạng flowchart (giống draw.io).
// ĐỒNG BỘ THỦ CÔNG với backend: src/constants/workflowNodes.js
// (đây là dữ liệu tham chiếu tĩnh của quy trình mẫu, không phải dữ liệu 1 dự án cụ thể).

export type WorkflowStep = {
  code: string
  stage: string // chữ cái giai đoạn: A..G
  stageName: string
  name: string
  dept: string
  duration: number
  after: string[]
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { code: 'A1', stage: 'A', stageName: 'Ý tưởng & Duyệt', name: 'Phê duyệt triển khai dự án', dept: 'RD', duration: 15, after: [] },
  { code: 'B1', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Chuẩn bị nguyên liệu nghiên cứu', dept: 'PP', duration: 15, after: ['A1'] },
  { code: 'B2', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Nghiên cứu bào chế', dept: 'RD', duration: 15, after: ['B1'] },
  { code: 'B3', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Đánh giá cảm quan', dept: 'RD', duration: 3, after: ['B2'] },
  { code: 'B4', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Đánh giá tác dụng sơ bộ', dept: 'RD', duration: 15, after: ['B2'] },
  { code: 'B5', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Chốt mẫu nghiên cứu', dept: 'RD', duration: 3, after: ['B3', 'B4'] },
  { code: 'B6', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Theo dõi sự ổn định', dept: 'RD', duration: 60, after: ['B5'] },
  { code: 'B7', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Order pha mẫu nhà máy', dept: 'RD', duration: 1, after: ['B5'] },
  { code: 'B8', stage: 'B', stageName: 'Nghiên cứu bào chế', name: 'Xây dựng hồ sơ sản phẩm dự kiến', dept: 'RD', duration: 3, after: ['B5'] },
  { code: 'C1', stage: 'C', stageName: 'Bao bì', name: 'Ý tưởng bao bì', dept: 'TK', duration: 14, after: ['A1'] },
  { code: 'C2', stage: 'C', stageName: 'Bao bì', name: 'Mẫu bao bì', dept: 'PP', duration: 14, after: ['C1'] },
  { code: 'C3', stage: 'C', stageName: 'Bao bì', name: 'Ý tưởng thiết kế', dept: 'TK', duration: 7, after: ['B5', 'C2'] },
  { code: 'C4', stage: 'C', stageName: 'Bao bì', name: 'Thiết kế bao bì', dept: 'TK', duration: 7, after: ['E1', 'C3'] },
  { code: 'C5', stage: 'C', stageName: 'Bao bì', name: 'Thiết kế duyệt in', dept: 'TK', duration: 3, after: ['E2'] },
  { code: 'D1', stage: 'D', stageName: 'Khả thi sản xuất', name: 'Đánh giá khả thi công bố', dept: '', duration: 5, after: ['B8'] },
  { code: 'D2', stage: 'D', stageName: 'Khả thi sản xuất', name: 'Đánh giá khả thi sản xuất', dept: 'PP', duration: 5, after: ['B7'] },
  { code: 'D3', stage: 'D', stageName: 'Khả thi sản xuất', name: 'Pha mẫu và sửa mẫu', dept: 'PP', duration: 20, after: ['D2'] },
  { code: 'D4', stage: 'D', stageName: 'Khả thi sản xuất', name: 'Phê duyệt NCC gia công', dept: 'PP', duration: 7, after: ['D3'] },
  { code: 'D5', stage: 'D', stageName: 'Khả thi sản xuất', name: 'Theo dõi độ ổn định chính thức tại nhà máy', dept: 'PP', duration: 90, after: ['D4'] },
  { code: 'E1', stage: 'E', stageName: 'Công bố', name: 'Soạn hồ sơ công bố', dept: '', duration: 7, after: ['D4'] },
  { code: 'E2', stage: 'E', stageName: 'Công bố', name: 'Duyệt hồ sơ', dept: '', duration: 15, after: ['C4'] },
  { code: 'E3', stage: 'E', stageName: 'Công bố', name: 'Đăng ký quảng cáo', dept: 'PC', duration: 20, after: ['E2'] },
  { code: 'F1', stage: 'F', stageName: 'Ra mắt & Truyền thông', name: 'Đào tạo sản phẩm', dept: 'RD', duration: 14, after: ['E2'] },
  { code: 'F2', stage: 'F', stageName: 'Ra mắt & Truyền thông', name: 'Chuẩn bị launching', dept: 'Sale', duration: 30, after: ['F1'] },
  { code: 'G1', stage: 'G', stageName: 'Sản xuất lô đầu', name: 'Xây dựng tài liệu sản xuất', dept: 'RD', duration: 3, after: ['C5'] },
  { code: 'G2', stage: 'G', stageName: 'Sản xuất lô đầu', name: 'Sản xuất lô đầu và kiểm nghiệm', dept: 'PP', duration: 60, after: ['G1'] },
  { code: 'G3', stage: 'G', stageName: 'Sản xuất lô đầu', name: 'Kiểm tra cảm quan mẫu', dept: 'RD', duration: 8, after: ['G2'] },
  { code: 'G4', stage: 'G', stageName: 'Sản xuất lô đầu', name: 'Nhập kho', dept: 'PP', duration: 3, after: ['G3'] },
]

// Màu theo giai đoạn (viền + nền nhạt).
export const STAGE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  A: { border: '#6366f1', bg: '#eef2ff', text: '#3730a3' },
  B: { border: '#0ea5e9', bg: '#e0f2fe', text: '#075985' },
  C: { border: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
  D: { border: '#10b981', bg: '#d1fae5', text: '#065f46' },
  E: { border: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
  F: { border: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6' },
  G: { border: '#64748b', bg: '#e2e8f0', text: '#334155' },
}

export const STAGE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

export const STAGE_NAMES: Record<string, string> = Object.fromEntries(
  WORKFLOW_STEPS.map((s) => [s.stage, s.stageName]),
)

export type LaidOutNode = WorkflowStep & {
  x: number
  y: number
  layer: number
}

export type Edge = { from: string; to: string }

export type GraphLayout = {
  nodes: LaidOutNode[]
  edges: Edge[]
  width: number
  height: number
  box: { w: number; h: number }
}

const BOX_W = 176
const BOX_H = 66
const ROW_GAP = 54 // khoảng trống dọc giữa 2 tầng
const COL_W = 210 // bước ngang giữa các ô cùng tầng
const PAD = 40

// Xếp tầng DAG: layer = đường đi dài nhất từ gốc (longest-path layering),
// nhờ đó mọi mũi tên đều đi từ trên xuống dưới, không có cạnh lùi.
export function layoutWorkflow(steps: WorkflowStep[] = WORKFLOW_STEPS): GraphLayout {
  const byId = new Map(steps.map((s) => [s.code, s]))
  const deps = (id: string) => (byId.get(id)?.after || []).filter((d) => byId.has(d))

  // 1) layer bằng đệ quy đường dài nhất (memo hoá).
  const layer = new Map<string, number>()
  function computeLayer(id: string, stack = new Set<string>()): number {
    if (layer.has(id)) return layer.get(id)!
    if (stack.has(id)) return 0 // an toàn nếu lỡ có vòng
    stack.add(id)
    const ds = deps(id)
    const l = ds.length === 0 ? 0 : Math.max(...ds.map((d) => computeLayer(d, stack) + 1))
    stack.delete(id)
    layer.set(id, l)
    return l
  }
  for (const s of steps) computeLayer(s.code)

  // 2) gom theo tầng.
  const maxLayer = Math.max(...Array.from(layer.values()))
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const s of steps) layers[layer.get(s.code)!].push(s.code)

  // 3) sắp thứ tự (cột) trong mỗi tầng để giảm cắt nhau: theo trung bình vị trí cha.
  const orderInLayer = new Map<string, number>()
  layers.forEach((ids, li) => {
    const keyed = ids.map((id) => {
      const parents = deps(id)
      const key =
        parents.length === 0
          ? 0
          : parents.reduce((sum, p) => sum + (orderInLayer.get(p) ?? 0), 0) / parents.length
      return { id, key }
    })
    keyed.sort((a, b) => a.key - b.key || a.id.localeCompare(b.id))
    keyed.forEach((k, i) => orderInLayer.set(k.id, i))
    // ghi lại thứ tự đã sắp cho tầng
    layers[li] = keyed.map((k) => k.id)
  })

  const maxCols = Math.max(...layers.map((l) => l.length))
  const rowH = BOX_H + ROW_GAP

  const nodes: LaidOutNode[] = []
  layers.forEach((ids, li) => {
    // căn giữa mỗi tầng theo chiều ngang cho cân đối.
    const offset = ((maxCols - ids.length) * COL_W) / 2
    ids.forEach((id, ci) => {
      const s = byId.get(id)!
      nodes.push({
        ...s,
        layer: li,
        x: PAD + offset + ci * COL_W,
        y: PAD + li * rowH,
      })
    })
  })

  const edges: Edge[] = []
  for (const s of steps) for (const d of deps(s.code)) edges.push({ from: d, to: s.code })

  const width = PAD * 2 + maxCols * COL_W - (COL_W - BOX_W)
  const height = PAD * 2 + (maxLayer + 1) * rowH - ROW_GAP

  return { nodes, edges, width, height, box: { w: BOX_W, h: BOX_H } }
}
