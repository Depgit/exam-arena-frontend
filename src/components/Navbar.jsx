import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const { connected } = useWebSocket()
  const navigate = useNavigate()

  const userLinks = [
    ['/app/dashboard', 'Dashboard'],
    ['/app/matchmaking', 'Play'],
    ['/app/friend', 'Friend Match'],
    ['/app/friends', 'Friends'],
    ['/app/practice', 'Practice'],
    ['/app/leaderboard', 'Leaderboard'],
    ['/app/profile', 'Profile'],
  ]
  const adminLinks = [
    ['/admin/dashboard', 'Overview'],
    ['/admin/questions/new', 'Create Question'],
    ['/admin/flags', 'Flagged Questions'],
    ['/admin/stats', 'System Stats'],
  ]

  const links = isAdmin ? adminLinks : userLinks

  return (
    <nav className="navbar">
      <div className="navbar-brand">Exam Arena{isAdmin ? ' · Admin' : ''}</div>
      <div className="navbar-links">
        {links && links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
          </NavLink>
        ))}
      </div>
      <div className="navbar-right">
        <span className={`ws-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Connected' : 'Disconnected'} />
        <NavLink to="/app/profile" className="navbar-user" title="View your profile">{user?.username}</NavLink>
        <button
          className="btn-ghost"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          Log out
        </button>
      </div>
    </nav>
  )
}
