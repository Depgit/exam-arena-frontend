// First-party analytics: a few events go to our own server (POST
// /api/v1/events) for the admin Growth page. No third-party tracker and no
// cookies — just a random id this browser keeps, so a visitor is counted
// once. Failures are ignored: analytics must never get in a player's way.
import { api } from '../api/client'

const ID_KEY = 'mr_anon_id'
const VISIT_KEY = 'mr_visit_sent'

function anonId() {
  try {
    let id = localStorage.getItem(ID_KEY)
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
      localStorage.setItem(ID_KEY, id)
    }
    return id
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}` // private mode: per page load
  }
}

export function track(event, props = {}) {
  const clean = {}
  for (const [k, v] of Object.entries(props)) if (v != null && v !== '') clean[k] = String(v).slice(0, 100)
  api.post('/api/v1/events', { event, anon_id: anonId(), props: clean }).catch(() => {})
}

// Where this visitor came from: ?utm_source=… or ?ref=… if the link says,
// else the referring site's name (whatsapp, linkedin, google…), else direct.
function source() {
  const q = new URLSearchParams(window.location.search)
  const tagged = q.get('utm_source') || q.get('ref')
  if (tagged) return tagged.toLowerCase()
  if (window.location.pathname.startsWith('/i/')) return 'invite_link'
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : ''
    if (!host || host === window.location.hostname) return 'direct'
    const known = ['whatsapp', 'linkedin', 'google', 'instagram', 'facebook', 'twitter', 'reddit', 'telegram', 'producthunt', 'peerlist', 'youtube', 'bing']
    const hit = known.find((k) => host.includes(k)) || (host === 't.co' ? 'twitter' : null) || (host.includes('lnkd.in') ? 'linkedin' : null)
    return hit || host.replace(/^www\./, '')
  } catch {
    return 'direct'
  }
}

// Once per browser session: counts visitors and where they came from.
export function trackVisit() {
  try {
    if (sessionStorage.getItem(VISIT_KEY)) return
    sessionStorage.setItem(VISIT_KEY, '1')
  } catch {
    /* still count it */
  }
  const q = new URLSearchParams(window.location.search)
  track('visit', {
    path: window.location.pathname,
    source: source(),
    medium: q.get('utm_medium'),
    campaign: q.get('utm_campaign'),
  })
}
