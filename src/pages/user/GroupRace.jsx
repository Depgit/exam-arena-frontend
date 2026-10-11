import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getSubjects, quickGroup, createGroupRoom, joinGroupRoom, startGroupRoom, getMyGroupRoom, leaveGroupRoom,
} from '../../api/endpoints'
import { useWSListener } from '../../context/WebSocketContext'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../../components/game/game'
import ShareButtons from '../../components/share/ShareButtons'
import * as sfx from '../../lib/sfx'
import { haptic, HAPTIC } from '../../lib/haptics'

/**
 * Group Race — up to 8 players race the same 10 questions.
 *   Quick race:   the next public room in a category. It starts 15 seconds
 *                 after the first player walks in; bots fill in for a
 *                 player left on their own.
 *   Private room: the host shares a /g/CODE link and presses Start.
 * The race arrives as match_start (Layout takes everyone to the match).
 * Leaving this page leaves the room.
 */
export default function GroupRace() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [categoryId, setCategoryId] = useState(params.get('category') || '')
  const [room, setRoom] = useState(null)
  const [startsAt, setStartsAt] = useState(null) // ms timestamp (public rooms)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const roomRef = useRef(null)

  function showRoom(r) {
    roomRef.current = r
    setRoom(r)
    setStartsAt(r?.starts_in_ms != null ? Date.now() + r.starts_in_ms : null)
  }

  useEffect(() => {
    getSubjects().then(({ data }) => {
      setSubjects(data || [])
      if (data?.length) setCategoryId((c) => c || data[0].id)
    })
    getMyGroupRoom()
      .then(({ data }) => showRoom(data.room))
      .catch(() => {})
      .finally(() => setLoading(false))
    // Leaving the page leaves the room. Once the race has started this is a
    // no-op on the server.
    return () => {
      if (roomRef.current) leaveGroupRoom().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!startsAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [startsAt])

  useWSListener('group_update', (payload) => {
    const next = payload.room
    if (!next) return
    if (roomRef.current && next.players.length > roomRef.current.players.length) {
      sfx.play('select')
      haptic(HAPTIC.light)
    }
    showRoom(next)
  })

  useWSListener('group_closed', (payload) => {
    showRoom(null)
    setError(payload.reason || 'The room closed.')
  })

  useWSListener('match_failed', (payload) => {
    setBusy('')
    showRoom(null)
    setError(payload.reason || "The race couldn't start — please try again.")
  })

  async function run(kind, call) {
    setError('')
    setBusy(kind)
    try {
      const { data } = await call()
      showRoom(data.room)
      sfx.play('select')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function start() {
    setError('')
    setBusy('start')
    try {
      await startGroupRoom(room.code) // match_start takes everyone to the race
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function leave() {
    showRoom(null)
    try {
      await leaveGroupRoom()
    } catch {
      // Already gone.
    }
  }

  const categoryName = (id) => subjects.find((s) => s.id === id)?.name || ''

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" />
      </div>
    )
  }

  // ── Waiting room ──────────────────────────────────────────────────────
  if (room) {
    const isHost = room.host_id === user.id
    const host = room.players.find((p) => p.user_id === room.host_id)
    const secondsLeft = startsAt ? Math.max(0, Math.ceil((startsAt - now) / 1000)) : null
    const alone = room.players.length < 2
    const link = `${window.location.origin}/g/${room.code}`
    const seats = Array.from({ length: room.max_players }, (_, i) => room.players[i] || null)

    let status
    if (room.public) {
      status = (
        <div className="group-clock" role="timer" aria-live="polite">
          <span className="group-clock-num">{secondsLeft > 0 ? secondsLeft : '⚡'}</span>
          <span className="group-clock-label">
            {secondsLeft > 0 ? 'seconds to start' : 'Starting…'}
          </span>
          <span className="muted group-clock-note">
            {alone ? 'Nobody else yet? Bots will race you if no one joins.' : `${room.players.length} racers in — more can still jump in.`}
          </span>
        </div>
      )
    } else if (isHost) {
      status = (
        <div className="group-clock">
          <button className="btn-primary btn-xl" onClick={start} disabled={alone || busy === 'start'}>
            {busy === 'start' ? 'Starting…' : alone ? 'Waiting for friends…' : `🏁 Start race (${room.players.length})`}
          </button>
          <span className="muted group-clock-note">
            {alone ? 'Send the link below — start once at least one friend is in.' : 'Start now, or wait for more friends.'}
          </span>
        </div>
      )
    } else {
      status = (
        <div className="group-clock">
          <span className="waiting-line">
            <span className="spinner" />
            Waiting for {host?.username || 'the host'} to start…
          </span>
        </div>
      )
    }

    return (
      <div className="page group-page">
        <header className="page-head">
          <span className="eyebrow">
            Group Race · {categoryName(room.category_id)} · {room.public ? 'Public' : 'Private room'}
          </span>
          <h1>{room.public ? 'Get ready!' : isHost ? 'Your room' : 'You\'re in!'}</h1>
        </header>
        {error && <div className="alert-error">{error}</div>}

        <div className="group-room">
          {status}

          <div>
            <h2 className="group-seats-title">
              Racers <span className="muted">{room.players.length}/{room.max_players}</span>
            </h2>
            <ul className="group-seats">
              {seats.map((p, i) =>
                p ? (
                  <li key={p.user_id} className={`group-seat ${p.user_id === user.id ? 'me' : ''}`}>
                    <Avatar name={p.username} size={40} />
                    <span className="group-seat-name">
                      {p.username}
                      {p.user_id === user.id && <span className="muted"> (you)</span>}
                    </span>
                    {p.user_id === room.host_id && <span className="group-host" title="Host">👑</span>}
                  </li>
                ) : (
                  <li key={`open-${i}`} className="group-seat open" aria-label="Open seat">
                    <span className="group-seat-empty" aria-hidden="true">+</span>
                    <span className="muted">Open seat</span>
                  </li>
                )
              )}
            </ul>
          </div>

          <div className="group-invite">
            <div>
              <strong>{room.public ? 'Bring your friends into this race' : 'Invite friends'}</strong>
              <span className="muted">
                Room code <code className="group-code">{room.code}</code> · or send the link
              </span>
            </div>
            <ShareButtons
              kind="invite"
              label="Send invite"
              text={`👥 Join my Group Race on Mind Race — ${categoryName(room.category_id)}, up to 8 players, 90 seconds. Tap to jump in 👉 ${link}?ref=group`}
            />
          </div>

          <p className="muted group-stay">Stay on this page — the race opens by itself when it starts.</p>
          <button className="btn-ghost" onClick={leave}>Leave room</button>
        </div>
      </div>
    )
  }

  // ── Pick how to race ─────────────────────────────────────────────────
  return (
    <div className="page group-page">
      <header className="page-head">
        <span className="eyebrow">New · up to 8 players</span>
        <h1>Group Race</h1>
        <p className="muted">
          Everyone gets the same 10 questions and 90 seconds. Most points wins — fast answers earn bonus points.
          Unrated, so just have fun.
        </p>
      </header>
      {error && <div className="alert-error">{error}</div>}

      <section>
        <h2>Category</h2>
        <div className="tile-picker compact">
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tile-option ${categoryId === s.id ? 'selected' : ''}`}
              aria-pressed={categoryId === s.id}
              onClick={() => {
                setCategoryId(s.id)
                sfx.play('select')
              }}
            >
              <strong>{s.name}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="group-choices">
        <div className="form-card group-choice featured">
          <span className="group-choice-icon" aria-hidden="true">⚡</span>
          <h3>Quick race</h3>
          <p className="muted">Join the next public race. It starts 15 seconds after the first player joins.</p>
          <button
            className="btn-primary btn-lg"
            onClick={() => run('quick', () => quickGroup({ exam_category_id: categoryId }))}
            disabled={!categoryId || !!busy}
          >
            {busy === 'quick' ? 'Joining…' : 'Join quick race'}
          </button>
        </div>

        <div className="form-card group-choice">
          <span className="group-choice-icon" aria-hidden="true">🏠</span>
          <h3>Private room</h3>
          <p className="muted">Race your friends or class. Share a link, start when everyone's in.</p>
          <button
            className="btn-ghost btn-lg"
            onClick={() => run('create', () => createGroupRoom({ exam_category_id: categoryId }))}
            disabled={!categoryId || !!busy}
          >
            {busy === 'create' ? 'Creating…' : 'Create room'}
          </button>
        </div>

        <form
          className="form-card group-choice"
          onSubmit={(e) => {
            e.preventDefault()
            run('join', () => joinGroupRoom(joinCode.trim().toUpperCase()))
          }}
        >
          <span className="group-choice-icon" aria-hidden="true">🔑</span>
          <h3>Have a code?</h3>
          <input
            className="code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            aria-label="Room code"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn-ghost btn-lg" type="submit" disabled={joinCode.trim().length < 6 || !!busy}>
            {busy === 'join' ? 'Joining…' : 'Join room'}
          </button>
        </form>
      </div>

      <p className="muted group-footnote">
        Prefer 1v1? <Link to="/app/matchmaking">Play a ranked match</Link>.
      </p>
    </div>
  )
}
