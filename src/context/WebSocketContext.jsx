import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { WS_BASE_URL } from '../api/client'
import { invalidateForEvent } from '../api/endpoints'

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
    // Drop cached reads this event makes stale BEFORE any listener runs,
    // so a page refetching in response gets fresh data.
    invalidateForEvent(msg.type)
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
      const ws = new WebSocket(`${WS_BASE_URL}/wss?token=${encodeURIComponent(token)}`)
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
        // The server drains its send queue into a SINGLE text frame with the
        // individual messages newline-separated (see WritePump in
        // internal/ws/client.go). Parsing event.data as one JSON document
        // throws the moment that happens — which is exactly when traffic
        // spikes, e.g. a score_update and a time_update landing together —
        // and would silently discard every message in the batch. Split first,
        // then parse each line on its own so one bad line cannot take its
        // siblings down with it.
        for (const line of String(event.data).split('\n')) {
          if (!line.trim()) continue
          let msg
          try {
            msg = JSON.parse(line)
          } catch {
            // Loud on purpose: a dropped frame means the UI is now out of
            // step with the server, and that is worth seeing in the console.
            console.warn('[ws] dropped unparseable frame:', line)
            continue
          }
          dispatch(msg)
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

  const value = useMemo(() => ({ connected, send, subscribe }), [connected, send, subscribe])

  return (
    <WebSocketContext.Provider value={value}>
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
//
// The callback is held in a ref rather than listed as an effect dependency.
// Subscribing on every render would churn the listener set, but closing over
// the first render's callback forever means a subscriber reads stale state —
// which breaks anything that compares a previous value to the incoming one
// (score deltas, streaks, answer feedback). The ref gives us one stable
// subscription that always calls the latest closure.
export function useWSListener(type, callback) {
  const { subscribe } = useWebSocket()
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => subscribe(type, (payload) => callbackRef.current?.(payload)), [type, subscribe])
}
