import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getSubjects, getUserStats, getLeaderboard, getDailyChallenge } from '../../api/endpoints'
import { formatDuration } from './DailyChallenge'

function DailyChallengeCard() {
  const [daily, setDaily] = useState(null)

  useEffect(() => {
    getDailyChallenge()
      .then(({ data }) => setDaily(data))
      .catch(() => setDaily(null))
  }, [])

  if (!daily) return null
  const attempt = daily.attempt

  let status
  let cta
  if (!daily.available) {
    status = <p className="muted">No challenge today — check back tomorrow.</p>
  } else if (attempt?.status === 'completed') {
    status = (
      <p>
        You scored <strong>{attempt.correct}/{attempt.total}</strong> in {formatDuration(attempt.time_taken_ms)}
        {attempt.rank ? <> · rank <strong>#{attempt.rank}</strong> of {daily.participants}</> : null}
      </p>
    )
    cta = <Link to="/app/daily" className="btn-ghost">View results</Link>
  } else if (attempt?.status === 'in_progress') {
    status = <p>Your attempt is in progress — the clock is running.</p>
    cta = <Link to="/app/daily" className="btn-primary">Resume challenge →</Link>
  } else {
    status = (
      <p>
        {daily.question_count} questions · {Math.round(daily.time_limit_seconds / 60)} min · one attempt
        {daily.participants > 0 && <span className="muted"> · {daily.participants} played today</span>}
      </p>
    )
    cta = <Link to="/app/daily" className="btn-primary">Start challenge →</Link>
  }

  const top = daily.leaderboard.slice(0, 3)
  return (
    <section className="daily-card">
      <div className="daily-card-main">
        <span className="daily-eyebrow">📅 Daily Challenge · {daily.date}</span>
        <h2>Same questions for everyone today</h2>
        {status}
        {cta}
      </div>
      {top && top.length > 0 && (
        <ol className="daily-top">
          {top?.map((e) => (
            <li key={e.user_id}>
              <span className="lb-rank">#{e.rank}</span>
              <span className="lb-name">{e.display_name || e.username}</span>
              <span className="muted">{e.correct}/{e.total} · {formatDuration(e.time_taken_ms)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [stats, setStats] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [lbCategory, setLbCategory] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [{ data: subs }, { data: st }] = await Promise.all([
          getSubjects(),
          getUserStats(user.id),
        ])
        setSubjects(subs)
        setStats(st ?? [])
        // Load leaderboard for the first available subject
        if (subs && subs.length > 0) {
          setLbCategory(subs[0])
          const { data: lb } = await getLeaderboard(subs[0].code, { limit: 10 })
          setLeaderboard(lb ?? [])
        }
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [user.id])

  async function switchLeaderboard(sub) {
    setLbCategory(sub)
    try {
      const { data: lb } = await getLeaderboard(sub.code, { limit: 10 })
      setLeaderboard(lb ?? [])
    } catch {
      // ignore; old data stays
    }
  }

  return (
    <div className="page dashboard-page">
      <h1>Welcome back, {user.display_name || user.username} 👋</h1>
      {error && <div className="alert-error">{error}</div>}

      <div className="dashboard-layout">
        {/* ── Left / Main column ────────────────────────────────── */}
        <div className="dashboard-main">
          <DailyChallengeCard />

          <div className="card-grid">
            <Link to="/app/matchmaking" className="action-card ranked">
              <div className="action-icon">⚔️</div>
              <h3>Ranked Match</h3>
              <p>Ranked queue with similarly-rated opponents, or Arena — open to everyone.</p>
            </Link>
            <Link to="/app/friend" className="action-card friend">
              <div className="action-icon">👥</div>
              <h3>Friend Match</h3>
              <p>Create or join a private room with a room code.</p>
            </Link>
            <Link to="/app/practice" className="action-card practice">
              <div className="action-icon">🎯</div>
              <h3>Practice</h3>
              <p>Solve questions solo with instant feedback. No rating impact.</p>
            </Link>
            <Link to="/app/leaderboard" className="action-card leaderboard-card">
              <div className="action-icon">🏆</div>
              <h3>Leaderboard</h3>
              <p>See how you stack up by exam category.</p>
            </Link>
          </div>

          <h2>Exam categories</h2>
          <div className="chip-row">
            {subjects?.map((s) => (
              <span key={s.id} className="chip" title={s.description}>
                {s.name}
              </span>
            ))}
          </div>

          <h2>Your stats</h2>
          {stats && stats.length === 0 && (
            <p className="muted">No stats yet — play a match or practice session to get started.</p>
          )}
          <div className="stats-grid">
            {stats && stats.map((s) => (
              <div key={s.exam_category_id} className="stat-card">
                <div className="stat-row"><span>Matches</span><strong>{s.total_matches}</strong></div>
                <div className="stat-row"><span>W / L / D</span><strong>{s.wins} / {s.losses} / {s.draws}</strong></div>
                <div className="stat-row"><span>Accuracy</span><strong>{s.overall_accuracy.toFixed(1)}%</strong></div>
                <div className="stat-row"><span>Win streak</span><strong>{s.current_win_streak}</strong></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right column: Top 10 Leaderboard ─────────────────── */}
        <aside className="dashboard-sidebar">
          <div className="lb-widget">
            <div className="lb-widget-header">
              <h3>🏆 Top 10</h3>
              {lbCategory && (
                <Link to="/app/leaderboard" className="lb-see-all">See all →</Link>
              )}
            </div>
            {subjects && subjects.length > 1 && (
              <div className="lb-tabs">
                {subjects.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    className={`lb-tab ${lbCategory?.id === s.id ? 'active' : ''}`}
                    onClick={() => switchLeaderboard(s)}
                  >
                    {s.name.length > 8 ? s.name.slice(0, 8) + '…' : s.name}
                  </button>
                ))}
              </div>
            )}
            <ol className="lb-list">
              {leaderboard?.map((entry, idx) => {
                const isMe = entry.user_id === user.id
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                return (
                  <li
                    key={entry.user_id}
                    className={`lb-item ${isMe ? 'lb-me' : ''}`}
                    onClick={() => navigate(`/app/profile`)}
                    title={`View ${entry.username}'s profile`}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="lb-rank">{medal || `#${idx + 1}`}</span>
                    <span className="lb-name">{entry.display_name || entry.username}{isMe ? ' ★' : ''}</span>
                    <span className="lb-rating">{entry.rating}</span>
                  </li>
                )
              })}
              {leaderboard && leaderboard.length === 0 && (
                <li className="lb-empty muted">No players yet</li>
              )}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
