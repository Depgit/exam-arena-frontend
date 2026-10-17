import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getSubjects, getUserStats, getUserProfile, getLeaderboard, getDailyChallenge } from '../../api/endpoints'
import NightBanner from '../../components/NightBanner'
import InviteCard from '../../components/InviteCard'
import StreakCard from '../../components/StreakCard'
import NotifyPrompt from '../../components/NotifyPrompt'
import { Avatar, RankBadge, tierFor } from '../../components/game/game'
import ChatPanel from '../../components/chat/ChatPanel'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { formatDuration } from './DailyChallenge'
import AdSlot from '../../components/AdSlot'

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
  let cta = 'Play →'
  let done = false
  if (!daily.available) {
    status = <span className="muted">No challenge today — back tomorrow</span>
    cta = ''
  } else if (attempt?.status === 'completed') {
    done = true
    status = (
      <span>
        ✓ {attempt.correct}/{attempt.total} in {formatDuration(attempt.time_taken_ms)}
        {attempt.rank ? <> · #{attempt.rank} of {daily.participants}</> : null}
      </span>
    )
    cta = 'Results →'
  } else if (attempt?.status === 'in_progress') {
    status = <span>In progress — the clock is running</span>
    cta = 'Resume →'
  } else {
    status = (
      <span>
        {daily.question_count} questions · {Math.round(daily.time_limit_seconds / 60)} min
        {daily.participants > 0 && <span className="muted"> · {daily.participants} played</span>}
      </span>
    )
  }

  return (
    <Link to="/app/daily" className={`today-tile daily-tile ${done ? 'done' : ''}`}>
      <span className="today-icon" aria-hidden="true">📅</span>
      <span className="today-text">
        <strong>Daily challenge</strong>
        {status}
      </span>
      {cta && <span className="today-go">{cta}</span>}
    </Link>
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

  const shownBoard = wide ? leaderboard : leaderboard.slice(0, 5)

  return (
    <div className="page dashboard-page lobby">
      {error && <div className="alert-error">{error}</div>}

      {/* ── 1. You + Play: everything needed to start, in one card ───── */}
      <section className="lobby-command">
        <div className="lobby-me">
          <Link to="/app/profile" className="lobby-avatar" aria-label="Your profile">
            <Avatar name={name} size={64} ring={best ? tierFor(best.rating).key : 'silver'} />
          </Link>
          <div className="lobby-me-info">
            <span className="eyebrow">Welcome back</span>
            <h1>{name}</h1>
            <div className="lobby-me-meta">
              <RankBadge rating={best ? best.rating : 1200} size="sm" />
              <span className="lobby-stat"><strong>{totals.matches}</strong> matches</span>
              {winRate != null && <span className="lobby-stat"><strong>{winRate}%</strong> wins</span>}
            </div>
          </div>
        </div>
        <StreakCard inline />
        <div className="lobby-play">
          <Link to="/app/matchmaking" className="btn-play">
            <span className="btn-play-icon" aria-hidden="true">⚔️</span>
            <span>
              <strong>Play</strong>
              <small>Find an opponent</small>
            </span>
          </Link>
        </div>
      </section>

      <NotifyPrompt />

      {/* ── 2. Mind Race Night: a slim strip, big only while live ────── */}
      <NightBanner slim />

      <Link className="group-promo event-promo" to="/app/events">
        <span className="group-promo-icon" aria-hidden="true">🎓</span>
        <span className="group-promo-text">
          <strong>College event?</strong>
          <span className="muted">Join with your code and race your classmates</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          {/* ── 3. Today ─────────────────────────────────────────────── */}
          <h2 className="lobby-heading">Today</h2>
          <DailyChallengeCard />

          <h2 className="lobby-heading">More ways to play</h2>
          <div className="mode-row">
            <Link to="/app/group" className="mode-chip mode-chip-new">
              <span aria-hidden="true">👥</span>
              <strong>Group Race <em className="new-tag">New</em></strong>
              <small>Up to 8 players</small>
            </Link>
            <Link to="/app/friend" className="mode-chip">
              <span aria-hidden="true">🎮</span>
              <strong>Friend match</strong>
              <small>Private 1v1</small>
            </Link>
            <Link to="/app/practice" className="mode-chip">
              <span aria-hidden="true">🎯</span>
              <strong>Practice</strong>
              <small>No rating</small>
            </Link>
            <Link to="/app/leaderboard" className="mode-chip">
              <span aria-hidden="true">🏆</span>
              <strong>Rankings</strong>
              <small>All players</small>
            </Link>
          </div>

          {/* ── 4. Invite: a slim strip ───────────────────────────────── */}
          <InviteCard slim />

          {/* ── 5. Chat (desktop; phones use the floating chat button) ── */}
          {wide && (
            <>
              <h2 className="lobby-heading lobby-chat-heading">Lobby chat</h2>
              <ChatPanel />
            </>
          )}
        </div>

        {/* ── Side: Top 10 + chat (phones: Top 5, chat via the button) ─ */}
        <aside className="dashboard-sidebar">
          <div className="lb-widget">
            <div className="lb-widget-header">
              <h3>🏆 Top {wide ? 10 : 5}</h3>
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
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <ol className="lb-list">
              {shownBoard.map((entry, idx) => {
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
        </aside>
      </div>
      <AdSlot name="lobby" />
    </div>
  )
}
