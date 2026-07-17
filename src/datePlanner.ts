import type { ProjectDetail, ProjectNode } from './types'

export type NodeDates = { start: Date; due: Date }

function isoLocal(d: Date) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

// Holidays from the original HTML (expand later if needed)
const VN_HOLIDAYS = new Set([
  // 2025
  '2025-01-01',
  '2025-01-28',
  '2025-01-29',
  '2025-01-30',
  '2025-01-31',
  '2025-02-01',
  '2025-04-07',
  '2025-04-30',
  '2025-05-01',
  '2025-09-01',
  '2025-09-02',
  // 2026
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-04-26',
  '2026-04-30',
  '2026-05-01',
  '2026-09-02',
  '2026-09-03',
  // 2027
  '2027-01-01',
  '2027-02-05',
  '2027-02-06',
  '2027-02-07',
  '2027-02-08',
  '2027-02-09',
  '2027-04-16',
  '2027-04-30',
  '2027-05-01',
  '2027-09-02',
  // 2028
  '2028-01-01',
  '2028-01-25',
  '2028-01-26',
  '2028-01-27',
  '2028-01-28',
  '2028-01-29',
  '2028-04-04',
  '2028-04-30',
  '2028-05-01',
  '2028-09-02',
])

function isWorkingDay(d: Date) {
  if (d.getDay() === 0) return false // Sunday
  if (VN_HOLIDAYS.has(isoLocal(d))) return false
  return true
}

function addWorkingDays(start: Date, n: number) {
  const cur = new Date(start)
  if (n <= 0) return cur
  let added = 0
  while (added < n) {
    cur.setDate(cur.getDate() + 1)
    if (isWorkingDay(cur)) added++
  }
  return cur
}

// Nghịch đảo addWorkingDays: đếm số ngày làm việc từ `start` tới `target`.
// Dùng khi quản lý chọn thẳng ngày dự kiến -> suy ra Số ngày.
export function workingDaysBetween(start: Date, target: Date) {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  if (t <= s) return 0
  const cur = new Date(s)
  let count = 0
  while (cur < t) {
    cur.setDate(cur.getDate() + 1)
    if (isWorkingDay(cur)) count++
  }
  return count
}

export function parseLocalDate(s: string | null | undefined) {
  if (!s) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s))
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function getDuration(node: ProjectNode) {
  if (node.status === 'Bỏ qua') return 0
  if (typeof node.duration === 'number' && node.duration >= 0) return node.duration
  return 0
}

// DAG planner: computes {start,due} for each nodeId based on `after`, status, actual_date.
export function computeAllDates(project: ProjectDetail): Record<string, NodeDates> {
  const nodeById = new Map(project.nodes.map((n) => [n.node_id, n]))
  const cache: Record<string, NodeDates> = {}
  const visiting: Record<string, boolean> = {}

  const projectStart = parseLocalDate(project.project.start_date) || new Date()

  function compute(nodeId: string): NodeDates {
    if (cache[nodeId]) return cache[nodeId]
    if (visiting[nodeId]) {
      // Cycle safety: treat as root to avoid infinite recursion
      const d = new Date(projectStart)
      return { start: d, due: d }
    }

    const node = nodeById.get(nodeId)
    if (!node) {
      const d = new Date(projectStart)
      const out = { start: d, due: d }
      cache[nodeId] = out
      return out
    }

    visiting[nodeId] = true

    const deps = (node.after || []).filter((d) => d !== nodeId && nodeById.has(d))

    let start: Date
    if (deps.length === 0) {
      start = new Date(projectStart)
    } else {
      const finishes = deps.map((depId) => {
        const depNode = nodeById.get(depId)
        const actual = parseLocalDate(depNode?.actual_date || null)
        const depDates = compute(depId)
        return (actual || depDates.due).getTime()
      })
      start = new Date(Math.max(...finishes))
    }

    const dur = getDuration(node)
    const due = addWorkingDays(start, dur)

    visiting[nodeId] = false
    const out = { start, due }
    cache[nodeId] = out
    return out
  }

  for (const n of project.nodes) compute(n.node_id)
  return cache
}

export function lateDays(project: ProjectDetail, nodeId: string, dates: Record<string, NodeDates>) {
  const node = project.nodes.find((n) => n.node_id === nodeId)
  if (!node) return 0
  if (node.status === 'Bỏ qua') return 0
  const due = dates[nodeId]?.due
  if (!due) return 0

  // Có ngày thực tế -> tính trễ theo ngày HOÀN THÀNH (muộn hơn dự kiến bao nhiêu ngày).
  // Xong nhưng chưa nhập ngày -> không tính. Chưa xong -> tính theo HÔM NAY (đang trễ).
  const actual = parseLocalDate(node.actual_date)
  if (!actual && node.status === 'Đã xong') return 0
  let ref: Date
  if (actual) {
    ref = actual
  } else {
    ref = new Date()
    ref.setHours(0, 0, 0, 0)
  }
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diff = Math.floor((refDay.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

