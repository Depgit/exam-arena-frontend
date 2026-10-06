import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { loginUser, registerUser, getMe, clearCache } from '../api/endpoints'

const AuthContext = createContext(null)

const TOKEN_KEY = 'exam_arena_token'
const USER_KEY = 'exam_arena_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Validate the stored token on load by fetching the current profile.
    // If it's expired/invalid, clear local auth state.
    async function bootstrap() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const { data } = await getMe()
        setUser(data)
        localStorage.setItem(USER_KEY, JSON.stringify(data))
      } catch {
        logout()
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

  const register = useCallback(async (username, email, password) => {
    const { data } = await registerUser({ username, email, password })
    persist(data.token, data.user)
    return data.user
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
      login,
      register,
      logout,
    }),
    [token, user, loading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
