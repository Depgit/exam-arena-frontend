import { useEffect, useState } from 'react'
import { getAdminLiveUsers } from '../../api/endpoints'
import { Avatar } from '../game/game'

const REFRESH_MS = 10_000
const TYPE = { ranked: 'Ranked', arena: 'Arena', friend: 'Friend', group: 'Group Race', bot: 'Bot match', ghost: 'Ghost match' }

// "3m", "1h 12m", "45s"
function duration(seconds) {
  if (seconds < 60) return `${Math.max(0, seconds)}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/**
 * Admin: everyone connected right now — who's in a match (and against
 * whom), who's just looking around, and how long they've been online.
 * Refreshes every 10 seconds while open.
 */
export default function LivePlayersDialog({ onClose }) {
  const [players, setPlayers] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getAdminLiveUsers()
        .then(({ data }) => {
          if (cancelled) return
          setPlayers(data || [])
          setNow(Date.now())
          setError('')
        })
        .catch((err) => !cancelled && setError(err.message))
    load()
    const id = setInterval(load, REFRESH_MS)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      clearInterval(id)
      clearInterval(tick)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const since = (iso) => Math.floor((now - new Date(iso).getTime()) / 1000)
  const inMatch = players?.filter((p) => p.match).length ?? 0

  return (
    <div className="leave-backdrop" onClick={onClose} role="presentation">
      <div className="live-dialog" role="dialog" aria-modal="true" aria-labelledby="live-title" onClick={(e) => e.stopPropagation()}>
        <header className="live-head">
          <div>
            <h2 id="live-title">
              <span className="ws-dot online" /> Live now
            </h2>
            <p className="muted">
              {players == null ? 'Loading…' : `${players.length} online · ${inMatch} in a match · updates every 10s`}
            </p>
          </div>
          <button type="button" className="btn-ghost icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {error && <div className="alert-error">{error}</div>}

        {players && players.length === 0 && <p className="live-empty muted">Nobody is online right now.</p>}

        {players && players.length > 0 && (
          <ul className="live-list">
            {players.map((p) => {
              const name = p.display_name || p.username
              return (
                <li key={p.user_id} className={`live-row ${p.match ? 'playing' : ''}`}>
                  <Avatar name={name} size={40} />
                  <div className="live-who">
                    <span className="live-name">
                      <span className="live-name-text">{name}</span>
                      {p.is_guest && <span className="live-tag demo">Demo</span>}
                      {p.is_admin && <span className="live-tag admin">Admin</span>}
                    </span>
                    <span className="live-username">@{p.username}</span>
                  </div>
                  <div className="live-doing">
                    {p.match ? (
                      <>
                        <span className="live-status playing">
                          ⚔️ {TYPE[p.match.match_type] || p.match.match_type}
                          {p.match.opponent ? ` vs ${p.match.opponent}` : ''}
                        </span>
                        {p.match.started_at && <span className="live-time">{duration(since(p.match.started_at))} into the match</span>}
                      </>
                    ) : (
                      <span className="live-status">Looking around</span>
                    )}
                    <span className="live-time">online {duration(since(p.connected_at))}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
