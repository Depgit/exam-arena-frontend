import { useEffect, useState } from 'react'
import { useServerWake } from '../lib/serverWake'

/**
 * Small floating notice shown only when the backend is slow to answer
 * (asleep on free hosting). Invisible when the server is already awake.
 */
export default function ServerWakeNotice() {
  const { status, elapsed } = useServerWake()
  const [wasSlow, setWasSlow] = useState(false)
  const [showReady, setShowReady] = useState(false)

  useEffect(() => {
    if (status === 'waking' || status === 'unreachable') setWasSlow(true)
    if (status === 'ready' && wasSlow) {
      // Only confirm "awake" if we told the player it was asleep.
      setShowReady(true)
      const t = setTimeout(() => setShowReady(false), 2500)
      return () => clearTimeout(t)
    }
  }, [status, wasSlow])

  if (status === 'waking') {
    return (
      <div className="server-wake" role="status" aria-live="polite">
        <span className="spinner" />
        <div>
          <strong>Waking up the game server…</strong>
          <span>Free hosting naps when idle — usually under a minute. {elapsed}s</span>
        </div>
      </div>
    )
  }
  if (status === 'unreachable') {
    return (
      <div className="server-wake is-error" role="alert">
        <span aria-hidden="true">⚠️</span>
        <div>
          <strong>Can't reach the game server</strong>
          <span>Still trying… check your connection. {elapsed}s</span>
        </div>
      </div>
    )
  }
  if (showReady) {
    return (
      <div className="server-wake is-ready" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Server is awake</strong>
          <span>You're good to go.</span>
        </div>
      </div>
    )
  }
  return null
}
