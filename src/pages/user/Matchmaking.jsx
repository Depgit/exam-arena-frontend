import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubjects, joinQueue, leaveQueue, getQueueStats } from '../../api/endpoints'
import { useWSListener } from '../../context/WebSocketContext'

export default function Matchmaking() {
  const [subjects, setSubjects] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [matchType, setMatchType] = useState('ranked')
  const [queued, setQueued] = useState(false)
  const [queueStats, setQueueStats] = useState({})
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getSubjects().then(({ data }) => {
      setSubjects(data)
      if (data.length) setCategoryId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!queued) return
    let count = 0;
    const interval = setInterval(() => {
      getQueueStats().then(({ data }) => setQueueStats(data.pools)).catch(() => { })
      count++;
      if (count > 5) {
        clearInterval(interval);
        handleLeave();
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [queued])

  useWSListener('match_start', (payload) => {
    setQueued(false)
    navigate(`/app/match/${payload.match_id}`, { state: payload })
  })

  useWSListener('match_failed', (payload) => {
    setQueued(false)
    setError(payload.reason || 'Match could not be started')
  })

  async function handleJoin() {
    setError('')
    try {
      await joinQueue({ exam_category_id: categoryId, match_type: matchType })
      setQueued(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleLeave() {
    try {
      await leaveQueue()
    } finally {
      setQueued(false)
    }
  }

  return (
    <div className="page">
      <h1>Matchmaking</h1>
      {error && <div className="alert-error">{error}</div>}

      {!queued ? (
        <div className="form-card">
          <label>
            Exam category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Match type
            <select value={matchType} onChange={(e) => setMatchType(e.target.value)}>
              <option value="ranked">Ranked</option>
              <option value="arena">Arena</option>
            </select>
          </label>
          <p className="muted">
            {matchType === 'arena'
              ? 'Arena is open to everyone: you are paired with the next waiting player, whatever their rating.'
              : 'Ranked pairs you with a player close to your rating.'}
          </p>
          <button className="btn-primary" onClick={handleJoin} disabled={!categoryId}>
            Join queue
          </button>
        </div>
      ) : (
        <div className="form-card queue-waiting">
          <div className="spinner" />
          <p>Waiting for an opponent… you'll be moved into the match automatically.</p>
          <button className="btn-ghost" onClick={handleLeave}>Leave queue</button>
          <h3>Live queue depth</h3>
          <ul className="queue-stats">
            {Object.entries(queueStats).map(([pool, count]) => (
              <li key={pool}>{pool}: {count}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
