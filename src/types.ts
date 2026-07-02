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

export type ProjectNode = {
  id: number
  project_id: number
  node_id: string
  status: string
  pic: string | null
  duration: number
  actual_date: string | null
  notes: string | null
  dept: string | null
  after: string[]
  node_name?: string
  stage?: string
}

export type ProjectDetail = {
  project: ProjectSummary & Record<string, unknown>
  nodes: ProjectNode[]
}

export type NodePatchPayload = Partial<{
  status: string
  pic: string
  duration: number
  actual_date: string | null
  notes: string
  dept: string
  after: string[]
}>

