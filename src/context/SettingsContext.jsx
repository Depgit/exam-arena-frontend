import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import * as sfx from '../lib/sfx'

/**
 * Player-facing preferences that are not account data.
 *
 * Just sound for now. It lives in a context rather than inside sfx.js so the
 * toggle button can re-render when it changes — the sfx module keeps the
 * persisted flag, this keeps React aware of it.
 */
const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [soundOn, setSoundOn] = useState(() => !sfx.isMuted())

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev
      sfx.setMuted(!next)
      // Switching sound on is the one case where playing a sound is the
      // confirmation — you hear that it worked.
      if (next) sfx.play('select')
      return next
    })
  }, [])

  const value = useMemo(() => ({ soundOn, toggleSound }), [soundOn, toggleSound])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
