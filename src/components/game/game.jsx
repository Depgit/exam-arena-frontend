import { useMemo } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

// ── Rank tiers ──────────────────────────────────────────────────────────
// Purely a presentation of the ELO rating the server already tracks. New
// accounts start at 1200 (migrations/001), which lands them in Silver with
// room to climb or drop a tier in their first few matches.
const TIERS = [
  { min: 1900, key: 'master', name: 'Master', icon: '👑' },
  { min: 1700, key: 'diamond', name: 'Diamond', icon: '💎' },
  { min: 1500, key: 'platinum', name: 'Platinum', icon: '🔷' },
  { min: 1300, key: 'gold', name: 'Gold', icon: '🥇' },
  { min: 1100, key: 'silver', name: 'Silver', icon: '🥈' },
  { min: -Infinity, key: 'bronze', name: 'Bronze', icon: '🥉' },
]

export function tierFor(rating) {
  if (rating == null) return null
  return TIERS.find((t) => rating >= t.min)
}

export function RankBadge({ rating, size = 'md', showRating = true }) {
  const tier = tierFor(rating)
  if (!tier) return null
  return (
    <span className={`rank-badge tier-${tier.key} rank-badge-${size}`} title={`${tier.name} · ${rating}`}>
      <span aria-hidden="true">{tier.icon}</span>
      <span className="rank-badge-name">{tier.name}</span>
      {showRating && <span className="rank-badge-rating">{Math.round(rating)}</span>}
    </span>
  )
}

// ── Avatar ──────────────────────────────────────────────────────────────
// A deterministic hue per username, so a player looks the same everywhere
// without us storing or uploading avatar images.
function hueOf(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function Avatar({ name, size = 40, ring }) {
  const hue = hueOf(name)
  return (
    <span
      className={`avatar ${ring ? `avatar-ring-${ring}` : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${(hue + 50) % 360} 85% 42%))`,
      }}
      aria-hidden="true"
    >
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

// ── Countdown ring ──────────────────────────────────────────────────────
export function TimerRing({ remaining, total, size = 64 }) {
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = total > 0 && remaining != null ? Math.max(0, Math.min(1, remaining / total)) : 1
  const state = remaining != null && remaining <= 10 ? 'low' : remaining != null && remaining <= 30 ? 'mid' : 'ok'
  const mm = remaining == null ? '--' : Math.floor(remaining / 60)
  const ss = remaining == null ? '--' : String(Math.max(0, remaining) % 60).padStart(2, '0')

  return (
    <div className={`timer-ring timer-ring-${state}`} style={{ width: size, height: size }} role="timer" aria-label={`${remaining ?? 0} seconds left`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="timer-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="timer-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="timer-ring-label">{mm}:{ss}</span>
    </div>
  )
}

// ── Confetti (victory only) ─────────────────────────────────────────────
const CONFETTI_COLORS = ['#7c5cff', '#22e4ff', '#3ef0a0', '#ffd23f', '#ff3da8']

export function Confetti({ count = 60 }) {
  const reduced = usePrefersReducedMotion()
  // Generated once per mount so pieces don't jump around on re-render.
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.4 + Math.random() * 1.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 6,
      })),
    [count]
  )
  if (reduced) return null
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 1.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Option key labels (A–D) ─────────────────────────────────────────────
export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Maps a keypress (1–6 or A–F) to an option index, or -1. */
export function optionIndexForKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return -1
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return -1
  const k = e.key.toUpperCase()
  const byLetter = OPTION_KEYS.indexOf(k)
  if (byLetter !== -1) return byLetter
  const n = Number(k)
  return Number.isInteger(n) && n >= 1 && n <= OPTION_KEYS.length ? n - 1 : -1
}
