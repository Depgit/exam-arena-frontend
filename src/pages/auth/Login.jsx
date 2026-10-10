import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [guestBusy, setGuestBusy] = useState(false)
  const { login, loginAsGuest } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(loginId, password)
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/app/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleGuest() {
    setError('')
    setGuestBusy(true)
    try {
      await loginAsGuest()
      navigate('/app/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuestBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero" aria-hidden="true">
        <span className="auth-hero-mark">⚡</span>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">
          MIND<span>RACE</span>
        </div>
        <p className="auth-subtitle">1v1 math & logic battles · climb the ranks</p>
        {error && <div className="alert-error">{error}</div>}
        <label>
          Username or email
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} required autoFocus autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <button className="btn-primary btn-xl" type="submit" disabled={busy}>
          {busy ? 'Starting…' : 'Enter the race'}
        </button>
        <div className="auth-divider"><span>or</span></div>
        <button type="button" className="btn-ghost btn-demo" onClick={handleGuest} disabled={guestBusy || busy}>
          {guestBusy ? 'Starting demo…' : '🎮 Try the demo — no sign-up'}
        </button>
        <p className="auth-switch">
          New challenger? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  )
}
