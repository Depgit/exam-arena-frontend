import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useConfirm } from '../context/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { useStreak } from '../context/StreakContext'
import { useChat } from '../context/ChatContext'
import SoundToggle from './SoundToggle'
import { Avatar } from './game/game'
import PowerIcon from './icons/PowerIcon'

const userLinks = [
  ['/app/dashboard', 'Lobby', '🏠'],
  ['/app/matchmaking', 'Play', '⚔️'],
  ['/app/group', 'Group Race', '🏁'],
  ['/app/friend', 'Friend Match', '🎮'],
  ['/app/friends', 'Friends', '👥'],
  ['/app/practice', 'Practice', '🎯'],
  ['/app/daily', 'Daily', '📅'],
  ['/app/events', 'Events', '🎓'],
  ['/app/leaderboard', 'Ranks', '🏆'],
  ['/app/about', 'About', 'ℹ️'],
]
// Phones get a bottom tab bar with the five most-used screens; Daily and
// Friend Match stay reachable from the Lobby.
const userTabs = [
  ['/app/dashboard', 'Lobby', '🏠'],
  ['/app/matchmaking', 'Play', '⚔️'],
  ['/app/practice', 'Practice', '🎯'],
  ['/app/friends', 'Friends', '👥'],
  ['/app/leaderboard', 'Ranks', '🏆'],
]

const adminLinks = [
  ['/admin/dashboard', 'Overview', '📊'],
  ['/admin/growth', 'Growth', '📈'],
  ['/admin/questions/new', 'Create Question', '✏️'],
  ['/admin/flags', 'Flagged', '🚩'],
  ['/admin/chat', 'Chat', '💬'],
  ['/admin/events', 'Events', '🎓'],
  ['/admin/stats', 'System', '🖥️'],
]

export default function Navbar() {
  const confirm = useConfirm()
  const { user, isAdmin, logout } = useAuth()
  const { connected } = useWebSocket()
  const { streak } = useStreak()
  const { enabled: chatEnabled, unread } = useChat()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const links = isAdmin ? adminLinks : userLinks
  const tabs = isAdmin ? adminLinks : userTabs
  // A live match gets the whole screen on phones.
  const inMatch = pathname.startsWith('/app/match/')
  const name = user?.display_name || user?.username
  // Phones: the ☰ menu with every page (the bottom bar only fits five).
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  async function askLogout() {
    // Easy to hit by accident on a phone: ask first.
    const ok = await confirm({
      title: 'Log out of Mind Race?',
      message: 'Your streak and progress are saved. Log back in any time.',
      confirmText: 'Log out',
      cancelText: 'Stay',
      tone: 'danger',
      icon: '👋',
    })
    if (!ok) return
    setMenuOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <>
    <nav className="navbar">
      <Link to={isAdmin ? '/admin/dashboard' : '/app/dashboard'} className="navbar-brand">
        <span className="brand-mark" aria-hidden="true">⚡</span>
        <span className="brand-text">
          MIND<span>RACE</span>
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
        {streak?.current > 0 && (
          <Link
            to="/app/dashboard"
            className={`streak-pill ${streak.at_risk ? 'at-risk' : ''}`}
            title={streak.at_risk ? `Play today to keep your ${streak.current}-day streak` : `${streak.current}-day streak`}
          >
            🔥 {streak.current}
          </Link>
        )}
        {chatEnabled && !inMatch && (
          <button
            type="button"
            className="nav-chat"
            onClick={() => window.dispatchEvent(new Event('mindrace:open-chat'))}
            aria-label={unread ? `Open chat, ${unread} new messages` : 'Open chat'}
          >
            💬
            {unread > 0 && <span className="nav-chat-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
        )}
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
          className="btn-ghost icon-btn nav-logout"
          title="Log out"
          aria-label="Log out"
          onClick={askLogout}
        >
          <PowerIcon />
        </button>
        {!inMatch && (
          <button
            type="button"
            className="nav-menu-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>

    {menuOpen && (
      <div className="nav-drawer-backdrop" onClick={() => setMenuOpen(false)}>
        <aside
          id="nav-drawer"
          className="nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="nav-drawer-head">
            <Link to={isAdmin ? '/admin/dashboard' : '/app/profile'} className="nav-drawer-user">
              <Avatar name={name} size={36} />
              <span>
                <strong>{name}</strong>
                <small>{isAdmin ? 'Admin' : 'View profile'}</small>
              </span>
            </Link>
            <button type="button" className="nav-drawer-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              ✕
            </button>
          </div>
          <nav className="nav-drawer-links" aria-label="All pages">
            {links.map(([to, label, icon]) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="nav-drawer-icon" aria-hidden="true">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="nav-drawer-logout" onClick={askLogout}>
            <PowerIcon /> Log out
          </button>
        </aside>
      </div>
    )}

    {!inMatch && (
      <nav className="bottom-nav" aria-label="Main">
        {tabs.map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
            <span className="bottom-nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    )}
    </>
  )
}
