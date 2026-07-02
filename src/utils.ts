export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

export function formatLocalDate(date: Date): string {
  return date.toLocaleDateString('vi-VN')
}

export function getStatusClass(status: string): string {
  if (status === 'Đã xong') return 'status-done'
  if (status === 'Đang làm') return 'status-doing'
  if (status === 'Tạm dừng') return 'status-pause'
  if (status === 'Bỏ qua') return 'status-skip'
  return 'status-todo'
}

