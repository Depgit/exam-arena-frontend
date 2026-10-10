import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { Avatar } from '../game/game'

const MAX = 300

function timeOf(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** The chat view: messages plus the input. Used in the Lobby and the sheet. */
export default function ChatPanel({ onClose }) {
  const { user, isGuest, needsVerification, logout } = useAuth()
  const { messages, send, viewOpened } = useChat()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const stickToBottom = useRef(true)

  useEffect(() => viewOpened(), [viewOpened])

  // Follow new messages only if the reader is already at the bottom.
  const onScroll = () => {
    const el = listRef.current
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  async function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    try {
      await send(body)
      setText('')
      stickToBottom.current = true
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="chat-panel" aria-label="Global chat">
      <header className="chat-head">
        <h3>💬 Global chat</h3>
        {onClose && (
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat">✕</button>
        )}
      </header>

      <ol className="chat-list" ref={listRef} onScroll={onScroll}>
        {messages.length === 0 && <li className="chat-empty muted">No messages yet — say hi 👋</li>}
        {messages.map((m) => {
          const name = m.display_name || m.username
          const mine = m.user_id === user?.id
          return (
            <li key={m.id} className={`chat-msg ${mine ? 'mine' : ''}`}>
              <Avatar name={name} size={28} />
              <div className="chat-bubble">
                <div className="chat-meta">
                  <Link to={`/app/profile/${m.user_id}`} className="chat-name" onClick={onClose}>{mine ? 'You' : name}</Link>
                  <time>{timeOf(m.created_at)}</time>
                </div>
                <p className="chat-body">{m.body}</p>
              </div>
            </li>
          )
        })}
      </ol>

      {isGuest ? (
        <div className="chat-guest">
          <span>Demo accounts can read but not chat.</span>
          <button type="button" className="btn-primary small" onClick={() => { logout(); navigate('/register') }}>Sign up to chat</button>
        </div>
      ) : needsVerification ? (
        <div className="chat-guest">
          <span>Verify your email to join the chat.</span>
          <button type="button" className="btn-primary small" onClick={() => navigate('/app/verify')}>Enter code</button>
        </div>
      ) : (
        <form className="chat-input" onSubmit={submit}>
          {error && <p className="chat-error" role="alert">{error}</p>}
          <div className="chat-input-row">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              placeholder="Message everyone…"
              aria-label="Chat message"
              maxLength={MAX}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" className="btn-primary small" disabled={busy || !text.trim()}>Send</button>
          </div>
          {text.length > MAX - 50 && <span className="chat-count muted">{MAX - text.length} left</span>}
        </form>
      )}
    </section>
  )
}
