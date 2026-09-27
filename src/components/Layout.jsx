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
        <Outlet />
      </main>
      {!isAdmin && <FriendNotifications />}
    </div>
  )
}
