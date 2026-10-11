// The invite a visitor arrived with (mindrace.in/i/<code>), kept until they
// sign up — even if they look around first or come back days later.
const KEY = 'mr_referral'
const KEEP_MS = 30 * 24 * 3600 * 1000

export function saveReferral(code, name) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, name, at: Date.now() }))
  } catch {
    /* private mode: the invite just won't be remembered */
  }
}

// { code, name } or null
export function getReferral() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (r?.code && Date.now() - r.at < KEEP_MS) return r
  } catch {
    /* ignore */
  }
  return null
}

export function clearReferral() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export const inviteLink = (code) => `https://mindrace.in/i/${encodeURIComponent(code)}`
