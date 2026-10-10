import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import GoogleButton from '../../components/auth/GoogleButton'
import GoogleUsernameStep from '../../components/auth/GoogleUsernameStep'
import { useGoogleSignIn } from '../../components/auth/useGoogleSignIn'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const google = useGoogleSignIn(setError)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Keyboards often add a trailing space; the server trims too.
      const user = await register(username.trim(), email.trim(), password)
      navigate(user.role === 'admin' ? '/admin/dashboard' : user.needs_email_verification ? '/app/verify' : '/app/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (google.pending) {
    return (
      <div className="auth-page">
        <div className="auth-hero" aria-hidden="true">
          <span className="auth-hero-mark">⚡</span>
        </div>
        <GoogleUsernameStep pending={google.pending} onSubmit={google.finish} onCancel={google.cancel} />
      </div>
    )
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
        <GoogleButton onCredential={google.onCredential} text="signup_with" />
        <div className="auth-divider"><span>or with email</span></div>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} autoComplete="username" />
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
