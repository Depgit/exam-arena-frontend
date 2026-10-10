import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Keyboards often add a trailing space; the server trims too.
      const user = await register(username.trim(), email.trim(), password)
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/app/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
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
        <p className="auth-subtitle">Create your player — you start at Silver (1200)</p>
        {error && <div className="alert-error">{error}</div>}
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} autoFocus autoComplete="username" />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <button className="btn-primary btn-xl" type="submit" disabled={busy}>
          {busy ? 'Creating player…' : 'Create player'}
        </button>
        <p className="auth-switch">
          Already a player? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
