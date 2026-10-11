import { useEffect, useState } from 'react'
import { changeUsername, updateMe } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './game/game'

const MAX_NAME = 30
const USERNAME_COOLDOWN_DAYS = 14

// Same rules as the server (auth.validateUsername).
function usernameProblem(name) {
  if (/\s/.test(name)) return "Usernames can't contain spaces."
  if (name.length < 3 || name.length > 30) return 'Use 3–30 characters.'
  if (/^(bot\.|guest_)/i.test(name)) return 'That username is reserved.'
  return ''
}

// When the username may change again, or null if it may change now.
function nextUsernameChange(changedAt) {
  if (!changedAt) return null
  const next = new Date(new Date(changedAt).getTime() + USERNAME_COOLDOWN_DAYS * 864e5)
  return next > new Date() ? next : null
}

/**
 * Edit your own profile. The display name (what other players see) can
 * change any time; the username once every 14 days.
 */
export default function EditProfileDialog({ onClose, onSaved }) {
  const { user, updateUser, renewSession } = useAuth()
  const [name, setName] = useState(user.display_name || user.username)
  const [username, setUsername] = useState(user.username)
  const lockedUntil = nextUsernameChange(user.username_changed_at)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const trimmed = name.trim().replace(/\s+/g, ' ')
  const nameChanged = trimmed !== (user.display_name || user.username)
  const newUsername = username.trim()
  const usernameChanged = newUsername !== user.username
  const usernameError = usernameChanged ? usernameProblem(newUsername) : ''

  async function save(e) {
    e.preventDefault()
    if (!nameChanged && !usernameChanged) return onClose()
    setBusy(true)
    setError('')
    try {
      let next = user
      if (usernameChanged) {
        const { data } = await changeUsername(newUsername)
        renewSession(data.token, data.user)
        next = data.user
      }
      if (nameChanged) {
        const { data } = await updateMe({ display_name: trimmed })
        next = { ...next, display_name: data.display_name }
        updateUser(next)
      }
      onSaved?.(next)
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="leave-backdrop" onClick={() => !busy && onClose()} role="presentation">
      <form
        className="leave-dialog profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="profile-dialog-head">
          <Avatar name={trimmed || user.username} size={56} />
          <div>
            <h2 id="edit-profile-title">Edit profile</h2>
            <p className="muted">This is how other players see you.</p>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <label className="field">
          <span className="field-label">
            Display name
            <span className={`field-count ${trimmed.length > MAX_NAME ? 'over' : ''}`}>{trimmed.length}/{MAX_NAME}</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME + 10}
            autoFocus
            autoComplete="name"
            placeholder={user.username}
          />
          <span className="field-help">Shown on leaderboards, in matches and in chat. Leave empty to use your username.</span>
        </label>

        {lockedUntil ? (
          <div className="field">
            <span className="field-label">Username</span>
            <div className="field-locked">
              <span>@{user.username}</span>
              <span className="lock-tag">🔒 until {lockedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
            <span className="field-help">You changed it recently — usernames can change once every {USERNAME_COOLDOWN_DAYS} days.</span>
          </div>
        ) : (
          <label className="field">
            <span className="field-label">Username</span>
            <div className="username-input">
              <span aria-hidden="true">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                maxLength={30}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            {usernameError ? (
              <span className="field-help field-error">{usernameError}</span>
            ) : usernameChanged ? (
              <span className="field-help field-warn">
                ⚠️ After this you can't change it again for {USERNAME_COOLDOWN_DAYS} days. Your old invite links keep working.
              </span>
            ) : (
              <span className="field-help">Friends find you by it. You can change it once every {USERNAME_COOLDOWN_DAYS} days.</span>
            )}
          </label>
        )}

        {user.email && (
          <div className="field">
            <span className="field-label">Email</span>
            <div className="field-locked">
              <span className="field-email">{user.email}</span>
              {user.email_verified_at ? (
                <span className="verified-tag">✓ verified</span>
              ) : (
                <span className="unverified-tag">not verified</span>
              )}
            </div>
            <span className="field-help">Only you can see this.</span>
          </div>
        )}

        <div className="leave-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || trimmed.length > MAX_NAME || trimmed.length === 1 || !!usernameError}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
