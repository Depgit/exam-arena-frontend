import { useCallback, useEffect, useState } from 'react'
import { getFlaggedQuestions, reviewQuestionFlags } from '../../api/endpoints'

const REASON_LABELS = {
  wrong_answer: 'Wrong answer',
  multiple_correct: 'Multiple correct',
  unclear: 'Unclear',
  typo: 'Typo',
  other: 'Other',
}

const STATUSES = ['open', 'resolved', 'dismissed', 'reviewed', 'all']

export default function AdminFlags() {
  const [status, setStatus] = useState('open')
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(() => {
    setError('')
    getFlaggedQuestions(status)
      .then(({ data }) => setItems(data ?? []))
      .catch((err) => setError(err.message))
  }, [status])

  useEffect(() => {
    setItems(null)
    load()
  }, [load])

  async function review(questionId, body, message) {
    setBusy(questionId)
    setNotice('')
    setError('')
    try {
      await reviewQuestionFlags(questionId, body)
      setNotice(message)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="page">
      <div className="section-head">
        <h1>Flagged questions</h1>
        <label className="inline-label">
          Show
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES && STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && items.length === 0 && <p className="muted">No {status === 'all' ? '' : status} flags.</p>}

      {items?.map((q) => {
        const hasOpen = q.flags.some((f) => f.status === 'open')
        return (
          <div key={q.question_id} className="form-card flag-item">
            <div className="section-head">
              <div className="flag-meta">
                <span className="category-badge">{q.exam_category_name}</span>
                <span className="muted">{q.topic_name}</span>
                <span className="muted">· question {q.question_status}</span>
              </div>
              <span className="flag-count">⚑ {q.flag_count}</span>
            </div>

            <p className="question-body">{q.body}</p>
            <ol className="flag-options">
              {q.options && q.options.map((o) => (
                <li key={o.id} className={o.is_correct ? 'is-correct' : ''}>
                  {o.option_text} {o.is_correct && <strong>✓ marked correct</strong>}
                </li>
              ))}
            </ol>
            {q.explanation && <p className="muted">Explanation: {q.explanation}</p>}

            <div className="chip-row">
              {Object.entries(q.reasons).map(([reason, n]) => (
                <span key={reason} className="chip">{REASON_LABELS[reason] || reason} × {n}</span>
              ))}
            </div>

            <ul className="flag-reports">
              {q.flags && q.flags.map((f) => (
                <li key={f.id}>
                  <strong>{f.reporter_username}</strong>
                  <span className="muted"> · {REASON_LABELS[f.reason] || f.reason} · {new Date(f.created_at).toLocaleString()} · {f.status}</span>
                  {f.description && <div>“{f.description}”</div>}
                </li>
              ))}
            </ul>

            {hasOpen && (
              <div className="friend-actions flag-review-actions">
                <button
                  className="btn-primary small"
                  disabled={busy === q.question_id}
                  onClick={() => review(q.question_id, { status: 'resolved' }, 'Marked as fixed.')}
                  title="You corrected the question — close the flags"
                >
                  Mark fixed
                </button>
                <button
                  className="btn-ghost small"
                  disabled={busy === q.question_id}
                  onClick={() => review(q.question_id, { status: 'dismissed' }, 'Flags dismissed — the question is fine.')}
                >
                  Dismiss
                </button>
                <button
                  className="btn-ghost small btn-danger-text"
                  disabled={busy === q.question_id}
                  onClick={() => {
                    if (window.confirm('Archive this question? It is removed from play immediately.')) {
                      review(q.question_id, { status: 'resolved', archive_question: true }, 'Question archived and removed from play.')
                    }
                  }}
                >
                  Archive question
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
