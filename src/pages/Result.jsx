import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPublicResult } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/game/game'
import { track } from '../lib/analytics'

const MODE = { ranked: 'Ranked', arena: 'Arena', friend: 'Friend', group: 'Group Race', bot: 'Bot' }

/**
 * mindrace.in/r/<match> — a finished match's result, for anyone: the link
 * players share after a match. Ends with a way in for whoever opened it.
 */
export default function Result() {
  const { matchId } = useParams()
  const { isAuthenticated, isAdmin } = useAuth()
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    track('result_opened')
    getPublicResult(matchId)
      .then(({ data }) => setResult(data))
      .catch((err) => setError(err.message))
  }, [matchId])

  const players = result?.players ?? []
  const winners = players.filter((p) => p.rank === 1)
  const draw = winners.length > 1
  const name = (p) => p.display_name || p.username
  const when = result?.ended_at
    ? new Date(result.ended_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div className="auth-page challenge-page">
      <div className="auth-hero" aria-hidden="true">
        <span className="auth-hero-mark">⚡</span>
      </div>
      <div className="auth-card challenge-card result-card">
        {!result && !error && <div className="spinner" />}
        {error && (
          <>
            <span className="challenge-icon" aria-hidden="true">🔍</span>
            <h1>Result not found</h1>
            <p className="muted">{error}</p>
          </>
        )}
        {result && (
          <>
            <span className="eyebrow">
              {[`${MODE[result.match_type] || ''} match`, result.category_name, when].filter(Boolean).join(' · ')}
            </span>
            <h1>
              {draw ? "It's a draw!" : `${name(winners[0] || players[0])} won`}
              {!draw && <span className="challenge-sub">🏆 Victory</span>}
            </h1>
            <ol className="result-players">
              {players.map((p) => (
                <li key={p.username} className={p.rank === 1 ? 'winner' : ''}>
                  <span className="result-pos">#{p.rank}</span>
                  <Avatar name={name(p)} size={44} />
                  <span className="result-who">
                    <strong>{name(p)}</strong>
                    {!p.is_bot && <span className="muted">@{p.username}</span>}
                  </span>
                  <span className="result-pts">
                    {p.score}
                    <small>pts</small>
                    {p.rating_delta != null && (
                      <em className={p.rating_delta >= 0 ? 'up' : 'down'}>
                        {p.rating_delta >= 0 ? '+' : ''}
                        {p.rating_delta}
                      </em>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        <div className="challenge-actions">
          {isAuthenticated && !isAdmin ? (
            <Link className="btn-primary btn-xl" to="/app/matchmaking">⚔️ Play a match</Link>
          ) : !isAuthenticated ? (
            <>
              <p className="muted result-pitch">1v1 math & logic battles · 90 seconds · free</p>
              <Link className="btn-primary btn-xl" to="/register">Play Mind Race free</Link>
              <Link className="btn-ghost" to="/login">I have an account</Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
