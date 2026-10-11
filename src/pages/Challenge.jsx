import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRoomInvite, joinFriendMatch } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useWSListener } from '../context/WebSocketContext'
import { Avatar } from '../components/game/game'
import VerifyEmail from '../components/auth/VerifyEmail'

/**
 * mindrace.in/c/AB12CD — a friend's challenge link. Shows who's
 * challenging you and lets you accept in one tap. Works before logging in:
 * sign up, and you come straight back here.
 */
export default function Challenge() {
  const { code: rawCode } = useParams()
  const code = (rawCode || '').toUpperCase()
  const { isAuthenticated, isGuest, isAdmin, needsVerification, user, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const here = `/c/${code}`
  const fallback = useRef(null)
  useEffect(() => () => clearTimeout(fallback.current), [])

  useEffect(() => {
    getRoomInvite(code)
      .then(({ data }) => setInvite(data))
      .catch((err) => setError(err.message))
  }, [code])

  useWSListener('match_start', (payload) => navigate(`/app/match/${payload.match_id}`, { state: payload }))

  async function accept() {
    setError('')
    setJoining(true)
    try {
      const { data } = await joinFriendMatch({ room_code: code })
      // match_start usually arrives first; this is the fallback. Only if
      // we're still here — a second history entry for the match would
      // let Back land on a stale copy of it.
      fallback.current = setTimeout(() => {
        if (!window.location.pathname.startsWith('/app/match/')) navigate(`/app/match/${data.match_id}`, { replace: true })
      }, 1500)
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }

  const isHost = invite && user && invite.host_username.toLowerCase() === user.username?.toLowerCase()

  let body
  if (loading || (!invite && !error)) {
    body = <div className="spinner" />
  } else if (!invite) {
    body = (
      <>
        <span className="challenge-icon" aria-hidden="true">⌛</span>
        <h1>Challenge not available</h1>
        <p className="muted">{error || 'This challenge has expired or already started.'}</p>
        <div className="challenge-actions">
          <Link className="btn-primary btn-lg" to={isAuthenticated ? '/app/friend' : '/register'}>
            {isAuthenticated ? 'Start your own room' : 'Play Mind Race free'}
          </Link>
        </div>
      </>
    )
  } else {
    const head = (
      <>
        <Avatar name={invite.host_name} size={88} />
        <span className="eyebrow">Friend challenge · {invite.category_name}</span>
        <h1>
          {invite.host_name} <span className="challenge-sub">challenges you!</span>
        </h1>
        <p className="muted">
          1v1 · 10 questions · 90 seconds. Most correct wins — speed breaks ties.
        </p>
      </>
    )
    if (!isAuthenticated) {
      body = (
        <>
          {head}
          <div className="challenge-actions">
            <Link className="btn-primary btn-xl" to={`/register?next=${encodeURIComponent(here)}`}>
              Sign up free & accept
            </Link>
            <Link className="btn-ghost" to={`/login?next=${encodeURIComponent(here)}`}>
              I have an account
            </Link>
          </div>
        </>
      )
    } else if (isAdmin) {
      body = (
        <>
          {head}
          <p className="alert-error">Admin accounts can't play matches.</p>
        </>
      )
    } else if (isGuest) {
      body = (
        <>
          {head}
          <p className="muted">Demo accounts can't play. Create a free account to accept.</p>
          <div className="challenge-actions">
            <button
              className="btn-primary btn-xl"
              onClick={() => {
                logout()
                navigate(`/register?next=${encodeURIComponent(here)}`)
              }}
            >
              Create free account
            </button>
          </div>
        </>
      )
    } else if (needsVerification) {
      return (
        <div className="page challenge-page">
          <VerifyEmail />
        </div>
      )
    } else if (isHost) {
      body = (
        <>
          {head}
          <p className="muted">This is your own room — send the link to a friend and wait for them here.</p>
          <div className="challenge-actions">
            <Link className="btn-primary btn-lg" to="/app/friend">Back to your room</Link>
          </div>
        </>
      )
    } else {
      body = (
        <>
          {head}
          {error && <div className="alert-error">{error}</div>}
          <div className="challenge-actions">
            <button className="btn-primary btn-xl" onClick={accept} disabled={joining}>
              {joining ? 'Joining…' : '⚔️ Accept challenge'}
            </button>
            <Link className="btn-ghost" to="/app/dashboard">
              Not now
            </Link>
          </div>
        </>
      )
    }
  }

  return (
    <div className="auth-page challenge-page">
      <div className="auth-hero" aria-hidden="true">
        <span className="auth-hero-mark">⚡</span>
      </div>
      <div className="auth-card challenge-card">{body}</div>
    </div>
  )
}
