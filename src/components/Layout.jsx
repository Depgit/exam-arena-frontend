import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import FriendNotifications from './FriendNotifications'
import ChatDrawer from './chat/ChatDrawer'
import ResumeMatch from './ResumeMatch'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { isAdmin, isGuest, needsVerification } = useAuth()
  const { pathname } = useLocation()

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
      <ResumeMatch />
      {isGuest && (
        <div className="guest-banner" role="status">
          <span className="guest-banner-long">
            👀 You're looking around on a <strong>demo account</strong> — create a free account to play.
          </span>
          <span className="guest-banner-short">
            👀 <strong>Demo</strong> · sign up free to play
          </span>
          <Link to="/register">
            <span className="guest-banner-long">Create free account →</span>
            <span className="guest-banner-short">Sign up →</span>
          </Link>
        </div>
      )}
      {!isGuest && needsVerification && pathname !== '/app/verify' && (
        <div className="guest-banner verify-banner" role="status">
          <span>
            📧 <strong>Verify your email</strong> to play and chat — we sent you a 6-digit code.
          </span>
          <Link to="/app/verify">Enter code →</Link>
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
      {!isAdmin && <ChatDrawer />}
    </div>
  )
}
