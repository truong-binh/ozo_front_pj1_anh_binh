import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

// 2 cách đăng nhập:
//  - 'lark' (mặc định): nhắn bot "đăng nhập" để nhận OTP, nhập mã (web tự biết PIC).
//  - 'email' (dự phòng): OTP gửi qua email như cũ.
export function LoginPage() {
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const [mode, setMode] = useState<'lark' | 'email'>('lark')

  // --- Lark bot OTP ---
  const [larkCode, setLarkCode] = useState('')

  // --- Email OTP (dự phòng) ---
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function resetMessages() {
    setInfo(null)
    setError(null)
  }

  async function handleLarkVerify(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    setBusy(true)
    try {
      const res = await api.verifyLarkCode(larkCode.trim())
      loginWithToken(res.token, res.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Vào xem nhanh, không cần mã: chỉ mở bảng "Ngày hàng về" (G4) ở Milestone.
  async function handleGuest() {
    resetMessages()
    setBusy(true)
    try {
      const res = await api.guestLogin()
      loginWithToken(res.token, res.user)
      navigate('/milestone', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    setBusy(true)
    try {
      const res = await api.requestCode(email.trim())
      setStep('code')
      setInfo(
        res.delivered === 'console'
          ? 'Chế độ DEV: mã đã được in ra console của backend.'
          : `Đã gửi mã tới email của bạn. Mã có hiệu lực ${res.ttlMinutes} phút. (Kiểm tra cả hộp thư Spam.)`,
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
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

        {mode === 'lark' && (
          <>
            <p className="login-sub">
              Mở chat riêng với <strong>Feelex QLDA Bot</strong> trên Lark, gõ{' '}
              <strong>đăng nhập</strong> để nhận mã. Nhập mã đó vào đây.
            </p>
            <form onSubmit={handleLarkVerify} className="login-form">
              <label htmlFor="lark-code">Mã đăng nhập (6 số)</label>
              <input
                id="lark-code"
                inputMode="numeric"
                autoFocus
                placeholder="______"
                maxLength={6}
                value={larkCode}
                onChange={(e) =>
                  setLarkCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                required
              />
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? 'Đang xác thực...' : 'Đăng nhập'}
              </button>
            </form>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => {
                setMode('email')
                resetMessages()
              }}
              style={{ color: "black" }}
            >
              Đăng nhập bằng email
            </button>
          </>
        )}

        {mode === 'email' && (
          <>
            <p className="login-sub">
              Đăng nhập bằng email công ty. Mã xác thực sẽ được gửi tới email của bạn.
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
                    resetMessages()
                  }}
                >
                  ← Đổi email
                </button>
              </form>
            )}

            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => {
                setMode('lark')
                setStep('email')
                setCode('')
                resetMessages()
              }}
            >
              ← Đăng nhập qua Lark Bot
            </button>
          </>
        )}

        {/* Chung cho cả 2 cách đăng nhập: xem nhanh ngày hàng về, không cần mã. */}
        <div className="login-divider">hoặc</div>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => void handleGuest()}
          style={{ color: "black" }}
        >
          👁 Chỉ xem — 🚚 Ngày hàng về
        </button>

        {info && <div className="login-info">{info}</div>}
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  )
}
