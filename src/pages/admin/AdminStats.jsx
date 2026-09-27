import { useEffect, useState } from 'react'
import { getAdminStats } from '../../api/endpoints'

export default function AdminStats() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminStats()
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="page">
      <h1>System Statistics</h1>
      {error && <div className="alert-error">{error}</div>}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-row"><span>Users</span><strong>{stats.users}</strong></div>
          </div>
          <div className="stat-card">
            <div className="stat-row"><span>Live now</span><strong>{stats.live_users}</strong></div>
          </div>
          <div className="stat-card">
            <div className="stat-row"><span>Active users (24h)</span><strong>{stats.active_users_24h}</strong></div>
          </div>
          <div className="stat-card">
            <div className="stat-row"><span>Questions</span><strong>{stats.questions}</strong></div>
          </div>
          <div className="stat-card">
            <div className="stat-row"><span>Active matches</span><strong>{stats.active_matches}</strong></div>
          </div>
          <div className="stat-card">
            <div className="stat-row"><span>Total matches</span><strong>{stats.total_matches}</strong></div>
          </div>
        </div>
      )}
    </div>
  )
}
