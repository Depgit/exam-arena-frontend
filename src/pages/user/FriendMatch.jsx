import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubjects, createFriendMatch, joinFriendMatch } from '../../api/endpoints'
import { useWSListener } from '../../context/WebSocketContext'

export default function FriendMatch() {
  const [subjects, setSubjects] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [waitingRoom, setWaitingRoom] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the code is still on screen to read out.
    }
  }

  useEffect(() => {
    getSubjects().then(({ data }) => {
      setSubjects(data)
      if (data && data.length) setCategoryId(data[0].id)
    })
  }, [])

  useWSListener('match_start', (payload) => {
    navigate(`/app/match/${payload.match_id}`, { state: payload })
  })

  useWSListener('match_failed', (payload) => {
    setError(payload.reason || 'Match could not start — please try again.')
    setRoomCode('')
    setWaitingRoom(null)
  })

  async function handleCreate() {
    setError('')
    try {
      const { data } = await createFriendMatch({ exam_category_id: categoryId })
      setRoomCode(data.room_code)
      setWaitingRoom(data.match_id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await joinFriendMatch({ room_code: joinCode.trim().toUpperCase() })
      // Match may already be in_progress by the time this resolves; the
      // match_start WS event (listened above) will also fire and redirect.
      if (data.match_id) navigate(`/app/match/${data.match_id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Private room</span>
        <h1>Friend Match</h1>
        <p className="muted">Create a room and share the code, or enter a friend's code to jump in.</p>
      </header>
      {error && <div className="alert-error">{error}</div>}

      <div className="two-col">
        <div className="form-card room-card">
          <div className="room-card-icon" aria-hidden="true">🏟️</div>
          <h3>Host a room</h3>
          {!roomCode ? (
            <>
              <div className="tile-picker compact">
                {subjects && subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`tile-option ${categoryId === s.id ? 'selected' : ''}`}
                    aria-pressed={categoryId === s.id}
                    onClick={() => setCategoryId(s.id)}
                  >
                    <strong>{s.name}</strong>
                  </button>
                ))}
              </div>
              <button className="btn-primary btn-lg" onClick={handleCreate} disabled={!categoryId}>
                Create room
              </button>
            </>
          ) : (
            <div className="room-code-display">
              <span>Share this code with your friend</span>
              <button type="button" className="room-code" onClick={copyCode} title="Copy code">
                {roomCode.split('').map((ch, i) => <span key={i}>{ch}</span>)}
              </button>
              <span className="muted">{copied ? '✓ Copied!' : 'Tap the code to copy'}</span>
              <div className="waiting-line">
                <div className="spinner" />
                Waiting for your friend to join…
              </div>
            </div>
          )}
        </div>

        <div className="form-card room-card">
          <div className="room-card-icon" aria-hidden="true">🔑</div>
          <h3>Join a room</h3>
          <form onSubmit={handleJoin}>
            <input
              className="code-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              aria-label="Room code"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <button className="btn-primary btn-lg" type="submit" disabled={joinCode.trim().length < 6}>
              Join match
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
