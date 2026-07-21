import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, clearToken, getToken, setToken } from './api'
import { toPicArray } from './picMembers'

// 'guest' = khách bấm nút "Chỉ xem" ở trang đăng nhập: không sửa gì, và chỉ thấy
// bảng Ngày hàng về (G4) trong trang Milestone.
export type Role = 'guest' | 'viewer' | 'PIC' | 'manager'

export type AuthUser = {
  id: number
  email: string
  role: Role
  picName?: string | null
  leadDepts?: string[] | null
}

type Editable = { pic?: string[] | string | null; dept?: string | null }

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  isGuest: boolean
  canEditProject: boolean
  canEditNode: (node: Editable) => boolean
  // Trường bị khoá với PIC thường: Ngày thực tế (luôn — hệ thống tự đóng dấu khi
  // bấm 'Đã xong'), Ghi chú & Đính kèm (sau khi bước đã kết thúc). Chỉ manager và
  // trưởng phòng của chính phòng bước đó mới sửa được các trường này.
  canEditLockedNode: (node: Editable) => boolean
  loginWithToken: (token: string, user: AuthUser) => void
  elevate: (code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .me()
      .then((res) => {
        if (active) setUser(res.user)
      })
      .catch(() => {
        clearToken()
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role
    const picName = (user?.picName || '').trim()
    const leadDepts = Array.isArray(user?.leadDepts) ? user!.leadDepts! : []
    return {
      user,
      loading,
      isGuest: role === 'guest',
      canEditProject: role === 'manager',
      canEditNode: (node: Editable) => {
        if (role === 'manager') return true
        if (role !== 'PIC') return false
        const nodeDept = (node.dept || '').trim()
        // Trưởng phòng: sửa mọi bước thuộc phòng mình quản lý.
        if (nodeDept && leadDepts.includes(nodeDept)) return true
        // PIC thường: chỉ bước có tên mình trong danh sách PIC.
        return !!picName && toPicArray(node.pic).includes(picName)
      },
      canEditLockedNode: (node: Editable) => {
        if (role === 'manager') return true
        if (role !== 'PIC') return false
        const nodeDept = (node.dept || '').trim()
        return !!nodeDept && leadDepts.includes(nodeDept)
      },
      loginWithToken: (token, u) => {
        setToken(token)
        setUser(u)
      },
      elevate: async (code: string) => {
        const res = await api.elevate(code)
        setToken(res.token)
        setUser(res.user)
      },
      logout: () => {
        clearToken()
        setUser(null)
      },
    }
  }, [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider')
  return ctx
}
