import { useMemo, useState } from 'react'
import {
  layoutWorkflow,
  STAGE_COLORS,
  STAGE_ORDER,
  STAGE_NAMES,
  type LaidOutNode,
} from '../workflowGraph'

// Đường cong bezier dọc giữa 2 ô (ra ở cạnh đáy cha -> vào cạnh đỉnh con).
function edgePath(from: LaidOutNode, to: LaidOutNode, w: number, h: number) {
  const x1 = from.x + w / 2
  const y1 = from.y + h
  const x2 = to.x + w / 2
  const y2 = to.y
  const dy = Math.max(30, (y2 - y1) / 2)
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`
}

export function WorkflowMapPage() {
  const layout = useMemo(() => layoutWorkflow(), [])
  const [scale, setScale] = useState(1)
  const [hover, setHover] = useState<string | null>(null)

  const nodeById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.code, n])),
    [layout],
  )

  // Tập cạnh & node được làm nổi khi hover 1 bước (chính nó + cha + con trực tiếp).
  const active = useMemo(() => {
    if (!hover) return null
    const nodes = new Set<string>([hover])
    const edges = new Set<string>()
    for (const e of layout.edges) {
      if (e.from === hover || e.to === hover) {
        edges.add(`${e.from}->${e.to}`)
        nodes.add(e.from)
        nodes.add(e.to)
      }
    }
    return { nodes, edges }
  }, [hover, layout])

  const { w, h } = layout.box

  return (
    <div className="wf-page">
      <div className="wf-head">
        <div className="wf-title">
          <h3>Sơ đồ quy trình 28 bước</h3>
          <span className="wf-sub">
            7 giai đoạn A–G · mũi tên = thứ tự phụ thuộc (bước sau chỉ bắt đầu khi
            bước trước xong)
          </span>
        </div>
        <div className="wf-tools">
          <div className="wf-legend">
            {STAGE_ORDER.map((s) => (
              <span key={s} className="wf-legend-item">
                <span
                  className="wf-legend-dot"
                  style={{ background: STAGE_COLORS[s].border }}
                />
                {s}. {STAGE_NAMES[s]}
              </span>
            ))}
          </div>
          <div className="wf-zoom">
            <button
              type="button"
              className="btn sm"
              onClick={() => setScale((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
            >
              −
            </button>
            <span className="wf-zoom-val">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              className="btn sm"
              onClick={() => setScale((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            >
              +
            </button>
            <button type="button" className="btn sm" onClick={() => setScale(1)}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="wf-canvas">
        <svg
          width={layout.width * scale}
          height={layout.height * scale}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          <defs>
            <marker
              id="wf-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="7.5"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#94a3b8" />
            </marker>
            <marker
              id="wf-arrow-on"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="4.5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#2e5266" />
            </marker>
          </defs>

          {/* Cạnh (vẽ trước để nằm dưới ô) */}
          <g>
            {layout.edges.map((e) => {
              const from = nodeById.get(e.from)
              const to = nodeById.get(e.to)
              if (!from || !to) return null
              const on = active?.edges.has(`${e.from}->${e.to}`)
              const dim = active && !on
              return (
                <path
                  key={`${e.from}->${e.to}`}
                  d={edgePath(from, to, w, h)}
                  fill="none"
                  stroke={on ? '#2e5266' : '#94a3b8'}
                  strokeWidth={on ? 2.4 : 1.4}
                  opacity={dim ? 0.15 : 1}
                  markerEnd={on ? 'url(#wf-arrow-on)' : 'url(#wf-arrow)'}
                />
              )
            })}
          </g>

          {/* Ô các bước */}
          <g>
            {layout.nodes.map((n) => {
              const c = STAGE_COLORS[n.stage]
              const on = active?.nodes.has(n.code)
              const dim = active && !on
              return (
                <g
                  key={n.code}
                  transform={`translate(${n.x}, ${n.y})`}
                  opacity={dim ? 0.25 : 1}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(n.code)}
                  onMouseLeave={() => setHover(null)}
                >
                  <rect
                    width={w}
                    height={h}
                    rx={9}
                    fill={c.bg}
                    stroke={c.border}
                    strokeWidth={hover === n.code ? 2.6 : 1.6}
                  />
                  {/* dải màu giai đoạn bên trái */}
                  <rect width={6} height={h} rx={3} fill={c.border} />
                  <text x={16} y={22} className="wf-node-code" fill={c.text}>
                    {n.code}
                  </text>
                  <text x={44} y={22} className="wf-node-meta" fill="#64748b">
                    {[n.dept, `${n.duration}n`].filter(Boolean).join(' · ')}
                  </text>
                  <text x={16} y={42} className="wf-node-name" fill="#1e293b">
                    {n.name.length > 26 ? n.name.slice(0, 25) + '…' : n.name}
                  </text>
                  {n.after.length > 0 && (
                    <text x={16} y={58} className="wf-node-after" fill="#94a3b8">
                      ← {n.after.join(', ')}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
