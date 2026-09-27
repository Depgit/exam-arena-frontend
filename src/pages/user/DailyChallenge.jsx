import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDailyChallenge, startDailyChallenge, submitDailyChallenge } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import FlagQuestionButton from '../../components/FlagQuestionButton'

export function formatDuration(ms) {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function DailyLeaderboard({ entries, userId }) {
  if (!entries?.length) return <p className="muted">No one has finished today's challenge yet.</p>
  return (
    <ol className="lb-list daily-board">
      {entries?.map((e) => (
        <li key={e.user_id} className={`lb-item ${e.user_id === userId ? 'lb-me' : ''}`}>
          <span className="lb-rank">#{e.rank}</span>
          <span className="lb-name">{e.display_name || e.username}</span>
          <span className="lb-rating">
            {e.correct}/{e.total} · {formatDuration(e.time_taken_ms)}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function DailyChallenge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [overview, setOverview] = useState(null)
  const [run, setRun] = useState(null) // start response + localDeadline
  const [current, setCurrent] = useState(0)
  const [selections, setSelections] = useState({})
  const [remainingMs, setRemainingMs] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittedRef = useRef(false)
  const selectionsRef = useRef(selections)
  selectionsRef.current = selections

  const loadOverview = useCallback(async () => {
    const { data } = await getDailyChallenge()
    setOverview(data)
    return data
  }, [])

  const begin = useCallback(async () => {
    setError('')
    try {
      const { data } = await startDailyChallenge()
      // Deadline in local clock time, corrected for server/client skew.
      const localDeadline = Date.now() + (new Date(data.deadline) - new Date(data.server_time))
      setRun({ ...data, localDeadline })
      setCurrent(0)
    } catch (err) {
      setError(err.message)
      loadOverview().catch(() => { })
    }
  }, [loadOverview])

  useEffect(() => {
    loadOverview()
      .then((data) => {
        if (data.attempt?.status === 'in_progress') begin()
      })
      .catch((err) => setError(err.message))
  }, [loadOverview, begin])

  const submit = useCallback(async () => {
    if (submittedRef.current || !run) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const answers = run.questions.map((q) => ({
        question_id: q.id,
        option_id: selectionsRef.current[q.id] || '',
      }))
      const { data } = await submitDailyChallenge(answers)
      setResult(data)
      setRun(null)
      loadOverview().catch(() => { })
    } catch (err) {
      setError(err.message)
      submittedRef.current = false
    } finally {
      setSubmitting(false)
    }
  }, [run, loadOverview])

  // Countdown; submit automatically when time runs out.
  useEffect(() => {
    if (!run) return
    const tick = () => {
      const left = run.localDeadline - Date.now()
      setRemainingMs(left)
      if (left <= 0) submit()
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [run, submit])

  if (error && !run && !overview) {
    return <div className="page"><div className="alert-error">{error}</div></div>
  }
  if (!overview) return <div className="page-center">Loading…</div>

  // ── Playing ──────────────────────────────────────────────────────────
  if (run) {
    const questions = run.questions
    const question = questions[current]
    if (!question) {
      return <div className="page-center">this feature will be available soon.....</div>;
    }
    const selected = selections[question.id] || ''
    const answered = questions.filter((q) => selections[q.id]).length
    const isLast = current === questions.length - 1
    const lowTime = remainingMs != null && remainingMs <= 30_000

    function handleSubmit() {
      const open = questions.length - answered
      if (open > 0 && !window.confirm(`${open} question${open === 1 ? '' : 's'} unanswered. Submit anyway?`)) return
      submit()
    }

    return (
      <div className="page match-page">
        <div className="match-header">
          <div>Daily Challenge · Question {current + 1} / {questions.length}</div>
          {remainingMs != null && (
            <div className={`timer ${lowTime ? 'timer-low' : ''}`}>⏱ {formatDuration(remainingMs)}</div>
          )}
        </div>
        {error && <div className="alert-error">{error}</div>}

        <div className="question-card">
          <div className="question-card-head">
            <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
            <FlagQuestionButton questionId={question && question.id} />
          </div>
          <p className="question-body">{question.body}</p>
          <div className="options">
            {question?.options
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((opt) => (
                <button
                  key={opt.id}
                  className={`option-btn ${selected === opt.id ? 'selected' : ''}`}
                  onClick={() => setSelections((s) => ({ ...s, [question.id]: opt.id }))}
                  aria-pressed={selected === opt.id}
                >
                  {opt.option_text}
                </button>
              ))}
          </div>
          {selected && (
            <div className="answer-actions">
              <p className="muted">You can change any answer until you submit.</p>
              <button
                type="button"
                className="btn-ghost small"
                onClick={() =>
                  setSelections((s) => {
                    const next = { ...s }
                    delete next[question.id]
                    return next
                  })
                }
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        <div className="match-nav">
          <div className="progress-dots">
            {questions?.map((q, i) => (
              <span
                key={q.id}
                className={`dot ${selections[q.id] ? 'answered' : ''} ${i === current ? 'active' : ''}`}
                onClick={() => setCurrent(i)}
                title={`Question ${i + 1}`}
              />
            ))}
          </div>
          <div className="nav-buttons">
            <button className="btn-ghost" onClick={() => setCurrent(current - 1)} disabled={current === 0}>
              ← Back
            </button>
            {isLast ? (
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : `Submit (${answered}/${questions.length})`}
              </button>
            ) : (
              <button className="btn-primary" onClick={() => setCurrent(current + 1)}>
                Next question →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Result / already played ──────────────────────────────────────────
  const attempt = overview.attempt
  const done = result || (attempt?.status === 'completed' ? attempt : null)
  if (done) {
    const review = done.review || []
    const rank = done.rank
    const participants = result?.participants ?? overview.participants
    return (
      <div className="page">
        <h1>Daily Challenge · {overview.date}</h1>
        {result?.expired && (
          <div className="alert-error">Time ran out before your answers arrived, so this attempt scored 0.</div>
        )}
        <div className="daily-summary">
          <div className="daily-score">
            <strong>{done.correct}/{done.total}</strong>
            <span className="muted">correct</span>
          </div>
          <div className="daily-score">
            <strong>{formatDuration(done.time_taken_ms)}</strong>
            <span className="muted">time</span>
          </div>
          {rank > 0 && (
            <div className="daily-score">
              <strong>#{rank}</strong>
              <span className="muted">of {participants}</span>
            </div>
          )}
        </div>
        <p className="muted">A new challenge unlocks at midnight (IST).</p>

        <div className="two-col">
          <div className="form-card">
            <h3>Your answers</h3>
            <ol className="review-list">
              {review?.map((item, i) => (
                <li key={item.question_id} className={`review-item ${item.is_correct ? 'is-correct' : 'is-wrong'}`}>
                  <div className="review-q">
                    <span className="muted">Q{i + 1}.</span> {item.body}
                  </div>
                  <div className="review-a">
                    {item.is_correct ? '✓' : '✕'} Your answer:{' '}
                    <strong>{item.selected_option_text || 'Not answered'}</strong>
                  </div>
                  {!item.is_correct && (
                    <div className="review-a">Correct answer: <strong>{item.correct_option_text}</strong></div>
                  )}
                  {item.explanation && <p className="muted review-expl">{item.explanation}</p>}
                  <FlagQuestionButton questionId={item.question_id} />
                </li>
              ))}
            </ol>
          </div>
          <div className="form-card">
            <h3>Today's top players</h3>
            <DailyLeaderboard entries={overview.leaderboard} userId={user.id} />
          </div>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/app/dashboard')}>Back to home</button>
      </div>
    )
  }

  // ── Intro ────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <h1>Daily Challenge · {overview.date}</h1>
      {error && <div className="alert-error">{error}</div>}
      {!overview.available ? (
        <div className="form-card">
          <p>No daily challenge is available today — check back tomorrow.</p>
        </div>
      ) : (
        <div className="two-col">
          <div className="form-card">
            <h3>Today's challenge</h3>
            <ul className="daily-rules">
              <li>{overview.question_count} questions — the same set for everyone today</li>
              <li>{Math.round(overview.time_limit_seconds / 60)} minutes, starting when you press Start</li>
              <li>One attempt per day. Most correct wins; ties go to the fastest</li>
              <li>You can change answers until you submit</li>
            </ul>
            <button className="btn-primary" onClick={begin}>Start challenge</button>
          </div>
          <div className="form-card">
            <h3>Today's top players ({overview.participants})</h3>
            <DailyLeaderboard entries={overview.leaderboard} userId={user.id} />
          </div>
        </div>
      )}
    </div>
  )
}
