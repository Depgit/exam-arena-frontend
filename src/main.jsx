import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startServerWake } from './lib/serverWake'
import { trackVisit } from './lib/analytics'
import './styles.css'
import './arena.css'

// Ping the backend before so a sleeping server starts
// booting while the page is still loading.
startServerWake()
trackVisit()

// A page left open across a deploy still asks for the old build's files.
// They're gone, the host answers with index.html, and the import fails.
// Reload once to pick up the new build; a live match resumes from the
// server. The timestamp stops a reload loop if the files are really missing.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'mindrace:reloaded-for-update'
  let last = 0
  try {
    last = Number(sessionStorage.getItem(KEY)) || 0
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Storage blocked: still reload, the browser stops obvious loops itself.
  }
  if (Date.now() - last < 10_000) return // just reloaded: let the error show
  event.preventDefault()
  window.location.reload()
})

// Makes the site installable and powers the Android app (public/sw.js).
// Production only: in dev a service worker would get in the way of reloads.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
