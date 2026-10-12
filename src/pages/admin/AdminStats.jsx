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

  const demo = stats?.demo_users ?? 0
  const ghosts = stats?.ghost_users ?? 0
  const total = (stats?.users ?? 0) + ghosts + demo
  const pct = (n) => (total ? (n / total) * 100 : 0)

  return (
    <div className="page">
      <h1>System Statistics</h1>
      {error && <div className="alert-error">{error}</div>}
      {stats && (
        <div className="stats-grid admin-stats-grid">
          <div className="stat-card users-card">
            <div className="stat-card-head">
              <h3>Users</h3>
              <span className="users-total">{total}</span>
            </div>
            <div className="users-split" aria-hidden="true">
              <span className="users-split-real" style={{ width: `${pct(stats.users)}%` }} />
              <span className="users-split-ghost" style={{ width: `${pct(ghosts)}%` }} />
            </div>
            <div className="stat-row">
              <span><i className="users-dot real" /> Real players</span>
              <strong>{stats.users}</strong>
            </div>
            <div className="stat-row">
              <span><i className="users-dot ghost" /> Ghost players</span>
              <strong>{ghosts}</strong>
            </div>
            <div className="stat-row">
              <span><i className="users-dot demo" /> Demo accounts</span>
              <strong>{demo}</strong>
            </div>
            <p className="muted users-note">Ghost players are bots shown to players as people. "Play vs Bot" bots and admins aren't counted. Demo accounts are removed after 3 days.</p>
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
