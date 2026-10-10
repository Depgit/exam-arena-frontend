import { useEffect, useRef, useState } from 'react'
import { sendVerificationCode, verifyEmailCode } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

const RESEND_SECONDS = 60
const CODE_VALID_MS = 15 * 60 * 1000

// When this browser last had a code sent for this player. Sending a new
// code replaces the old one, so we don't auto-send again while the last
// one is still valid (e.g. when the card shows up on another page).
const sentKey = (id) => `verify_code_sent_${id}`
function lastSent(id) {
  try {
    return Number(sessionStorage.getItem(sentKey(id))) || 0
  } catch {
    return 0
  }
}
function markSent(id) {
  try {
    sessionStorage.setItem(sentKey(id), String(Date.now()))
  } catch {
    /* private mode: fine, the server rate-limits anyway */
  }
}

/**
 * "Check your email" card: enter the 6-digit code, resend it, or fix a
 * mistyped address. Used on /app/verify and in place of any play page
 * while the player is unverified.
 */
export default function VerifyEmail({ onVerified }) {
  const { user, updateUser } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [editing, setEditing] = useState(false)
  const [newEmail, setNewEmail] = useState(user?.email || '')
  const inputRef = useRef(null)

  // First time this card shows: make sure a code is on its way. Sign-up
  // already sent one (the server then answers "wait N seconds", which is
  // fine); players from before verification existed get their first here.
  useEffect(() => {
    if (!user?.id) return
    const since = Date.now() - lastSent(user.id)
    if (since < CODE_VALID_MS) {
      setCooldown(Math.max(0, Math.ceil((RESEND_SECONDS * 1000 - since) / 1000)))
      return
    }
    markSent(user.id)
    sendVerificationCode()
      .then(() => setCooldown(RESEND_SECONDS))
      .catch((err) => {
        const wait = /(\d+) seconds/.exec(err.message)
        if (wait) setCooldown(Number(wait[1]))
        else setError(err.message)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function verify(value) {
    setError('')
    setBusy(true)
    try {
      const { data } = await verifyEmailCode(value)
      updateUser(data)
      onVerified?.()
    } catch (err) {
      setError(err.message)
      setCode('')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  function onChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6 && !busy) verify(digits)
  }

  async function resend(email) {
    setError('')
    setInfo('')
    try {
      await sendVerificationCode(email)
      markSent(user.id)
      if (email) updateUser({ ...user, email })
      setInfo(`New code sent to ${email || user.email}.`)
      setEditing(false)
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      setError(err.message)
      // The server says how long to wait; keep the button disabled meanwhile.
      const wait = /(\d+) seconds/.exec(err.message)
      if (wait) setCooldown(Number(wait[1]))
    }
  }

  return (
    <div className="verify-card">
      <span className="verify-icon" aria-hidden="true">📧</span>
      <h1>Check your email</h1>
      <p className="muted">
        We sent a 6-digit code to <strong className="verify-email">{user?.email}</strong>. Enter it to start playing.
      </p>

      {error && <div className="alert-error">{error}</div>}
      {info && !error && <div className="alert-success">{info}</div>}

      {!editing ? (
        <>
          <input
            ref={inputRef}
            className="verify-code"
            value={code}
            onChange={onChange}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            aria-label="6-digit code"
            maxLength={6}
            autoFocus
            disabled={busy}
          />
          <button className="btn-primary btn-lg" onClick={() => verify(code)} disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Verify'}
          </button>
          <div className="verify-links">
            <button type="button" className="btn-link" onClick={() => resend()} disabled={cooldown > 0}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" className="btn-link" onClick={() => setEditing(true)}>
              Wrong email?
            </button>
          </div>
          <p className="verify-hint muted">Can't find it? Check your spam or promotions folder.</p>
        </>
      ) : (
        <form
          className="verify-change"
          onSubmit={(e) => {
            e.preventDefault()
            resend(newEmail.trim())
          }}
        >
          <label>
            Correct email
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required autoFocus autoComplete="email" />
          </label>
          <div className="verify-links">
            <button className="btn-primary" type="submit" disabled={cooldown > 0}>
              {cooldown > 0 ? `Send in ${cooldown}s` : 'Send code here'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
