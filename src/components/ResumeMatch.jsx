import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentMatch } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'

// When the app opens, a player who is still in a running match (they closed
// the tab or refreshed mid-game) is sent straight back into it. Runs once
// per app load, so leaving a match on purpose inside the app is not undone.
export default function ResumeMatch() {
  const { isAdmin, isGuest } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAdmin || isGuest) return
    let cancelled = false
    getCurrentMatch()
      .then(({ data }) => {
        const path = data?.match_id && `/app/match/${data.match_id}`
        if (!cancelled && path && window.location.pathname !== path) navigate(path, { replace: true })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
