// Google AdSense, for website visitors only.
//
// AdSense doesn't allow its ads inside apps (that's AdMob's job), so the
// Android app — this same site opened by our Trusted Web Activity — never
// loads it. The app is recognised by how it opens the site: with
// ?source=app (manifest start_url) or an android-app:// referrer. Once
// seen, that's remembered for the session's later page loads.
//
// Ads are non-personalised: many players are under 18.

export const ADSENSE_CLIENT = 'ca-pub-1052208524822225'
const IN_APP_KEY = 'mr_in_app'

export function isInApp() {
  try {
    if (sessionStorage.getItem(IN_APP_KEY) === '1') return true
    const fromApp =
      new URLSearchParams(window.location.search).get('source') === 'app' ||
      document.referrer.startsWith('android-app://')
    if (fromApp) sessionStorage.setItem(IN_APP_KEY, '1')
    return fromApp
  } catch {
    return false
  }
}

let loaded = false

/** Loads the AdSense script once, unless we're inside the Android app. */
export function loadAdSense() {
  if (loaded || isInApp()) return
  loaded = true
  window.adsbygoogle = window.adsbygoogle || []
  window.adsbygoogle.requestNonPersonalizedAds = 1
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  document.head.appendChild(s)
}
