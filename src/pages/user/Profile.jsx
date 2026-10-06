import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getUserProfile,
  getUserStats,
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
} from '../../api/endpoints'

// Where the viewer stands with this player, from GET /friends.
function relationTo(list, userId) {
  if (list.friends?.some((f) => f.user_id === userId)) return { kind: 'friends' }
  const incoming = list.incoming?.find((f) => f.user_id === userId)
  if (incoming) return { kind: 'incoming', friendshipId: incoming.friendship_id }
  if (list.outgoing?.some((f) => f.user_id === userId)) return { kind: 'outgoing' }
  return { kind: 'none' }
}

function FriendButton({ userId, username }) {
  const [relation, setRelation] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = () =>
    getFriends()
      .then(({ data }) => setRelation(relationTo(data ?? {}, userId)))
      .catch(() => setRelation({ kind: 'none' }))

  useEffect(() => {
    setRelation(null)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function act(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!relation) return null
  return (
    <div className="profile-actions">
      {relation.kind === 'none' && (
        <button className="btn-primary" disabled={busy} onClick={() => act(() => sendFriendRequest(username))}>
          ＋ Add friend
        </button>
      )}
      {relation.kind === 'outgoing' && (
        <button className="btn-ghost" disabled>⏳ Request sent</button>
      )}
      {relation.kind === 'incoming' && (
        <button className="btn-primary" disabled={busy} onClick={() => act(() => acceptFriendRequest(relation.friendshipId))}>
          ✓ Accept friend request
        </button>
      )}
      {relation.kind === 'friends' && (
        <>
          <span className="friend-chip">✓ Friends</span>
          <button
            className="btn-ghost small"
            disabled={busy}
            onClick={() => window.confirm(`Remove ${username} from your friends?`) && act(() => removeFriend(userId))}
          >
            Remove
          </button>
        </>
      )}
      {error && <span className="profile-action-error">{error}</span>}
    </div>
  )
}
import { Avatar, RankBadge, tierFor } from '../../components/game/game'

export default function Profile() {
  const { user } = useAuth()
  const { userId } = useParams()
  const profileId = userId || user.id
  const isMe = profileId === user.id
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    setProfile(null)
    setError('')
    Promise.all([getUserProfile(profileId), getUserStats(profileId)])
      .then(([p, s]) => {
        setProfile({ ...p.data, ratings: p.data.ratings ?? [] })
        setStats(s.data ?? [])
      })
      .catch((err) => setError(err.message))
  }, [profileId])

  if (error) return <div className="page"><div className="alert-error">{error}</div></div>
  if (!profile) {
    return (
      <div className="page-center">
        <div className="spinner" />
      </div>
    )
  }

  const name = profile.user.display_name || profile.user.username
  const best = profile.ratings.reduce((a, r) => (a == null || r.rating > a.rating ? r : a), null)
  const totals = stats.reduce(
    (t, s) => ({
      matches: t.matches + s.total_matches,
      wins: t.wins + s.wins,
      solved: t.solved + s.total_questions_solved,
      streak: Math.max(t.streak, s.longest_win_streak),
    }),
    { matches: 0, wins: 0, solved: 0, streak: 0 }
  )

  return (
    <div className="page">
      <section className="lobby-hero profile-hero">
        <div className="lobby-player">
          <Avatar name={name} size={84} ring={best ? tierFor(best.rating).key : 'silver'} />
          <div className="lobby-player-info">
            <span className="eyebrow">@{profile.user.username}</span>
            <h1>{name}</h1>
            <div className="lobby-player-meta">
              {best ? <RankBadge rating={best.rating} size="lg" /> : <span className="muted">Unranked</span>}
            </div>
          </div>
        </div>
        {!isMe && profile.user.role !== 'admin' && (
          <FriendButton userId={profileId} username={profile.user.username} />
        )}
      </section>

      <div className="kpi-strip">
        <div className="kpi-tile"><span>Matches</span><strong>{totals.matches}</strong></div>
        <div className="kpi-tile"><span>Wins</span><strong>{totals.wins}</strong></div>
        <div className="kpi-tile"><span>Best streak</span><strong>{totals.streak}</strong></div>
        <div className="kpi-tile"><span>Questions solved</span><strong>{totals.solved}</strong></div>
      </div>

      <h2>Ranks by category</h2>
      <div className="stats-grid">
        {profile.ratings.map((r) => (
          <div key={r.exam_category_id} className={`stat-card tier-card tier-${tierFor(r.rating).key}`}>
            <div className="stat-card-head">
              <h3>{r.exam_category_name || 'Unknown category'}</h3>
              {r.exam_category_code && <span className="category-badge">{r.exam_category_code}</span>}
            </div>
            <RankBadge rating={r.rating} size="lg" />
            <div className="stat-row"><span>Matches played</span><strong>{r.matches_played}</strong></div>
          </div>
        ))}
        {profile.ratings.length === 0 && <p className="muted">No ratings yet — play a ranked match.</p>}
      </div>

      <h2>Career statistics</h2>
      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.exam_category_id} className="stat-card">
            <div className="stat-card-head">
              <h3>{s.exam_category_name || 'Unknown category'}</h3>
              {s.exam_category_code && <span className="category-badge">{s.exam_category_code}</span>}
            </div>
            <div className="stat-row"><span>Total matches</span><strong>{s.total_matches}</strong></div>
            <div className="stat-row"><span>W / L / D</span><strong>{s.wins} / {s.losses} / {s.draws}</strong></div>
            <div className="stat-row"><span>Accuracy</span><strong>{s.overall_accuracy.toFixed(1)}%</strong></div>
            <div className="accuracy-bar"><span style={{ width: `${Math.min(100, s.overall_accuracy)}%` }} /></div>
            <div className="stat-row"><span>Longest win streak</span><strong>{s.longest_win_streak}</strong></div>
            <div className="stat-row"><span>Questions solved</span><strong>{s.total_questions_solved}</strong></div>
          </div>
        ))}
        {stats.length === 0 && <p className="muted">No matches played yet.</p>}
      </div>
    </div>
  )
}
