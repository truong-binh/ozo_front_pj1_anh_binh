import { PIC_DIRECTORY } from './constants'

function normName(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

const PIC_DIR_NORM = PIC_DIRECTORY.map(([name, dept]) => ({
  name,
  dept,
  n: normName(name),
}))

export function isPicMapped(pic: string) {
  const q = normName(pic)
  if (!q) return false
  return PIC_DIR_NORM.some((d) => d.n === q || d.n.endsWith(q) || q.endsWith(d.n))
}

export function picBadge(pic: string) {
  if (!pic.trim()) return null
  if (isPicMapped(pic)) {
    return {
      symbol: '✓',
      title: 'Đã khớp người Lark — sẽ nhận nhắc deadline qua Lark',
      color: '#059669',
    }
  }
  return {
    symbol: '⚠',
    title:
      'Chưa khớp người trong danh bạ Lark — sẽ KHÔNG nhận DM nhắc (chỉ hiện ở digest nhóm). Hãy chọn đúng tên từ gợi ý.',
    color: '#d97706',
  }
}
