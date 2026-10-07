import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startServerWake } from './lib/serverWake'
import './styles.css'
import './arena.css'

// Ping the backend before anything renders, so a sleeping server starts
// booting while the page is still loading.
startServerWake()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
