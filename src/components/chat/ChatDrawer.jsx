import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import ChatPanel from './ChatPanel'

/**
 * Floating chat button + slide-up sheet. Shown everywhere except during a
 * live match, and on the desktop Lobby, which has the chat in its sidebar.
 */
export default function ChatDrawer() {
  const { enabled, unread } = useChat()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname]) // close when navigating
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!enabled || pathname.startsWith('/app/match/')) return null
  const onLobby = pathname === '/app/dashboard'

  return (
    <>
      <button
        type="button"
        className={`chat-fab ${onLobby ? 'on-lobby' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={unread ? `Open chat, ${unread} new messages` : 'Open chat'}
      >
        <span aria-hidden="true">💬</span>
        {unread > 0 && <span className="chat-fab-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="chat-sheet-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div className="chat-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Global chat">
            <ChatPanel onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
