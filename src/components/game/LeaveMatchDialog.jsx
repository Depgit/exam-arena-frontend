import { useEffect, useState } from 'react'
import { leaveMatch } from '../../api/endpoints'

/**
 * "Leave match?" confirmation. Leaving ends the match at once and the
 * opponent wins; the server sends match_end to both players as usual.
 */
export default function LeaveMatchDialog({ matchId, rated, onClose, onLeft }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await leaveMatch(matchId)
      onLeft?.()
    } catch (err) {
      // 409: it ended on its own meanwhile — nothing left to leave.
      if (err.status === 409) onLeft?.()
      else {
        setError(err.message)
        setBusy(false)
      }
    }
  }

  return (
    <div className="leave-backdrop" onClick={() => !busy && onClose()} role="presentation">
      <div
        className="leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="leave-icon" aria-hidden="true">🏳️</span>
        <h2 id="leave-title">Leave this match?</h2>
        <p className="muted">
          The match ends now and your opponent wins.
          {rated ? ' It counts as a loss for your rating.' : ''}
        </p>
        {error && <div className="alert-error">{error}</div>}
        <div className="leave-actions">
          <button className="btn-ghost" onClick={onClose} disabled={busy} autoFocus>
            Keep playing
          </button>
          <button className="btn-danger" onClick={confirm} disabled={busy}>
            {busy ? 'Leaving…' : 'Leave match'}
          </button>
        </div>
      </div>
    </div>
  )
}
