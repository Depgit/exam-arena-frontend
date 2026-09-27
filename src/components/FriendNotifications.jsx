import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { joinFriendMatch, closeChallenge } from '../api/endpoints'
import { useWSListener } from '../context/WebSocketContext'

// App-wide pop-ups for friend events, so a challenge or request reaches the
// user on whatever page they are on. Challenges stay until answered;
// request notices dismiss themselves.
export default function FriendNotifications() {
  const [challenges, setChallenges] = useState([]) // friend_challenge payloads
  const [notices, setNotices] = useState([]) // { id, text }
  const [error, setError] = useState('')
  const navigate = useNavigate()
  // Set while a challenge we accepted is starting, so a match_failed can be
  // shown here (other pages show their own match_failed errors).
  const joiningRef = useRef(false)

  function pushNotice(text) {
    const id = `${Date.now()}-${Math.random()}`
    setNotices((n) => [...n, { id, text }])
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 6000)
  }

  const dropChallenge = (matchId) => setChallenges((c) => c.filter((x) => x.match_id !== matchId))

  useWSListener('friend_challenge', (payload) => {
    setChallenges((c) => [...c.filter((x) => x.match_id !== payload.match_id), payload])
  })

  useWSListener('friend_challenge_cancelled', (payload) => {
    dropChallenge(payload.match_id)
    pushNotice(`${payload.by_username} cancelled their challenge.`)
  })

  useWSListener('friend_request', (payload) => {
    pushNotice(`${payload.from_username} sent you a friend request.`)
  })

  useWSListener('friend_request_accepted', (payload) => {
    pushNotice(`${payload.username} is now your friend.`)
  })

  // Take both players into a friend match wherever they are — the challenger
  // may have left the Friends page while waiting. Pages that already
  // navigated on match_start are skipped by the path check.
  const goToMatch = (matchId, state) => {
    const path = `/app/match/${matchId}`
    if (window.location.pathname !== path) navigate(path, state ? { state } : undefined)
  }

  useWSListener('match_start', (payload) => {
    joiningRef.current = false
    goToMatch(payload.match_id, payload)
  })

  useWSListener('match_failed', (payload) => {
    if (!joiningRef.current) return
    joiningRef.current = false
    setError(payload.reason || 'The match could not start.')
  })

  async function handleAccept(ch) {
    setError('')
    dropChallenge(ch.match_id)
    joiningRef.current = true
    try {
      const { data } = await joinFriendMatch({ room_code: ch.room_code })
      // Fallback if match_start is slow; LiveMatch hydrates over REST.
      goToMatch(data.match_id)
    } catch (err) {
      joiningRef.current = false
      setError(err.message)
    }
  }

  async function handleDecline(ch) {
    dropChallenge(ch.match_id)
    try {
      await closeChallenge(ch.match_id)
    } catch {
      // Already cancelled or expired.
    }
  }

  if (!challenges.length && !notices.length && !error) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {error && (
        <div className="toast toast-error">
          <span>{error}</span>
          <button className="btn-ghost small" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {challenges && challenges.map((ch) => (
        <div key={ch.match_id} className="toast toast-challenge">
          <div className="toast-body">
            <strong>{ch.from_username}</strong> challenged you
            <span className="muted"> · {ch.exam_category_name}</span>
          </div>
          <div className="toast-actions">
            <button className="btn-primary small" onClick={() => handleAccept(ch)}>Accept</button>
            <button className="btn-ghost small" onClick={() => handleDecline(ch)}>Decline</button>
          </div>
        </div>
      ))}
      {notices && notices.map((n) => (
        <div key={n.id} className="toast">
          <span>{n.text}</span>
        </div>
      ))}
    </div>
  )
}
