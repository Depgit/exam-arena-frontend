import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { WS_BASE_URL } from '../api/client'

// Exam Arena enforces a single WebSocket session per user, and nearly every
// real-time feature (matchmaking, live matches, friend matches) depends on
// it. This provider owns exactly one socket for the whole app and exposes a
// simple pub/sub so any page can subscribe to specific message `type`s
// (match_start, score_update, time_update, match_end, match_failed, error)
// without stepping on each other or opening duplicate connections.
const WebSocketContext = createContext(null)

export function WebSocketProvider({ children }) {
  const { token, isAuthenticated } = useAuth()
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const listenersRef = useRef(new Map()) // type -> Set(callback)
  const reconnectTimer = useRef(null)

  const dispatch = useCallback((msg) => {
    const set = listenersRef.current.get(msg.type)
    if (set) set.forEach((cb) => cb(msg.payload ?? {}))
    const wildcard = listenersRef.current.get('*')
    if (wildcard) wildcard.forEach((cb) => cb(msg))
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !token) {
      socketRef.current?.close()
      return
    }

    let cancelled = false

    function connect() {
      const ws = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`)
      socketRef.current = ws

      ws.onopen = () => !cancelled && setConnected(true)
      ws.onclose = () => {
        if (cancelled) return
        setConnected(false)
        // simple auto-reconnect after a short delay
        reconnectTimer.current = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          dispatch(msg)
        } catch {
          // ignore malformed frames
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      clearTimeout(reconnectTimer.current)
      socketRef.current?.close()
    }
  }, [isAuthenticated, token, dispatch])

  const send = useCallback((type, payload = {}) => {
    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }))
      return true
    }
    return false
  }, [])

  const subscribe = useCallback((type, callback) => {
    if (!listenersRef.current.has(type)) listenersRef.current.set(type, new Set())
    listenersRef.current.get(type).add(callback)
    return () => listenersRef.current.get(type)?.delete(callback)
  }, [])

  return (
    <WebSocketContext.Provider value={{ connected, send, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider')
  return ctx
}

// Convenience hook: subscribe to one message type for the lifetime of a component.
export function useWSListener(type, callback) {
  const { subscribe } = useWebSocket()
  useEffect(() => {
    const unsubscribe = subscribe(type, callback)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, subscribe])
}
