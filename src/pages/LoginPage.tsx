import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

export function LoginPage() {
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const res = await api.requestCode(email.trim())
      setStep('code')
      setInfo(
        res.delivered === 'console'
          ? 'Chế độ DEV: mã đã được in ra console của backend.'
          : `Đã gửi mã tới Lark của bạn. Mã có hiệu lực ${res.ttlMinutes} phút.`,
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.verifyCode(email.trim(), code.trim())
      loginWithToken(res.token, res.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">Đăng nhập Feelex QLDA</h1>
        <p className="login-sub">
          Đăng nhập bằng email công ty. Mã xác thực được gửi qua chatbot Lark.
        </p>

        {step === 'email' && (
          <form onSubmit={handleRequestCode} className="login-form">
            <label htmlFor="login-email">Email công ty</label>
            <input
              id="login-email"
              type="email"
              autoFocus
              placeholder="@gmail.com or @ozovn.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Đang gửi mã...' : 'Gửi mã đăng nhập'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerify} className="login-form">
            <label htmlFor="login-code">Mã xác thực (6 số)</label>
            <input
              id="login-code"
              inputMode="numeric"
              autoFocus
              placeholder="______"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              required
            />
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => {
                setStep('email')
                setCode('')
                setInfo(null)
                setError(null)
              }}
            >
              ← Đổi email
            </button>
          </form>
        )}

        {info && <div className="login-info">{info}</div>}
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  )
}
