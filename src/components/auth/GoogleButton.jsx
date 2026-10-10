import { useEffect, useRef, useState } from 'react'

// The "Sign in with Google" web client id. It is public by design (Google
// shows it to every visitor); VITE_GOOGLE_CLIENT_ID can override it.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '527691682240-tofp2s6qmgig2dggk6hm5gijcbac5arb.apps.googleusercontent.com'

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise = null

// Load Google's sign-in script once, on the first page that needs it.
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      s.onerror = () => {
        scriptPromise = null
        reject(new Error('Could not load Google sign-in'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

/**
 * Google's own "Continue with Google" button. onCredential gets the ID
 * token, which the server checks with Google's public keys.
 */
export default function GoogleButton({ onCredential, text = 'continue_with' }) {
  const ref = useRef(null)
  const cb = useRef(onCredential)
  cb.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => cb.current?.(resp.credential),
          ux_mode: 'popup',
        })
        // Google's button has a fixed max width; match the card when we can.
        const width = Math.min(400, Math.max(220, ref.current.offsetWidth || 320))
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text,
          shape: 'pill',
          logo_alignment: 'center',
          width,
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [text])

  if (failed) {
    return <p className="google-failed muted">Google sign-in couldn't load — check your connection or use email below.</p>
  }
  return <div className="google-btn" ref={ref} />
}
