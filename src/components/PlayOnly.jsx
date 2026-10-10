import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Guards the play pages (matches, practice, daily challenge).
 *
 * Demo (guest) accounts can look around but not play — the server refuses
 * them too (auth.RegisteredOnly). Instead of letting them hit that error,
 * show an invitation to create a free account.
 */
export default function PlayOnly({ what, children }) {
  const { isGuest, logout } = useAuth()
  const navigate = useNavigate()
  if (!isGuest) return children

  // Leave the demo session first, so signing up or logging in starts clean.
  const go = (path) => {
    logout()
    navigate(path)
  }

  return (
    <div className="page">
      <div className="signup-to-play">
        <span className="signup-to-play-icon" aria-hidden="true">🔒</span>
        <h1>Create a free account to play</h1>
        <p className="muted">
          You're on a demo account — you can look around, but {what} needs a real account.
          It takes 20 seconds and your progress is saved.
        </p>
        <div className="signup-to-play-actions">
          <button className="btn-primary btn-lg" onClick={() => go('/register')}>Create free account</button>
          <button className="btn-ghost" onClick={() => go('/login')}>I have an account</button>
        </div>
        <Link to="/app/leaderboard" className="muted signup-to-play-back">Keep looking around →</Link>
      </div>
    </div>
  )
}
