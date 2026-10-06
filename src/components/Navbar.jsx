import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import SoundToggle from './SoundToggle'
import { Avatar } from './game/game'

const userLinks = [
  ['/app/dashboard', 'Lobby', '🏠'],
  ['/app/matchmaking', 'Play', '⚔️'],
  ['/app/friend', 'Friend Match', '🎮'],
  ['/app/friends', 'Friends', '👥'],
  ['/app/practice', 'Practice', '🎯'],
  ['/app/daily', 'Daily', '📅'],
  ['/app/leaderboard', 'Ranks', '🏆'],
]
const adminLinks = [
  ['/admin/dashboard', 'Overview', '📊'],
  ['/admin/questions/new', 'Create Question', '✏️'],
  ['/admin/flags', 'Flagged', '🚩'],
  ['/admin/stats', 'System', '🖥️'],
]

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const { connected } = useWebSocket()
  const navigate = useNavigate()

  const links = isAdmin ? adminLinks : userLinks
  const name = user?.display_name || user?.username

  return (
    <nav className="navbar">
      <Link to={isAdmin ? '/admin/dashboard' : '/app/dashboard'} className="navbar-brand">
        <span className="brand-mark" aria-hidden="true">⚡</span>
        <span className="brand-text">
          EXAM<span>ARENA</span>
        </span>
        {isAdmin && <span className="brand-tag">Admin</span>}
      </Link>

      <div className="navbar-links">
        {links.map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon" aria-hidden="true">{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>

      <div className="navbar-right">
        <span
          className={`live-pill ${connected ? 'online' : 'offline'}`}
          title={connected ? 'Connected to the game server' : 'Reconnecting to the game server…'}
        >
          <span className={`ws-dot ${connected ? 'online' : 'offline'}`} />
          {connected ? 'Live' : 'Offline'}
        </span>
        <SoundToggle />
        {!isAdmin ? (
          <NavLink to="/app/profile" end className="navbar-user" title="View your profile">
            <Avatar name={name} size={28} />
            <span className="navbar-user-name">{name}</span>
          </NavLink>
        ) : (
          <span className="navbar-user">
            <Avatar name={name} size={28} />
            <span className="navbar-user-name">{name}</span>
          </span>
        )}
        <button
          className="btn-ghost icon-btn"
          title="Log out"
          aria-label="Log out"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          ⏻
        </button>
      </div>
    </nav>
  )
}
