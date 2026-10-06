/**
 * Haptic feedback, where the device offers it.
 *
 * navigator.vibrate is unsupported on iOS Safari and can throw when a page
 * is not visible or the user has disabled it, so every call is guarded and
 * failure is simply nothing happening — haptics are never load-bearing.
 */

/** Durations in ms; arrays alternate vibrate/pause. */
export const HAPTIC = {
  light: 10,
  medium: 25,
  success: [12, 40, 12],
  error: [40, 30, 40],
}

export function haptic(pattern = HAPTIC.light) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Unsupported or blocked by the platform.
  }
}
