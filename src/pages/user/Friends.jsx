import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getFriends,
  getSubjects,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  challengeFriend,
  closeChallenge,
  searchPlayers,
} from '../../api/endpoints'
import { useWSListener } from '../../context/WebSocketContext'
import { Avatar } from '../../components/game/game'

const SEARCH_DELAY_MS = 250

const nameOf = (f) => f.display_name || f.username

export default function Friends() {
  const [list, setList] = useState({ friends: [], incoming: [], outgoing: [] })
  const [subjects, setSubjects] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [username, setUsername] = useState('')
  const [matches, setMatches] = useState([])
  const [searching, setSearching] = useState(false)
  const searchSeq = useRef(0)
  const [challenge, setChallenge] = useState(null) // { match_id, room_code, friend }
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // useWSListener registers its callback once, so read the open challenge
  // through a ref rather than the render-time closure.
  const challengeRef = useRef(null)
  challengeRef.current = challenge

  const refresh = useCallback(() => {
    getFriends()
      .then(({ data }) => setList(data))
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    refresh()
    getSubjects().then(({ data }) => {
      setSubjects(data)
      if (data && data.length) setCategoryId(data[0].id)
    })
  }, [refresh])

  useWSListener('friend_request', refresh)
  useWSListener('friend_request_accepted', refresh)

  useWSListener('match_failed', (payload) => {
    if (!challengeRef.current) return
    setChallenge(null)
    setNotice('')
    setError(payload.reason || 'The match could not start — please try again.')
  })

  useWSListener('friend_challenge_declined', (payload) => {
    if (challengeRef.current?.match_id !== payload.match_id) return
    setChallenge(null)
    setNotice('')
    setError(`${payload.by_username} declined your challenge.`)
  })

  // Suggest players while typing (after a short pause). A sequence number
  // drops answers that arrive after a newer search was started.
  useEffect(() => {
    const q = username.trim()
    if (q.length < 2) {
      setMatches([])
      setSearching(false)
      return
    }
    setSearching(true)
    const seq = ++searchSeq.current
    const t = setTimeout(() => {
      searchPlayers(q)
        .then(({ data }) => seq === searchSeq.current && setMatches(data ?? []))
        .catch(() => seq === searchSeq.current && setMatches([]))
        .finally(() => seq === searchSeq.current && setSearching(false))
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(t)
  }, [username])

  // Where you stand with a player, from the friends list already loaded.
  function relationTo(userId) {
    if (list.friends?.some((f) => f.user_id === userId)) return { kind: 'friends' }
    const incoming = list.incoming?.find((f) => f.user_id === userId)
    if (incoming) return { kind: 'incoming', friendshipId: incoming.friendship_id }
    if (list.outgoing?.some((f) => f.user_id === userId)) return { kind: 'sent' }
    return { kind: 'none' }
  }

  function addPlayer(player) {
    run(async () => {
      const { data } = await sendFriendRequest(player.username)
      setNotice(data.message)
    })
  }

  // Wrap an action so errors and notices land in the page banners.
  async function run(action, successMessage) {
    setError('')
    setNotice('')
    try {
      await action()
      if (successMessage) setNotice(successMessage)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleAdd(e) {
    e.preventDefault()
    const target = username.trim()
    if (!target) return
    run(async () => {
      const { data } = await sendFriendRequest(target)
      setUsername('')
      setNotice(data.message)
    })
  }

  async function handleChallenge(friend) {
    setError('')
    setNotice('')
    try {
      const { data } = await challengeFriend(friend.user_id, { exam_category_id: categoryId })
      setChallenge({ ...data, friend })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCancelChallenge() {
    const current = challenge
    setChallenge(null)
    try {
      await closeChallenge(current.match_id)
    } catch {
      // Already started or expired — nothing to cancel.
    }
  }

  return (
    <div className="page">
      <h1>Friends</h1>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}

      {challenge && (
        <div className="form-card">
          <div className="room-code-display">
            <span>
              Challenge sent to <strong>{nameOf(challenge.friend)}</strong> · {challenge.exam_category_name}
            </span>
            <strong>{challenge.room_code}</strong>
            <p className="muted">Waiting for them to accept…</p>
            <div className="spinner" />
          </div>
          <button className="btn-ghost" onClick={handleCancelChallenge}>Cancel challenge</button>
        </div>
      )}

      <div className="two-col">
        <div className="form-card">
          <h3>Add a friend</h3>
          <form onSubmit={handleAdd}>
            <label>
              Find a player
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Type at least 2 letters of their name"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>
            {username.trim().length >= 2 && (
              <ul className="player-suggestions" aria-live="polite">
                {matches.map((p) => {
                  const rel = relationTo(p.user_id)
                  return (
                    <li key={p.user_id}>
                      <Avatar name={p.display_name || p.username} size={32} />
                      <span className="player-suggestion-name">
                        <strong>{p.display_name || p.username}</strong>
                        <span className="muted">@{p.username}</span>
                      </span>
                      {rel.kind === 'none' && (
                        <button type="button" className="btn-primary small" onClick={() => addPlayer(p)}>Add</button>
                      )}
                      {rel.kind === 'incoming' && (
                        <button type="button" className="btn-primary small" onClick={() => run(() => acceptFriendRequest(rel.friendshipId))}>Accept</button>
                      )}
                      {rel.kind === 'sent' && <span className="suggestion-state">Request sent</span>}
                      {rel.kind === 'friends' && <span className="suggestion-state is-friend">✓ Friends</span>}
                    </li>
                  )
                })}
                {!searching && matches.length === 0 && (
                  <li className="player-suggestions-empty muted">No players match “{username.trim()}”.</li>
                )}
                {searching && matches.length === 0 && <li className="player-suggestions-empty muted">Searching…</li>}
              </ul>
            )}
          </form>
        </div>

        <div className="form-card">
          <h3>Requests</h3>
          {list && list.incoming.length === 0 && list.outgoing.length === 0 && (
            <p className="muted">No pending requests.</p>
          )}
          <ul className="friend-list">
            {list && list.incoming?.map((f) => (
              <li key={f.friendship_id} className="friend-row">
                <div className="friend-info">
                  <span className="friend-name">{nameOf(f)}</span>
                  <span className="muted">@{f.username} · wants to be friends</span>
                </div>
                <div className="friend-actions">
                  <button className="btn-primary small" onClick={() => run(() => acceptFriendRequest(f.friendship_id))}>
                    Accept
                  </button>
                  <button className="btn-ghost small" onClick={() => run(() => declineFriendRequest(f.friendship_id))}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
            {list && list.outgoing?.map((f) => (
              <li key={f.friendship_id} className="friend-row">
                <div className="friend-info">
                  <span className="friend-name">{nameOf(f)}</span>
                  <span className="muted">@{f.username} · request sent</span>
                </div>
                <div className="friend-actions">
                  <button className="btn-ghost small" onClick={() => run(() => removeFriend(f.user_id))}>
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="form-card">
        <div className="section-head">
          <h3>Your friends ({list.friends.length})</h3>
          <label className="inline-label">
            Challenge in
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {subjects && subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
        {list && list.friends.length === 0 && <p className="muted">No friends yet — add someone by username.</p>}
        <ul className="friend-list">
          {list && list.friends?.map((f) => (
            <li key={f.friendship_id} className="friend-row">
              <span className={`ws-dot ${f.online ? 'online' : 'offline'}`} title={f.online ? 'Online' : 'Offline'} />
              <div className="friend-info">
                <span className="friend-name">{nameOf(f)}</span>
                <span className="muted">@{f.username} · {f.online ? 'online' : 'offline'}</span>
              </div>
              <div className="friend-actions">
                <button
                  className="btn-primary small"
                  onClick={() => handleChallenge(f)}
                  disabled={!f.online || !categoryId || !!challenge}
                  title={f.online ? 'Challenge to a match' : 'Friend is offline'}
                >
                  Challenge
                </button>
                <button
                  className="btn-ghost small"
                  onClick={() => {
                    if (window.confirm(`Remove ${nameOf(f)} from your friends?`)) run(() => removeFriend(f.user_id))
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
