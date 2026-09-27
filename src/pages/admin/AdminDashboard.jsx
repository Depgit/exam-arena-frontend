import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getAdminStats } from '../../api/endpoints'

const REFRESH_MS = 15_000

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getAdminStats()
        .then(({ data }) => !cancelled && (setStats(data), setError('')))
        .catch((err) => !cancelled && setError(err.message))
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="page">
      <h1>Admin overview</h1>
      <p className="muted">Signed in as {user.username} (admin) · live numbers refresh every 15 seconds</p>
      {error && <div className="alert-error">{error}</div>}

      {stats && (
        <div className="kpi-grid">
          <div className="kpi-card kpi-live">
            <span className="kpi-label"><span className="ws-dot online" /> Live now</span>
            <strong className="kpi-value">{stats.live_users}</strong>
            <span className="muted">connected right now</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Active users · 24h</span>
            <strong className="kpi-value">{stats.active_users_24h}</strong>
            <span className="muted">of {stats.users} registered</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Active users · 7 days</span>
            <strong className="kpi-value">{stats.active_users_7d}</strong>
            <span className="muted">used the app this week</span>
          </div>
          <Link to="/admin/flags" className={`kpi-card ${stats.open_flagged_questions > 0 ? 'kpi-alert' : ''}`}>
            <span className="kpi-label">Flagged questions</span>
            <strong className="kpi-value">{stats.open_flagged_questions}</strong>
            <span className="muted">awaiting review →</span>
          </Link>
        </div>
      )}

      <div className="card-grid">
        <Link to="/admin/questions/new" className="action-card">
          <h3>📝 Create Question</h3>
          <p>Add a new question and publish it to the live question bank.</p>
        </Link>
        <Link to="/admin/flags" className="action-card">
          <h3>⚑ Flagged Questions</h3>
          <p>Review questions players reported as faulty.</p>
        </Link>
        <Link to="/admin/stats" className="action-card">
          <h3>📊 System Stats</h3>
          <p>Users, questions, and match volume at a glance.</p>
        </Link>
      </div>
    </div>
  )
}
