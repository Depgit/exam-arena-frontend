import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/**
 * Animates a number towards its target.
 *
 * A rating that slides 1482 → 1498 reads as something you earned; the same
 * number appearing instantly reads as a database field. Used for the
 * post-match rating change and for live scores during a battle.
 *
 * Returns the target immediately when the player prefers reduced motion —
 * the information is never withheld, only the movement.
 */
export function useCountUp(target, { duration = 700 } = {}) {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(target ?? 0)
  // Where the next animation starts from: the last value we settled on,
  // so a target that changes mid-flight animates from where it visually is.
  const fromRef = useRef(target ?? 0)

  useEffect(() => {
    if (target == null) return

    if (reduced || duration <= 0) {
      fromRef.current = target
      setValue(target)
      return
    }

    const from = fromRef.current
    if (from === target) return

    const start = performance.now()
    let frame

    function step(now) {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic: quick off the mark, settling at the end, which is what
      // makes the number feel like it lands rather than stops.
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(from + (target - from) * eased)
      setValue(next)
      if (t < 1) {
        frame = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }

    frame = requestAnimationFrame(step)
    return () => {
      // Interrupted (unmount, or a new target): keep the number we reached
      // as the start of the next run so it never jumps backwards.
      cancelAnimationFrame(frame)
      fromRef.current = value
    }
    // `value` is intentionally not a dependency — reading it in cleanup is
    // the point, listing it would restart the animation on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced])

  return value
}
