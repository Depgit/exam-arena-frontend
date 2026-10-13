import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startServerWake } from './lib/serverWake'
import { trackVisit } from './lib/analytics'
import './styles.css'
import './arena.css'

// Ping the backend before anything renders, so a sleeping server starts
// booting while the page is still loading.
startServerWake()
trackVisit()

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
