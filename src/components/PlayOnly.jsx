import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import VerifyEmail from './auth/VerifyEmail'

/**
 * Guards the play pages (matches, practice, daily challenge).
 *
 * Demo (guest) accounts can look around but not play — the server refuses
 * them too (auth.RegisteredOnly). Instead of letting them hit that error,
 * show an invitation to create a free account.
 *
 * demoTrial: the page is open to demo accounts too — they get one free
 * bot match (auth.BotTrialOrRegistered) before having to sign up.
 */
export default function PlayOnly({ what, demoTrial = false, children }) {
  const { isGuest, needsVerification } = useAuth()
  // Signed up but email not verified yet: verify right here, then play.
  if (!isGuest && needsVerification) {
    return (
      <div className="page">
        <VerifyEmail />
      </div>
    )
  }
  if (!isGuest || demoTrial) return children
  return (
    <div className="page">
      <SignupWall>
        You're on a demo account — you can look around, but {what} needs a real account.
        It takes 20 seconds and your progress is saved.
      </SignupWall>
    </div>
  )
}

/** The "create a free account" card shown to demo accounts. */
export function SignupWall({ title = 'Create a free account to play', icon = '🔒', children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  // Leave the demo session first, so signing up or logging in starts clean.
  const go = (path) => {
    logout()
    navigate(path)
  }
  return (
      <div className="signup-to-play">
        <span className="signup-to-play-icon" aria-hidden="true">{icon}</span>
        <h1>{title}</h1>
        <p className="muted">{children}</p>
        <div className="signup-to-play-actions">
          <button className="btn-primary btn-lg" onClick={() => go('/register')}>Create free account</button>
          <button className="btn-ghost" onClick={() => go('/login')}>I have an account</button>
        </div>
        <Link to="/app/leaderboard" className="muted signup-to-play-back">Keep looking around →</Link>
      </div>
  )
}
