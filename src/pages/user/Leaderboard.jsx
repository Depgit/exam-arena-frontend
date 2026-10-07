import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubjects, getLeaderboard } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import { Avatar, RankBadge } from '../../components/game/game'

const PODIUM_ORDER = [1, 0, 2] // silver · gold · bronze, gold in the middle

export default function Leaderboard() {
  const knownSubjects = getSubjects.peek()?.data ?? []
  const [subjects, setSubjects] = useState(knownSubjects)
  const [categoryCode, setCategoryCode] = useState(knownSubjects[0]?.code ?? '')
  // Last-seen standings while the live ones load (they're always refetched).
  const [entries, setEntries] = useState(() =>
    knownSubjects[0] ? getLeaderboard.peek(knownSubjects[0].code, { limit: 50 })?.data ?? [] : []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()
  const openProfile = (id) => navigate(`/app/profile/${id}`)

  useEffect(() => {
    getSubjects().then(({ data }) => {
      setSubjects(data)
      if (data.length) setCategoryCode((current) => current || data[0].code)
    })
  }, [])

  useEffect(() => {
    if (!categoryCode) return
    const known = getLeaderboard.peek(categoryCode, { limit: 50 })?.data
    if (known) setEntries(known)
    setLoading(true)
    getLeaderboard(categoryCode, { limit: 50 })
      .then(({ data }) => setEntries(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [categoryCode])

  const top = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Season standings</span>
        <h1>Leaderboard</h1>
      </header>
      {error && <div className="alert-error">{error}</div>}

      <div className="tab-strip" role="tablist">
        {subjects?.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={categoryCode === s.code}
            className={`tab ${categoryCode === s.code ? 'active' : ''}`}
            onClick={() => setCategoryCode(s.code)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {top.length > 0 && (
        <div className={`podium ${loading ? 'is-loading' : ''}`}>
          {PODIUM_ORDER.filter((i) => top[i]).map((i) => {
            const e = top[i]
            const name = e.display_name || e.username
            return (
              <button
                type="button"
                key={e.user_id}
                className={`podium-spot podium-${i + 1} ${e.user_id === user.id ? 'me' : ''}`}
                onClick={() => openProfile(e.user_id)}
                title={`View ${name}'s profile`}
              >
                <span className="podium-medal" aria-hidden="true">{['🥇', '🥈', '🥉'][i]}</span>
                <Avatar name={name} size={i === 0 ? 76 : 60} />
                <strong className="podium-name">{name}</strong>
                <RankBadge rating={e.rating} size="sm" />
                <div className="podium-block">#{e.rank}</div>
              </button>
            )
          })}
        </div>
      )}

      {entries.length === 0 && !loading && (
        <div className="empty-state">
          <span aria-hidden="true">🏆</span>
          <p>No ranked players in this category yet. Be the first.</p>
        </div>
      )}

      {rest.length > 0 && (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Tier</th>
              <th>Rating</th>
              <th>Matches</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((e) => {
              const name = e.display_name || e.username
              return (
                <tr
                  key={e.user_id}
                  className={`clickable ${e.user_id === user.id ? 'me' : ''}`}
                  onClick={() => openProfile(e.user_id)}
                  title={`View ${name}'s profile`}
                >
                  <td>#{e.rank}</td>
                  <td>
                    <span className="lb-player">
                      <Avatar name={name} size={28} />
                      <span className="lb-player-name">{name}</span>
                    </span>
                  </td>
                  <td><RankBadge rating={e.rating} size="sm" showRating={false} /></td>
                  <td className="num">{e.rating}</td>
                  <td className="num">{e.matches_played}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
