import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { loginUser, loginGuest, loginGoogle, registerUser, getMe, clearCache } from '../api/endpoints'

const AuthContext = createContext(null)

const TOKEN_KEY = 'exam_arena_token'
const USER_KEY = 'exam_arena_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })
  // With a saved session we can render straight away and confirm it in the
  // background; only a first visit with a token but no saved user must wait.
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY) && !localStorage.getItem(USER_KEY))

  useEffect(() => {
    async function bootstrap() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const { data } = await getMe()
        setUser(data)
        localStorage.setItem(USER_KEY, JSON.stringify(data))
      } catch (err) {
        // Only a definite rejection ends the session. A sleeping/waking
        // server, a timeout or a network blip must not log the player out.
        if (err?.status === 401 || err?.status === 403) logout()
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = (newToken, newUser) => {
    clearCache() // never show the previous account's cached data
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const login = useCallback(async (loginId, password) => {
    const { data } = await loginUser({ login: loginId, password })
    persist(data.token, data.user)
    return data.user
  }, [])

  const loginAsGuest = useCallback(async () => {
    const { data } = await loginGuest()
    persist(data.token, data.user)
    return data.user
  }, [])

  const register = useCallback(async (username, email, password) => {
    const { data } = await registerUser({ username, email, password })
    persist(data.token, data.user)
    return data.user
  }, [])

  // Returns { user } once signed in, or { needsUsername, suggested, email,
  // name } for a first-time Google player (call again with a username).
  const loginWithGoogle = useCallback(async (credential, username) => {
    const { data } = await loginGoogle({ credential, ...(username ? { username } : {}) })
    if (data.needs_username) {
      return { needsUsername: true, suggested: data.suggested_username, email: data.email, name: data.name }
    }
    persist(data.token, data.user)
    return { user: data.user }
  }, [])

  // Replace the signed-in user's details (e.g. after verifying their email).
  const updateUser = useCallback((newUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    clearCache()
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // Memoised so every useAuth() consumer doesn't re-render whenever the
  // provider's parent does — only when auth state actually changes.
  const value = useMemo(
    () => ({
      token,
      user,
      isAdmin: user?.role === 'admin',
      isAuthenticated: !!token && !!user,
      loading,
      isGuest: !!user?.is_guest,
      // Must verify their email before playing or chatting.
      needsVerification: !!user?.needs_email_verification,
      login,
      loginAsGuest,
      loginWithGoogle,
      register,
      updateUser,
      logout,
    }),
    [token, user, loading, login, loginAsGuest, loginWithGoogle, register, updateUser, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
