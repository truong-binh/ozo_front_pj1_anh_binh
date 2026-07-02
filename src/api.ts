import type { NodePatchPayload, ProjectDetail, ProjectSummary } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  listProjects: () => request<ProjectSummary[]>('/api/projects'),
  getProjectDetail: (projectId: string) =>
    request<ProjectDetail>(`/api/projects/${projectId}`),
  listProjectsWithNodes: () =>
    request<Array<ProjectDetail>>('/api/projects/with-nodes'),
  patchProjectNode: (
    projectId: number,
    nodeId: string,
    payload: NodePatchPayload,
  ) =>
    request(`/api/projects/${projectId}/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createProject: (payload: {
    code: string
    name: string
    type: string
    product_group?: string | null
    owner?: string | null
    start_date: string
  }) =>
    request<ProjectSummary>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  patchProject: (
    projectId: number,
    payload: Partial<{
      code: string
      name: string
      type: string
      product_group: string | null
      owner: string | null
      start_date: string
    }>,
  ) =>
    request<ProjectSummary>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteProject: (projectId: number) =>
    request<{ ok: true }>(`/api/projects/${projectId}`, { method: 'DELETE' }),
  seedFromPayload: (payload: { projects: unknown[] }) =>
    request<{ ok: true; total: number }>('/api/projects/seed/from-payload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

