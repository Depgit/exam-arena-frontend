import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getMyStreak } from '../api/endpoints'
import { useAuth } from './AuthContext'
import { useWSListener } from './WebSocketContext'

const StreakContext = createContext({ streak: null, refresh: () => {} })

// The player's daily play streak, shared by the navbar flame and the Lobby
// card. Refreshed when a match ends or the server says it grew.
export function StreakProvider({ children }) {
  const { isAuthenticated, isAdmin, isGuest } = useAuth()
  const enabled = isAuthenticated && !isAdmin && !isGuest
  const [streak, setStreak] = useState(null)

  const refresh = useCallback(() => {
    if (!enabled) return
    getMyStreak().then(({ data }) => setStreak(data)).catch(() => {})
  }, [enabled])

  useEffect(() => {
    if (enabled) refresh()
    else setStreak(null)
  }, [enabled, refresh])

  // A new day may have started while the tab was open: re-check on return.
  useEffect(() => {
    if (!enabled) return
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled, refresh])

  useWSListener('streak_extended', refresh)

  const value = useMemo(() => ({ streak, refresh }), [streak, refresh])
  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>
}

export const useStreak = () => useContext(StreakContext)
