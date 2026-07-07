import type { NodePatchPayload, ProjectDetail, ProjectSummary } from './types'
import type { AuthUser } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const TOKEN_KEY = 'feelex_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  })

  if (response.status === 401 && !path.startsWith('/api/auth')) {
    clearToken()
    window.dispatchEvent(new Event('auth:logout'))
  }

  if (!response.ok) {
    let message = ''
    try {
      const body = await response.json()
      message = body?.error || ''
    } catch {
      message = ''
    }
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  // ----- Auth -----
  requestCode: (email: string) =>
    request<{ ok: true; delivered: string; ttlMinutes: number }>(
      '/api/auth/request-code',
      { method: 'POST', body: JSON.stringify({ email }) },
    ),
  verifyCode: (email: string, code: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  elevate: (code: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/elevate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  me: () => request<{ user: AuthUser }>('/api/auth/me'),

  // ----- Upload file (Cloudflare R2) -----
  uploadFile: async (file: File): Promise<{ name: string; url: string }> => {
    const token = getToken()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE_URL}/api/uploads`, {
      method: 'POST',
      // KHÔNG set Content-Type để trình duyệt tự thêm multipart boundary.
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      let message = ''
      try {
        message = (await res.json())?.error || ''
      } catch {
        message = ''
      }
      throw new Error(message || `Tải file lỗi: ${res.status}`)
    }
    return res.json() as Promise<{ name: string; url: string }>
  },

  // ----- PIC members -----
  listPicMembers: () =>
    request<
      {
        email: string
        pic_name: string
        dept?: string | null
        is_leader?: boolean | null
        lead_depts?: string[] | null
      }[]
    >('/api/pic-members'),
  savePicMember: (payload: {
    email: string
    pic_name: string
    dept?: string | null
    lead_depts?: string[]
  }) =>
    request('/api/pic-members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deletePicMember: (email: string) =>
    request<{ ok: true }>(
      `/api/pic-members?email=${encodeURIComponent(email)}`,
      { method: 'DELETE' },
    ),

  // ----- Projects -----
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
    category?: string | null
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
      category: string | null
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
