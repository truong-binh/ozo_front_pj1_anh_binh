import { useEffect, useState } from 'react'
import { api } from '../api'
import type { FeedbackRow, SuggestionRow } from '../api'
import { useAuth } from '../auth'

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function ratingLabel(rating: string | null) {
  if (rating === 'good') return { text: '👍 Tốt', cls: 'fb-rating-good' }
  if (rating === 'improve') return { text: '👎 Cần cải thiện', cls: 'fb-rating-improve' }
  return { text: rating || '—', cls: '' }
}

export function FeedbackPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listChatbotFeedback()
      setSuggestions(data.suggestions || [])
      setFeedback(data.feedback || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isManager) void load()
    else setLoading(false)
  }, [isManager])

  async function doneSuggestion(id: number) {
    if (!window.confirm('Xoá góp ý này?')) return
    setBusy(`s-${id}`)
    try {
      await api.deleteSuggestion(id)
      setSuggestions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function doneFeedback(id: number) {
    if (!window.confirm('Xoá feedback này?')) return
    setBusy(`f-${id}`)
    try {
      await api.deleteFeedback(id)
      setFeedback((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!isManager) {
    return (
      <div className="empty-state">
        Trang này chỉ dành cho Quản lý. Nhập mã quản lý ở góc trên để xem.
      </div>
    )
  }

  if (loading) return <div className="empty-state">Đang tải...</div>
  if (error) return <div className="empty-state">Lỗi: {error}</div>

  return (
    <div className="fb-page">
      <div className="fb-head">
        <h2>Góp ý &amp; Feedback từ chatbot</h2>
      </div>

      <section className="fb-section">
        <h3 className="fb-section-title">
          💡 Góp ý <span className="fb-count">{suggestions.length}</span>
        </h3>
        {suggestions.length === 0 ? (
          <div className="fb-empty">Chưa có góp ý nào.</div>
        ) : (
          <div className="fb-list">
            {suggestions.map((s) => (
              <div className="fb-card" key={s.id}>
                <div className="fb-card-body">
                  <div className="fb-meta">
                    <b>{s.pic_name || 'Ẩn danh'}</b>
                    <span className="fb-time">{fmtDateTime(s.created_at)}</span>
                  </div>
                  <div className="fb-message">{s.message}</div>
                </div>
                <button
                  className="btn primary fb-done"
                  disabled={busy === `s-${s.id}`}
                  onClick={() => void doneSuggestion(s.id)}
                >
                  {busy === `s-${s.id}` ? '...' : '✓ Xong'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="fb-section">
        <h3 className="fb-section-title">
          ⭐ Feedback câu trả lời <span className="fb-count">{feedback.length}</span>
        </h3>
        {feedback.length === 0 ? (
          <div className="fb-empty">Chưa có feedback nào.</div>
        ) : (
          <div className="fb-list">
            {feedback.map((f) => {
              const r = ratingLabel(f.rating)
              return (
                <div className="fb-card" key={f.id}>
                  <div className="fb-card-body">
                    <div className="fb-meta">
                      <b>{f.pic_name || 'Ẩn danh'}</b>
                      <span className={`fb-rating ${r.cls}`}>{r.text}</span>
                      {f.provider && <span className="fb-tag">{f.provider}</span>}
                      <span className="fb-time">{fmtDateTime(f.rated_at || f.created_at)}</span>
                    </div>
                    <div className="fb-qa">
                      <div className="fb-q">
                        <span className="fb-qa-label">Hỏi</span>
                        {f.question}
                      </div>
                      <div className="fb-a">
                        <span className="fb-qa-label">Đáp</span>
                        {f.answer}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn primary fb-done"
                    disabled={busy === `f-${f.id}`}
                    onClick={() => void doneFeedback(f.id)}
                  >
                    {busy === `f-${f.id}` ? '...' : '✓ Xong'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
