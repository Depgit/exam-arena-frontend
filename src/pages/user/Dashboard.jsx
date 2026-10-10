import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getSubjects, getUserStats, getUserProfile, getLeaderboard, getDailyChallenge } from '../../api/endpoints'
import { Avatar, RankBadge, tierFor } from '../../components/game/game'
import ChatPanel from '../../components/chat/ChatPanel'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { formatDuration } from './DailyChallenge'

function DailyChallengeCard() {
  // Last visit's data first (instant), then the fresh copy.
  const [daily, setDaily] = useState(() => getDailyChallenge.peek()?.data ?? null)

  useEffect(() => {
    getDailyChallenge()
      .then(({ data }) => setDaily(data))
      .catch(() => {}) // keep whatever we're already showing
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
  // Everything starts from the last visit (stale-while-revalidate), so the
  // lobby renders instantly and refreshes in place.
  const knownSubjects = getSubjects.peek()?.data ?? []
  const [subjects, setSubjects] = useState(knownSubjects)
  const [stats, setStats] = useState(() => getUserStats.peek(user.id)?.data ?? [])
  const [ratings, setRatings] = useState(() => getUserProfile.peek(user.id)?.data?.ratings ?? [])
  const [lbCategory, setLbCategory] = useState(knownSubjects[0] ?? null)
  const [leaderboard, setLeaderboard] = useState(() =>
    knownSubjects[0] ? getLeaderboard.peek(knownSubjects[0].code, { limit: 10 })?.data ?? [] : []
  )
  const [error, setError] = useState('')
  // Desktop shows the chat under the Top 10; phones use the floating chat button.
  const wide = useMediaQuery('(min-width: 901px)')

  useEffect(() => {
    const loadBoard = (sub) =>
      getLeaderboard(sub.code, { limit: 10 })
        .then(({ data }) => setLeaderboard(data ?? []))
        .catch(() => {})
    // If we already know the categories, don't wait for them before
    // asking for the leaderboard: fire everything at once.
    if (knownSubjects[0]) loadBoard(knownSubjects[0])

    getSubjects()
      .then(({ data: subs }) => {
        setSubjects(subs ?? [])
        if (subs?.length && subs[0].code !== knownSubjects[0]?.code) {
          setLbCategory(subs[0])
          loadBoard(subs[0])
        }
      })
      .catch((err) => setError(err.message))
    getUserStats(user.id)
      .then(({ data }) => setStats(data ?? []))
      .catch((err) => setError(err.message))
    // Ratings are a nice-to-have for the player card; never block on them.
    getUserProfile(user.id)
      .then(({ data }) => setRatings(data?.ratings ?? []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function switchLeaderboard(sub) {
    setLbCategory(sub)
    const known = getLeaderboard.peek(sub.code, { limit: 10 })?.data
    if (known) setLeaderboard(known)
    try {
      const { data: lb } = await getLeaderboard(sub.code, { limit: 10 })
      setLeaderboard(lb ?? [])
    } catch {
      // ignore; old data stays
    }
  }

  const name = user.display_name || user.username
  const best = ratings.reduce((a, r) => (a == null || r.rating > a.rating ? r : a), null)
  const totals = stats.reduce(
    (t, s) => ({
      matches: t.matches + s.total_matches,
      wins: t.wins + s.wins,
      streak: Math.max(t.streak, s.current_win_streak),
    }),
    { matches: 0, wins: 0, streak: 0 }
  )
  const winRate = totals.matches > 0 ? Math.round((totals.wins / totals.matches) * 100) : null

  return (
    <div className="page dashboard-page">
      {error && <div className="alert-error">{error}</div>}

      {/* ── Player card + primary CTA ─────────────────────────── */}
      <section className="lobby-hero">
        <div className="lobby-player">
          <Avatar name={name} size={72} ring={best ? tierFor(best.rating).key : 'silver'} />
          <div className="lobby-player-info">
            <span className="eyebrow">Welcome back</span>
            <h1>{name}</h1>
            <div className="lobby-player-meta">
              {best ? (
                <>
                  <RankBadge rating={best.rating} />
                  <span className="muted">best in {best.exam_category_name || best.exam_category_code}</span>
                </>
              ) : (
                <RankBadge rating={1200} />
              )}
            </div>
          </div>
        </div>
        <div className="lobby-cta">
          <Link to="/app/matchmaking" className="btn-play">
            <span className="btn-play-icon" aria-hidden="true">⚔️</span>
            <span>
              <strong>Play</strong>
              <small>Find a ranked opponent</small>
            </span>
          </Link>
        </div>
      </section>

      <div className="kpi-strip">
        <div className="kpi-tile"><span>Matches</span><strong>{totals.matches}</strong></div>
        <div className="kpi-tile"><span>Wins</span><strong>{totals.wins}</strong></div>
        <div className="kpi-tile"><span>Win rate</span><strong>{winRate == null ? '—' : `${winRate}%`}</strong></div>
        <div className="kpi-tile kpi-fire"><span>Win streak</span><strong>{totals.streak > 0 ? `🔥 ${totals.streak}` : 0}</strong></div>
      </div>

      <div className="dashboard-layout">
        {/* ── Left / Main column ────────────────────────────────── */}
        <div className="dashboard-main">
          <DailyChallengeCard />

          <h2>Game modes</h2>
          <div className="card-grid mode-grid">
            <Link to="/app/matchmaking" className="action-card ranked">
              <div className="action-icon">⚔️</div>
              <h3>Ranked</h3>
              <p>Matched against players near your rating. ELO on the line.</p>
              <span className="mode-tag">Competitive</span>
            </Link>
            <Link to="/app/friend" className="action-card friend">
              <div className="action-icon">🎮</div>
              <h3>Friend Match</h3>
              <p>Private room with a code. Settle it with a friend.</p>
              <span className="mode-tag">Private</span>
            </Link>
            <Link to="/app/practice" className="action-card practice">
              <div className="action-icon">🎯</div>
              <h3>Practice</h3>
              <p>Solo drills with instant feedback. No rating impact.</p>
              <span className="mode-tag">Solo</span>
            </Link>
            <Link to="/app/leaderboard" className="action-card leaderboard-card">
              <div className="action-icon">🏆</div>
              <h3>Leaderboard</h3>
              <p>See who rules each category.</p>
              <span className="mode-tag">Ranks</span>
            </Link>
          </div>

          <h2>Your stats by category</h2>
          {stats && stats.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">🎮</span>
              <p>No stats yet — play your first match to get on the board.</p>
              <Link to="/app/matchmaking" className="btn-primary small">Play now</Link>
            </div>
          )}
          <div className="stats-grid">
            {stats && stats.map((s) => {
              const r = ratings.find((x) => x.exam_category_id === s.exam_category_id)
              return (
                <div key={s.exam_category_id} className="stat-card">
                  <div className="stat-card-head">
                    <h3>{s.exam_category_name || subjects.find((x) => x.id === s.exam_category_id)?.name || 'Category'}</h3>
                    {r && <RankBadge rating={r.rating} size="sm" />}
                  </div>
                  <div className="stat-row"><span>Matches</span><strong>{s.total_matches}</strong></div>
                  <div className="stat-row"><span>W / L / D</span><strong>{s.wins} / {s.losses} / {s.draws}</strong></div>
                  <div className="stat-row"><span>Accuracy</span><strong>{s.overall_accuracy.toFixed(1)}%</strong></div>
                  <div className="accuracy-bar"><span style={{ width: `${Math.min(100, s.overall_accuracy)}%` }} /></div>
                </div>
              )
            })}
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
                    className={`lb-item ${isMe ? 'lb-me' : ''} ${idx < 3 ? `lb-top lb-top-${idx + 1}` : ''}`}
                    onClick={() => navigate(`/app/profile/${entry.user_id}`)}
                    title={`View ${entry.username}'s profile`}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="lb-rank">{medal || `#${idx + 1}`}</span>
                    <Avatar name={entry.display_name || entry.username} size={26} />
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
          {wide && <ChatPanel />}
        </aside>
      </div>
    </div>
  )
}
