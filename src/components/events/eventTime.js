// Shared helpers for college events.

export const PHASE_LABEL = { upcoming: 'Starts soon', live: 'Live now', ended: 'Ended', cancelled: 'Cancelled' }

export function phaseOf(ev, now = Date.now()) {
  if (ev.cancelled_at) return 'cancelled'
  if (now < new Date(ev.starts_at).getTime()) return 'upcoming'
  if (now < new Date(ev.ends_at).getTime()) return 'live'
  return 'ended'
}

export function fmtWhen(iso) {
  return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** "1h 05m" / "4m 09s" style countdown. */
export function fmtLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

export function durationLabel(ev) {
  const mins = Math.round((new Date(ev.ends_at) - new Date(ev.starts_at)) / 60000)
  return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins} min`
}
