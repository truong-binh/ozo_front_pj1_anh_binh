export type ProjectSummary = {
  id: number
  code: string
  name: string
  type: string
  category?: string | null
  product_group: string | null
  owner: string | null
  start_date: string
}

export type Attachment = {
  name: string
  url: string
}

export type ProjectNode = {
  id: number
  project_id: number
  node_id: string
  status: string
  // Nhiều người phụ trách/1 bước (tất cả cùng phòng). Mảng tên PIC.
  pic: string[] | null
  duration: number
  actual_date: string | null
  notes: string | null
  dept: string | null
  after: string[]
  attachments?: Attachment[]
  node_name?: string
  stage?: string
  // Mốc ngày dự kiến cố định, chốt lúc tạo dự án (không trôi theo tiến độ).
  planned_date?: string | null
}

export type ProjectDetail = {
  project: ProjectSummary & Record<string, unknown>
  nodes: ProjectNode[]
}

export type NodePatchPayload = Partial<{
  status: string
  pic: string[]
  duration: number
  actual_date: string | null
  notes: string
  dept: string
  after: string[]
  attachments: Attachment[]
}>

