import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getInvite } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/game/game'
import { saveReferral } from '../lib/referral'

/**
 * mindrace.in/i/<username> — a player's invite link. Remembers who invited
 * this visitor, so the sign-up counts for them (once the email is verified).
 */
export default function Invite() {
  const { code } = useParams()
  const { isAuthenticated } = useAuth()
  const [inviter, setInviter] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getInvite(code)
      .then(({ data }) => {
        setInviter(data)
        if (!isAuthenticated) saveReferral(data.username, data.display_name)
      })
      .catch((err) => setError(err.message))
  }, [code, isAuthenticated])

  return (
    <div className="auth-page challenge-page">
      <div className="auth-hero" aria-hidden="true">
        <span className="auth-hero-mark">⚡</span>
      </div>
      <div className="auth-card challenge-card">
        {!inviter && !error && <div className="spinner" />}
        {error && (
          <>
            <span className="challenge-icon" aria-hidden="true">🔗</span>
            <h1>Invite not found</h1>
            <p className="muted">{error} You can still join — it's free.</p>
          </>
        )}
        {inviter && (
          <>
            <Avatar name={inviter.display_name} size={88} />
            <span className="eyebrow">You're invited</span>
            <h1>
              {inviter.display_name} <span className="challenge-sub">invited you to Mind Race</span>
            </h1>
            <p className="muted">1v1 math & logic battles · 90 seconds a match · climb the ranks. Free.</p>
          </>
        )}
        <div className="challenge-actions">
          {isAuthenticated ? (
            <>
              <p className="muted">You already have an account — invites are for new players.</p>
              <Link className="btn-primary btn-lg" to="/app/dashboard">Go to the lobby</Link>
            </>
          ) : (
            <>
              <Link className="btn-primary btn-xl" to="/register">Join free{inviter ? ` with ${inviter.display_name}` : ''}</Link>
              <Link className="btn-ghost" to="/login">I have an account</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
