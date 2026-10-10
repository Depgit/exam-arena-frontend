import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentMatch } from '../api/endpoints'
import LeaveMatchDialog from './game/LeaveMatchDialog'

/**
 * Guards the pages that start a new match (Play, Friend Match). A player
 * still in a running match — say they switched to another page mid-game —
 * is offered a way back, or to leave it, instead of a second game. The
 * server refuses overlapping matches too (match.Handler.NotInMatch).
 */
export default function NotInMatch({ children }) {
  const [matchId, setMatchId] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    getCurrentMatch()
      .then(({ data }) => !cancelled && setMatchId(data?.match_id || null))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!matchId) return children

  return (
    <div className="page">
      <div className="signup-to-play in-match-notice">
        <span className="signup-to-play-icon" aria-hidden="true">⚔️</span>
        <h1>You're still in a match</h1>
        <p className="muted">
          The clock is still running. Go back and finish it, or leave it to start a new one.
        </p>
        <div className="signup-to-play-actions">
          <button className="btn-primary btn-lg" onClick={() => navigate(`/app/match/${matchId}`)}>
            Return to match
          </button>
          <button className="btn-ghost" onClick={() => setLeaving(true)}>Leave match</button>
        </div>
      </div>
      {leaving && (
        <LeaveMatchDialog
          matchId={matchId}
          rated
          onClose={() => setLeaving(false)}
          onLeft={() => {
            setLeaving(false)
            setMatchId(null)
          }}
        />
      )}
    </div>
  )
}
