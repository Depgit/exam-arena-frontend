import { useState } from 'react'

/**
 * Second step of a first Google sign-in: pick a username (prefilled with a
 * free suggestion). Rendered inside the auth card.
 */
export default function GoogleUsernameStep({ pending, onSubmit, onCancel }) {
  const [username, setUsername] = useState(pending.suggested || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSubmit(username.trim())
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-logo">
        MIND<span>RACE</span>
      </div>
      <p className="auth-subtitle">
        Welcome{pending.name ? `, ${pending.name.split(' ')[0]}` : ''}! Pick the name other players will see.
      </p>
      <p className="google-email muted">Signing up with {pending.email}</p>
      {error && <div className="alert-error">{error}</div>}
      <label>
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          autoFocus
          autoComplete="username"
          spellCheck={false}
        />
      </label>
      <button className="btn-primary btn-xl" type="submit" disabled={busy}>
        {busy ? 'Creating player…' : 'Create player'}
      </button>
      <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
        Back
      </button>
    </form>
  )
}
