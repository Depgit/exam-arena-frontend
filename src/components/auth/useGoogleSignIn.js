import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Google sign-in for the login and register pages. A returning player is
 * signed straight in; a new one gets `pending` (pick a username first).
 */
export function useGoogleSignIn(setError) {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(null) // { credential, suggested, email, name }

  const done = (user) =>
    navigate(user.role === 'admin' ? '/admin/dashboard' : user.needs_email_verification ? '/app/verify' : '/app/dashboard')

  async function onCredential(credential) {
    setError('')
    try {
      const res = await loginWithGoogle(credential)
      if (res.needsUsername) setPending({ credential, ...res })
      else done(res.user)
    } catch (err) {
      setError(err.message)
    }
  }

  // Throws on failure so the username form can show the error.
  async function finish(username) {
    const res = await loginWithGoogle(pending.credential, username)
    if (res.needsUsername) throw new Error('Please pick a username')
    done(res.user)
  }

  return { pending, onCredential, finish, cancel: () => setPending(null) }
}
