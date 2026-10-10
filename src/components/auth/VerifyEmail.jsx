import { useEffect, useState } from 'react'
import { sendVerificationCode, verifyEmailCode } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import CodeInput from './CodeInput'

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
    } finally {
      setBusy(false)
    }
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
      <div className="verify-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </svg>
      </div>
      <h1>Verify your email</h1>

      {!editing ? (
        <>
          <p className="verify-lead">Enter the 6-digit code we sent to</p>
          <div className="verify-address">
            <span>{user?.email}</span>
            <button type="button" className="btn-link" onClick={() => { setEditing(true); setError(''); setInfo('') }}>
              Change
            </button>
          </div>

          <CodeInput value={code} onChange={(v) => { setCode(v); setError('') }} onComplete={(v) => !busy && verify(v)} disabled={busy} invalid={!!error} />

          <div className="verify-status" aria-live="polite">
            {error ? <span className="verify-error">{error.charAt(0).toUpperCase() + error.slice(1)}</span> : info ? <span className="verify-info">{info}</span> : busy ? <span className="muted">Checking…</span> : null}
          </div>

          <button className="btn-primary btn-lg verify-submit" onClick={() => verify(code)} disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Verify & play'}
          </button>

          <p className="verify-resend">
            Didn't get it?{' '}
            {cooldown > 0 ? (
              <span className="muted">Resend in 0:{String(cooldown).padStart(2, '0')}</span>
            ) : (
              <button type="button" className="btn-link" onClick={() => resend()}>
                Resend code
              </button>
            )}
          </p>
          <p className="verify-hint">Check your spam or promotions folder too. The code works for 15 minutes.</p>
        </>
      ) : (
        <form
          className="verify-change"
          onSubmit={(e) => {
            e.preventDefault()
            resend(newEmail.trim())
          }}
        >
          <p className="verify-lead">Typo in your email? Fix it and we'll send a new code there.</p>
          {error && <div className="alert-error">{error}</div>}
          <label>
            Email
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required autoFocus autoComplete="email" />
          </label>
          <button className="btn-primary btn-lg" type="submit" disabled={cooldown > 0}>
            {cooldown > 0 ? `Send code in ${cooldown}s` : 'Send code'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setError('') }}>
            Back
          </button>
        </form>
      )}
    </div>
  )
}
