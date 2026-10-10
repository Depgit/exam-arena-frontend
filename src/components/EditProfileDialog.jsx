import { useEffect, useState } from 'react'
import { updateMe } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './game/game'

const MAX_NAME = 30

/**
 * Edit your own profile. The display name (what other players see) can
 * change any time; the username is permanent, so it's shown locked.
 */
export default function EditProfileDialog({ onClose, onSaved }) {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user.display_name || user.username)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const trimmed = name.trim().replace(/\s+/g, ' ')
  const unchanged = trimmed === (user.display_name || user.username)

  async function save(e) {
    e.preventDefault()
    if (unchanged) return onClose()
    setBusy(true)
    setError('')
    try {
      const { data } = await updateMe({ display_name: trimmed })
      const next = { ...user, display_name: data.display_name }
      updateUser(next)
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

        <div className="field">
          <span className="field-label">Username</span>
          <div className="field-locked">
            <span>@{user.username}</span>
            <span className="lock-tag" aria-label="can't be changed">🔒 permanent</span>
          </div>
          <span className="field-help">Usernames can't be changed — friends find you by it.</span>
        </div>

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
          <button type="submit" className="btn-primary" disabled={busy || trimmed.length > MAX_NAME || (trimmed.length === 1)}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
