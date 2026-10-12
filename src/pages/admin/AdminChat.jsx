import { useEffect, useState } from 'react'
import { getChat, deleteChatMessage } from '../../api/endpoints'
import { useWSListener } from '../../context/WebSocketContext'

function when(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Chat moderation: the latest global chat messages, newest first, each with Delete. */
export default function AdminChat() {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    getChat()
      .then(({ data }) => setMessages(data ?? []))
      .catch((err) => setError(err.message))
  }, [])

  // Stay live: new messages appear, deleted ones (by any admin) disappear.
  useWSListener('chat_message', (m) => {
    if (m?.id) setMessages((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev))
  })
  useWSListener('chat_deleted', ({ id }) => {
    setMessages((prev) => prev && prev.filter((m) => m.id !== id))
  })

  async function remove(m) {
    const name = m.display_name || m.username
    if (!window.confirm(`Delete this message from ${name}?\n\n"${m.body}"`)) return
    setBusy(m.id)
    setError('')
    setNotice('')
    try {
      await deleteChatMessage(m.id)
      setMessages((prev) => prev.filter((x) => x.id !== m.id))
      setNotice(`Deleted ${name}'s message. It's gone from everyone's chat.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const newestFirst = messages ? [...messages].sort((a, b) => b.id - a.id) : []

  return (
    <div className="page">
      <header className="page-head">
        <h1>Chat moderation</h1>
        <p className="muted">The latest global chat messages, newest first. Deleting removes a message for everyone, right away.</p>
      </header>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}
      {messages === null && !error && <p className="muted">Loading…</p>}
      {messages && messages.length === 0 && <p className="muted">No messages.</p>}
      <ul className="admin-chat-list">
        {newestFirst.map((m) => (
          <li key={m.id} className="admin-chat-item">
            <div className="admin-chat-text">
              <div className="admin-chat-meta">
                <strong>{m.display_name || m.username}</strong>
                {m.display_name && <span className="muted"> @{m.username}</span>}
                <span className="muted"> · {when(m.created_at)}</span>
              </div>
              <p>{m.body}</p>
            </div>
            <button type="button" className="btn-danger small" onClick={() => remove(m)} disabled={busy === m.id}>
              {busy === m.id ? 'Deleting…' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
