import { useEffect, useState } from 'react'
import { BASE_URL } from '../api/client'

/**
 * Wakes the backend as early as possible.
 *
 * The free Render instance sleeps after ~15 minutes without traffic and
 * takes 20–60s to come back. Rather than let the first API call on the page
 * hang silently, we ping /health the moment the app loads (before React
 * renders) so the server starts waking while the player is still looking at
 * the page, and expose a status the UI can show:
 *
 *   'checking'    → request in flight, not slow yet (show nothing)
 *   'waking'      → slower than SLOW_MS: the server is booting
 *   'unreachable' → nothing answers (a local backend that isn't running,
 *                   or a remote one still down after GIVE_UP_MS); retrying
 *   'wrong-server'→ something answered, but not the game server (e.g.
 *                   another app on the same port): waiting won't help
 *   'ready'       → it answered
 */

const SLOW_MS = 2000
const GIVE_UP_MS = 90_000
const RETRY_MS = 3000

let status = 'checking'

// A local backend never "sleeps": if it doesn't answer, it isn't running.
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE_URL)
export const SERVER_URL = BASE_URL
let startedAt = 0
let started = false
const listeners = new Set()

function set(next) {
  if (status === next) return
  status = next
  listeners.forEach((fn) => fn(status))
}

async function ping() {
  try {
    // Render holds the request open while the instance boots, so allow a
    // long time before treating one attempt as failed.
    const res = await fetch(`${BASE_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout?.(65_000),
    })
    if (res.ok) {
      set('ready')
      return
    }
    // 502/503/504 is what a booting host returns; anything else (404…)
    // means a different app is answering at this address.
    if (res.status < 500) {
      set('wrong-server')
      setTimeout(ping, 15_000)
      return
    }
  } catch {
    // Network error / timeout. Remote: probably still booting, retry below.
    // Local: the backend simply isn't running.
    if (IS_LOCAL) set('unreachable')
  }
  if (Date.now() - startedAt > GIVE_UP_MS) set('unreachable')
  setTimeout(ping, status === 'unreachable' ? 15_000 : RETRY_MS)
}

/** Starts the wake-up ping once per page load. Safe to call repeatedly. */
export function startServerWake() {
  if (started) return
  started = true
  startedAt = Date.now()
  setTimeout(() => {
    if (status === 'checking') set('waking')
  }, SLOW_MS)
  ping()
}

/** Current server status plus seconds since the page started waking it. */
export function useServerWake() {
  const [state, setState] = useState(status)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    listeners.add(setState)
    setState(status) // catch up on anything that happened before mount
    return () => listeners.delete(setState)
  }, [])

  useEffect(() => {
    if (state !== 'waking' && state !== 'unreachable') return
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [state])

  return { status: state, elapsed }
}
