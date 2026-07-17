// Nguồn PIC canonical cho toàn app: lấy từ DB bảng pic_members qua /api/pic-members.
// Cache ở module + hook usePicMembers() để mọi ô chọn/lọc/nhập PIC dùng chung.
import { useEffect, useState } from 'react'
import { api } from './api'

export type PicMember = {
  open_id?: string | null
  email?: string | null
  pic_name: string
  dept?: string | null
  is_leader?: boolean | null
  lead_depts?: string[] | null
}

// Trường pic của 1 bước giờ là MẢNG tên (nhiều PIC/1 bước, cùng phòng). Quy mọi
// kiểu (mảng / chuỗi cũ / null) về mảng tên sạch, và ngược lại để hiển thị.
export function toPicArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map((s) => (s || '').trim()).filter(Boolean)
  const s = (value || '').trim()
  return s ? [s] : []
}

export function picText(value: string[] | string | null | undefined, sep = ', '): string {
  return toPicArray(value).join(sep)
}

export function normName(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

let cache: PicMember[] = []
let loaded = false
let inflight: Promise<PicMember[]> | null = null
const listeners = new Set<() => void>()

export function getPicMembers(): PicMember[] {
  return cache
}

export async function loadPicMembers(force = false): Promise<PicMember[]> {
  if (loaded && !force) return cache
  if (inflight) return inflight
  inflight = api
    .listPicMembers()
    .then((rows) => {
      cache = Array.isArray(rows) ? rows : []
      loaded = true
      inflight = null
      listeners.forEach((l) => l())
      return cache
    })
    .catch(() => {
      inflight = null
      return cache
    })
  return inflight
}

export function usePicMembers(): PicMember[] {
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((x) => x + 1)
    listeners.add(l)
    void loadPicMembers()
    return () => {
      listeners.delete(l)
    }
  }, [])
  return cache
}

// Tìm người trong pic_members khớp tên (khớp gần đúng, bỏ dấu).
export function findPicMember(pic: string): PicMember | null {
  const q = normName(pic)
  if (!q) return null
  return (
    cache.find((m) => {
      const n = normName(m.pic_name)
      return n === q || n.endsWith(q) || q.endsWith(n)
    }) || null
  )
}

// Phòng ban của PIC theo pic_members ('' nếu không khớp / chưa khai báo).
export function picDeptOf(pic: string): string {
  const m = findPicMember(pic)
  return (m?.dept || '').trim()
}

// Tất cả phòng ban khai báo trong pic_members.
export function picMemberDepts(): string[] {
  const set = new Set<string>()
  for (const m of cache) {
    const d = (m.dept || '').trim()
    if (d) set.add(d)
  }
  return Array.from(set)
}

// Tên PIC khớp người trong pic_members VÀ có liên hệ (open_id hoặc email) -> sẽ
// nhận nhắc qua Lark. open_id tới được cả người đăng ký bằng SĐT/ẩn mail.
export function isPicMapped(pic: string): boolean {
  const m = findPicMember(pic)
  return !!(m && (m.open_id || m.email))
}

const LEADER_LABEL_PREFIX = 'Trưởng phòng '
export function isLeaderLabel(pic: string): boolean {
  return String(pic || '').trim().startsWith(LEADER_LABEL_PREFIX)
}

export function picBadge(pic: string) {
  if (!pic.trim()) return null
  // Nhãn vai trò mặc định "Trưởng phòng RD" — do trưởng phòng phụ trách theo quyền phòng.
  if (isLeaderLabel(pic)) {
    return {
      symbol: '★',
      title: `Mặc định: ${pic.trim()} — trưởng phòng phòng này phụ trách (có thể phân lại cho PIC cụ thể)`,
      color: '#2563eb',
    }
  }
  if (isPicMapped(pic)) {
    return {
      symbol: '✓',
      title: 'Đã khớp PIC trong danh bạ (có liên hệ Lark) — sẽ nhận nhắc deadline qua Lark',
      color: '#059669',
    }
  }
  return {
    symbol: '⚠',
    title:
      'Chưa khớp PIC trong bảng pic_members (hoặc chưa có liên hệ Lark) — sẽ KHÔNG nhận DM nhắc. Hãy chọn đúng tên từ gợi ý.',
    color: '#d97706',
  }
}
