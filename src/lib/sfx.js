/**
 * Game sound effects, synthesised in the browser.
 *
 * Everything here is generated with oscillators rather than loaded from
 * audio files: no assets to ship or license, nothing to preload, works
 * offline, and the whole module costs a couple of kilobytes. These are UI
 * blips — short, quiet and skippable — not music.
 *
 * design_system.md §22 makes a mute toggle mandatory, so muting is the one
 * piece of state this module persists.
 */

const STORAGE_KEY = 'exam-arena:sound'

// Deliberately low. Sound in a quiz game should confirm an action, not
// announce it to the room.
const MASTER_GAIN = 0.18

let ctx = null
let master = null
let muted = readMutedFromStorage()

function readMutedFromStorage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'off'
  } catch {
    // Private mode or storage disabled: play sound, just don't remember the choice.
    return false
  }
}

function ensureContext() {
  if (muted) return null
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null // older browsers: silently no-op
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(ctx.destination)
  }
  // Autoplay policy: the context is born suspended and only resumes after a
  // real user gesture. Every call site here is downstream of a tap or a
  // socket event that followed one, so this is a no-op in practice — but it
  // is what makes the first sound of the session actually audible.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/**
 * Schedules one enveloped tone.
 *
 * The attack/decay ramps are what stop it sounding like a click: a bare
 * oscillator switched on and off pops, because the waveform starts at full
 * amplitude.
 */
function tone(freq, { at = 0, dur = 0.12, type = 'sine', peak = 1, slideTo = null } = {}) {
  const c = ensureContext()
  if (!c) return

  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const gain = c.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)

  // exponentialRampToValueAtTime cannot touch zero, hence the epsilons.
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  osc.connect(gain).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

const chord = (freqs, { gap = 0.1, dur = 0.26, type = 'triangle', peak = 1 } = {}) =>
  freqs.forEach((f, i) => tone(f, { at: i * gap, dur, type, peak }))

const SOUNDS = {
  /** Option tapped — the lightest possible acknowledgement. */
  select: () => tone(420, { dur: 0.05, type: 'triangle', peak: 0.5 }),
  /** Countdown tick: 3 · 2 · 1, and the last seconds of the match clock. */
  tick: () => tone(880, { dur: 0.06, type: 'square', peak: 0.35 }),
  /** Right answer — rising major third. */
  correct: () => chord([659, 988], { gap: 0.08, dur: 0.16 }),
  /** Wrong answer — a short downward slide, not a punishing buzz. */
  wrong: () => tone(200, { dur: 0.26, type: 'sawtooth', peak: 0.5, slideTo: 90 }),
  /** Opponent found. Needs to cut through whatever else the player is doing. */
  found: () => chord([587, 880], { gap: 0.11, dur: 0.2, type: 'sine' }),
  /** Victory — major arpeggio. */
  victory: () => chord([523, 659, 784, 1047], { gap: 0.1 }),
  /** Defeat — the same shape, descending and minor. */
  defeat: () => chord([392, 330, 262], { gap: 0.13, dur: 0.3, type: 'sine', peak: 0.7 }),
}

/** Plays a named effect. Unknown names and muted state are no-ops. */
export function play(name) {
  if (muted) return
  SOUNDS[name]?.()
}

export function isMuted() {
  return muted
}

export function setMuted(next) {
  muted = Boolean(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on')
  } catch {
    // Not persistable — the in-memory flag still holds for this session.
  }
}

export const SOUND_NAMES = Object.keys(SOUNDS)
