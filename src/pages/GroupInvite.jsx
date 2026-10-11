import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getGroupInvite, joinGroupRoom } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import VerifyEmail from '../components/auth/VerifyEmail'
import { track } from '../lib/analytics'

/**
 * mindrace.in/g/AB12CD — a Group Race room link. Shows the room and lets
 * you jump in with one tap. Works before logging in: sign up, and you come
 * straight back here.
 */
export default function GroupInvite() {
  const { code: rawCode } = useParams()
  const code = (rawCode || '').toUpperCase()
  const { isAuthenticated, isGuest, isAdmin, needsVerification, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const here = `/g/${code}`

  useEffect(() => {
    track('challenge_opened', { kind: 'group' })
    getGroupInvite(code)
      .then(({ data }) => setInvite(data))
      .catch((err) => setError(err.message))
  }, [code])

  async function join() {
    setError('')
    setJoining(true)
    try {
      await joinGroupRoom(code)
      navigate('/app/group', { replace: true })
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }

  let body
  if (loading || (!invite && !error)) {
    body = <div className="spinner" />
  } else if (!invite) {
    body = (
      <>
        <span className="challenge-icon" aria-hidden="true">⌛</span>
        <h1>Race not available</h1>
        <p className="muted">{error || 'This room has closed or the race already started.'}</p>
        <div className="challenge-actions">
          <Link className="btn-primary btn-lg" to={isAuthenticated ? '/app/group' : '/register'}>
            {isAuthenticated ? 'Start a Group Race' : 'Play Mind Race free'}
          </Link>
        </div>
      </>
    )
  } else {
    const full = invite.players >= invite.max_players
    const head = (
      <>
        <span className="challenge-icon" aria-hidden="true">👥</span>
        <span className="eyebrow">Group Race · {invite.category_name}</span>
        <h1>
          {invite.host_username ? `${invite.host_username}'s race` : 'Join the race'}
        </h1>
        <p className="muted">
          {invite.players}/{invite.max_players} racers in · 10 questions · 90 seconds. Most points wins.
        </p>
      </>
    )
    if (!isAuthenticated) {
      body = (
        <>
          {head}
          <div className="challenge-actions">
            <Link className="btn-primary btn-xl" to={`/register?next=${encodeURIComponent(here)}`}>
              Sign up free & join
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
          <p className="muted">Demo accounts can't play. Create a free account to join.</p>
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
    } else {
      body = (
        <>
          {head}
          {error && <div className="alert-error">{error}</div>}
          <div className="challenge-actions">
            <button className="btn-primary btn-xl" onClick={join} disabled={joining || full}>
              {full ? 'Room is full' : joining ? 'Joining…' : '👥 Join the race'}
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
