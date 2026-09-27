import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getUserProfile, getUserStats } from '../../api/endpoints'

function CategoryHead({ name, code }) {
  return (
    <div className="stat-card-head">
      <h3>{name || 'Unknown category'}</h3>
      {code && <span className="category-badge">{code}</span>}
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getUserProfile(user.id), getUserStats(user.id)])
      .then(([p, s]) => {
        setProfile({ ...p.data, ratings: p.data.ratings ?? [] })
        setStats(s.data ?? [])
      })
      .catch((err) => setError(err.message))
  }, [user.id])

  if (error) return <div className="page"><div className="alert-error">{error}</div></div>
  if (!profile) return <div className="page-center">Loading…</div>

  return (
    <div className="page">
      <h1>{profile.user.display_name || profile.user.username}</h1>
      <p className="muted">@{profile.user.username} · {profile.user.role}</p>

      <h2>Ratings</h2>
      <div className="stats-grid">
        {profile && profile.ratings?.map((r) => (
          <div key={r.exam_category_id} className="stat-card">
            <CategoryHead name={r.exam_category_name} code={r.exam_category_code} />
            <div className="stat-row"><span>Rating</span><strong>{r.rating}</strong></div>
            <div className="stat-row"><span>Matches played</span><strong>{r.matches_played}</strong></div>
          </div>
        ))}
        {profile.ratings.length === 0 && <p className="muted">No ratings yet.</p>}
      </div>

      <h2>Career statistics</h2>
      <div className="stats-grid">
        {stats && stats.map((s) => (
          <div key={s.exam_category_id} className="stat-card">
            <CategoryHead name={s.exam_category_name} code={s.exam_category_code} />
            <div className="stat-row"><span>Total matches</span><strong>{s.total_matches}</strong></div>
            <div className="stat-row"><span>W / L / D</span><strong>{s.wins} / {s.losses} / {s.draws}</strong></div>
            <div className="stat-row"><span>Accuracy</span><strong>{s.overall_accuracy.toFixed(1)}%</strong></div>
            <div className="stat-row"><span>Longest win streak</span><strong>{s.longest_win_streak}</strong></div>
            <div className="stat-row"><span>Questions solved</span><strong>{s.total_questions_solved}</strong></div>
          </div>
        ))}
        {stats && stats.length === 0 && <p className="muted">No matches played yet.</p>}
      </div>
    </div>
  )
}
