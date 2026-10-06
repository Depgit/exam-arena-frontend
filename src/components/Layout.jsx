import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import FriendNotifications from './FriendNotifications'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { isAdmin } = useAuth()
  return (
    <div className="app-shell">
      <Navbar />
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
