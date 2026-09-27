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
  const navigate = useNavigate()

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
      <h1>Friend Match</h1>
      {error && <div className="alert-error">{error}</div>}

      <div className="two-col">
        <div className="form-card">
          <h3>Create a room</h3>
          <label>
            Exam category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {subjects && subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={handleCreate} disabled={!categoryId || !!roomCode}>
            Create room
          </button>
          {roomCode && (
            <div className="room-code-display">
              <span>Share this code with your friend:</span>
              <strong>{roomCode}</strong>
              <p className="muted">Waiting for them to join…</p>
              <div className="spinner" />
            </div>
          )}
        </div>

        <div className="form-card">
          <h3>Join a room</h3>
          <form onSubmit={handleJoin}>
            <label>
              Room code
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ABC123"
                maxLength={6}
                required
              />
            </label>
            <button className="btn-primary" type="submit">Join</button>
          </form>
        </div>
      </div>
    </div>
  )
}
