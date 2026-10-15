import { useEffect, useState } from 'react'
import { testPush } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { enablePush, needsHomeScreen, pushStatus } from '../lib/push'
import { track } from '../lib/analytics'

const DISMISS_KEY = 'mindrace:notify-dismissed'
const DISMISS_DAYS = 7

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY)) || 0
    return Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000
  } catch {
    return false
  }
}

/**
 * "Turn on notifications" card: streak reminders and friend challenges
 * even when the app is closed. Hidden once on, when blocked, where the
 * browser can't do it, and for a week after "Not now".
 *
 * `context` only changes the wording: 'lobby' or 'result' (after a match).
 */
export default function NotifyPrompt({ context = 'lobby' }) {
  const { isGuest } = useAuth()
  const [state, setState] = useState('hidden') // hidden | ask | ios | busy | done | error
  const [error, setError] = useState('')

  useEffect(() => {
    if (isGuest || dismissedRecently()) return
    if (needsHomeScreen()) {
      setState('ios')
      return
    }
    let alive = true
    pushStatus().then((s) => alive && s === 'off' && setState('ask'))
    return () => {
      alive = false
    }
  }, [isGuest])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Storage blocked: it just shows again next time.
    }
    setState('hidden')
    track('notify_prompt', { action: 'dismiss', context })
  }

  async function turnOn() {
    setState('busy')
    setError('')
    try {
      await enablePush()
      setState('done')
      track('notify_prompt', { action: 'enabled', context })
      testPush().catch(() => {})
      setTimeout(() => setState('hidden'), 5000)
    } catch (err) {
      setError(
        Notification.permission === 'denied'
          ? 'Notifications are blocked for this site. Allow them in your browser settings to get reminders.'
          : err.message
      )
      setState('error')
      track('notify_prompt', { action: 'failed', context })
    }
  }

  if (state === 'hidden') return null

  if (state === 'ios') {
    return (
      <section className="notify-card" role="status">
        <span className="notify-icon" aria-hidden="true">🔔</span>
        <div className="notify-text">
          <strong>Get streak reminders on iPhone</strong>
          <span>
            Tap <b>Share</b> → <b>Add to Home Screen</b>, open MindRace from there, and turn notifications on.
          </span>
        </div>
        <div className="notify-actions">
          <button type="button" className="btn-ghost small" onClick={dismiss}>
            Got it
          </button>
        </div>
      </section>
    )
  }

  if (state === 'done') {
    return (
      <section className="notify-card notify-done" role="status">
        <span className="notify-icon" aria-hidden="true">✅</span>
        <div className="notify-text">
          <strong>Notifications are on</strong>
          <span>We sent you a test one. We'll remind you before your streak ends.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="notify-card">
      <span className="notify-icon" aria-hidden="true">🔔</span>
      <div className="notify-text">
        <strong>{context === 'result' ? 'Never miss a challenge' : "Don't lose your streak"}</strong>
        <span>
          Get a heads-up before your streak ends, when Mind Race Night starts, and when a friend challenges you.
        </span>
        {state === 'error' && <span className="notify-error">{error}</span>}
      </div>
      <div className="notify-actions">
        <button type="button" className="btn-primary small" onClick={turnOn} disabled={state === 'busy'}>
          {state === 'busy' ? 'Turning on…' : 'Turn on'}
        </button>
        <button type="button" className="btn-ghost small" onClick={dismiss} disabled={state === 'busy'}>
          Not now
        </button>
      </div>
    </section>
  )
}
