import { useEffect, useRef, useState } from 'react'

const RESOLUTION_MS = 250

/**
 * Turns the server's sparse match clock into a smooth one.
 *
 * The server is authoritative but quiet: runMatchTimer only pushes a
 * time_update every 10 seconds (internal/service/match_service.go), so
 * rendering remaining_seconds straight from the socket makes the match clock
 * lurch 120 -> 110 -> 100. There is no time pressure in a number that moves
 * twelve times a match.
 *
 * So we tick locally in between and hard-resync every time the server
 * speaks. The client never invents the time — it only interpolates forward
 * from the last authoritative value, and any drift is corrected within one
 * server tick.
 *
 * Two details that matter:
 *
 *  - Elapsed time is derived from the wall clock, not from counting
 *    intervals. Browsers throttle timers in background tabs, so a counted
 *    tick would fall behind and then snap; a wall-clock delta is simply
 *    correct whenever it is next evaluated.
 *
 *  - We round UP. The server truncates (`int(remaining.Seconds())`), so when
 *    it says 110 the true remaining is somewhere in [110, 111). Ceiling the
 *    interpolation keeps us in phase with that truncation instead of running
 *    half a second ahead of it.
 *
 * @param serverSeconds latest authoritative remaining seconds, or null before
 *   the match clock is known. Pass the value from match_start, then from each
 *   time_update.
 * @returns the smoothed remaining seconds, or null while unknown.
 */
export function useSmoothCountdown(serverSeconds) {
  // { seconds, at } — the last authoritative reading and when we received it.
  const anchorRef = useRef(null)
  const [display, setDisplay] = useState(serverSeconds ?? null)

  // Re-anchor whenever the server speaks.
  useEffect(() => {
    if (serverSeconds == null) return
    anchorRef.current = { seconds: serverSeconds, at: Date.now() }
    setDisplay(serverSeconds)
  }, [serverSeconds])

  useEffect(() => {
    function tick() {
      const anchor = anchorRef.current
      if (!anchor) return
      const elapsed = (Date.now() - anchor.at) / 1000
      const next = Math.max(0, Math.ceil(anchor.seconds - elapsed))
      setDisplay((prev) => (prev === next ? prev : next))
    }

    // Faster than 1s so the number updates promptly after a resync rather
    // than up to a second late; the setDisplay guard keeps it a no-op
    // between whole-second boundaries.
    const interval = setInterval(tick, RESOLUTION_MS)
    // Catch up immediately on return to a backgrounded tab.
    const onVisibility = () => !document.hidden && tick()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return display
}

/** Formats a seconds count as mm:ss, the way a match clock should read. */
export function formatClock(seconds) {
  if (seconds == null) return '--:--'
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}
