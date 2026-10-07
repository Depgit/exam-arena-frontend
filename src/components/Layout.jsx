import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import FriendNotifications from './FriendNotifications'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { isAdmin, isGuest } = useAuth()
  return (
    <div className="app-shell">
      <Navbar />
      {isGuest && (
        <div className="guest-banner" role="status">
          <span>
            🎮 You're exploring a <strong>demo account</strong> — play anything. Demo progress is cleared after a few days.
          </span>
          <Link to="/register">Create a real account →</Link>
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
