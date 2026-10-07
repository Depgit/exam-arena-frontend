import { Suspense, useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import FriendNotifications from './FriendNotifications'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { isAdmin, isGuest } = useAuth()

  // Download the other pages' code while the browser is idle, so opening a
  // page never waits on a chunk download. Same chunks App.jsx lazy-loads.
  useEffect(() => {
    if (isAdmin) return
    const preload = () => {
      import('../pages/user/Matchmaking')
      import('../pages/user/LiveMatch')
      import('../pages/user/Practice')
      import('../pages/user/Leaderboard')
      import('../pages/user/Profile')
      import('../pages/user/Friends')
      import('../pages/user/DailyChallenge')
      import('../pages/user/FriendMatch')
    }
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500))
    const id = idle(preload)
    return () => (window.cancelIdleCallback || clearTimeout)(id)
  }, [isAdmin])
  return (
    <div className="app-shell">
      <Navbar />
      {isGuest && (
        <div className="guest-banner" role="status">
          <span className="guest-banner-long">
            🎮 You're exploring a <strong>demo account</strong> — play anything. Demo progress is cleared after a few days.
          </span>
          <span className="guest-banner-short">
            🎮 <strong>Demo account</strong> · resets in a few days
          </span>
          <Link to="/register">
            <span className="guest-banner-long">Create a real account →</span>
            <span className="guest-banner-short">Sign up →</span>
          </Link>
        </div>
      )}
      <main className="app-main">
        {/* Inner boundary so the navbar stays put while a page chunk loads. */}
        <Suspense
          fallback={
            <div className="page-center">
              <div className="spinner" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      {!isAdmin && <FriendNotifications />}
    </div>
  )
}
