import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getChat, sendChat } from '../api/endpoints'
import { useAuth } from './AuthContext'
import { useWebSocket, useWSListener } from './WebSocketContext'

/**
 * The global chat, shared by every place it's shown (the Lobby panel on
 * desktop, the slide-up sheet elsewhere).
 *
 * History comes from GET /chat; new messages arrive live as "chat_message"
 * WebSocket events. After a reconnect the history is fetched again, so
 * messages sent while offline aren't missed. Unread counts only messages
 * that arrived while no chat view was open.
 */
const ChatContext = createContext(null)
const KEEP = 100

export function ChatProvider({ children }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const { connected } = useWebSocket()
  const enabled = isAuthenticated && !isAdmin
  const [messages, setMessages] = useState([])
  const [unread, setUnread] = useState(0)
  const openViews = useRef(0)

  const merge = useCallback((incoming) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      incoming.forEach((m) => byId.set(m.id, m))
      return [...byId.values()].sort((a, b) => a.id - b.id).slice(-KEEP)
    })
  }, [])

  // Load (or reload after a reconnect) the recent history.
  useEffect(() => {
    if (!enabled || !connected) return
    getChat()
      .then(({ data }) => merge(data ?? []))
      .catch(() => {})
  }, [enabled, connected, merge])

  useEffect(() => {
    if (!enabled) {
      setMessages([])
      setUnread(0)
    }
  }, [enabled])

  useWSListener('chat_message', (m) => {
    if (!enabled || !m?.id) return
    merge([m])
    if (openViews.current === 0) setUnread((n) => n + 1)
  })

  const send = useCallback(
    async (body) => {
      const { data } = await sendChat(body)
      if (data) merge([data]) // in case our own broadcast arrives late
    },
    [merge]
  )

  // A chat view calls this while it is visible; it clears the unread count.
  const viewOpened = useCallback(() => {
    openViews.current += 1
    setUnread(0)
    return () => {
      openViews.current -= 1
    }
  }, [])

  const value = useMemo(() => ({ enabled, messages, unread, send, viewOpened }), [enabled, messages, unread, send, viewOpened])
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
