import { useEffect, useState } from 'react'
import { getSubjects, getLeaderboard } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

export default function Leaderboard() {
  const [subjects, setSubjects] = useState([])
  const [categoryCode, setCategoryCode] = useState('')
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const { user } = useAuth()

  useEffect(() => {
    getSubjects().then(({ data }) => {
      setSubjects(data)
      if (data.length) setCategoryCode(data[0].code)
    })
  }, [])

  useEffect(() => {
    if (!categoryCode) return
    getLeaderboard(categoryCode, { limit: 50 })
      .then(({ data }) => setEntries(data ?? []))
      .catch((err) => setError(err.message))
  }, [categoryCode])

  return (
    <div className="page">
      <h1>Leaderboard</h1>
      {error && <div className="alert-error">{error}</div>}
      <div className="form-card inline-form">
        <label>
          Exam category
          <select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}>
            {subjects?.map((s) => (
              <option key={s.id} value={s.code}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Rating</th>
            <th>Matches</th>
          </tr>
        </thead>
        <tbody>
          {entries && entries.map((e) => (
            <tr key={e.user_id} className={e.user_id === user.id ? 'me' : ''}>
              <td>#{e.rank}</td>
              <td>{e.display_name || e.username}</td>
              <td>{e.rating}</td>
              <td>{e.matches_played}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
