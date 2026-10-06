import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubjects, joinQueue, leaveQueue, getQueueStats } from '../../api/endpoints'
import { useWebSocket, useWSListener } from '../../context/WebSocketContext'
import { useSmoothCountdown } from '../../hooks/useSmoothCountdown'
import { useAuth } from '../../context/AuthContext'
import { Avatar, RankBadge, TimerRing } from '../../components/game/game'
import * as sfx from '../../lib/sfx'
import { haptic, HAPTIC } from '../../lib/haptics'

const POLL_MS = 2000
const MAX_POLLS = 15 // ~30s, then give up and tell the player

const MODES = [
  {
    key: 'ranked',
    icon: '⚔️',
    title: 'Ranked',
    blurb: 'Paired with a player close to your rating. ELO on the line.',
  },
  {
    key: 'arena',
    icon: '🌀',
    title: 'Arena',
    blurb: 'Open to everyone — you face the next waiting player, any rating.',
  },
]

export default function Matchmaking() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [matchType, setMatchType] = useState('ranked')
  const [queued, setQueued] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [queueStats, setQueueStats] = useState({})
  const [error, setError] = useState('')
  const [found, setFound] = useState(false)
  const [notice, setNotice] = useState('')
  // match_found proposal awaiting both players' accept (pending_match.go).
  const [proposal, setProposal] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [opponentAccepted, setOpponentAccepted] = useState(false)
  const acceptLeft = useSmoothCountdown(proposal ? proposal.accept_seconds : null)
  const { send } = useWebSocket()
  const navigate = useNavigate()

  useEffect(() => {
    getSubjects().then(({ data }) => {
      setSubjects(data)
      if (data.length) setCategoryId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!queued) return
    let count = 0
    const started = Date.now()
    const clock = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    const interval = setInterval(() => {
      getQueueStats().then(({ data }) => setQueueStats(data.pools)).catch(() => { })
      count++
      if (count > MAX_POLLS) {
        clearInterval(interval)
        handleLeave()
        setError('No opponent found right now. Try again, or switch to Arena for a faster match.')
      }
    }, POLL_MS)
    return () => {
      clearInterval(interval)
      clearInterval(clock)
      setElapsed(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued])

  // The server paired us; it waits up to accept_seconds for BOTH players
  // to send accept_match before starting. Stop the search timers (their
  // auto-give-up would pull us out of the queue mid-proposal).
  useWSListener('match_found', (payload) => {
    setQueued(false)
    setNotice('')
    setAccepted(false)
    setOpponentAccepted(false)
    setProposal(payload)
    sfx.play('found')
    haptic(HAPTIC.success)
  })

  useWSListener('opponent_accepted', (payload) => {
    if (payload.pending_id === proposal?.pending_id) setOpponentAccepted(true)
  })

  useWSListener('match_cancelled', (payload) => {
    // No proposal on screen means we already declined it ourselves.
    if (!proposal || payload.pending_id !== proposal.pending_id) return
    setProposal(null)
    setAccepted(false)
    if (payload.requeued) {
      // Opponent declined or timed out; the server kept our place in line.
      setNotice(`${payload.opponent_username || 'Your opponent'} didn't accept — back to searching.`)
      setQueued(true)
    } else if (payload.you_declined) {
      setError('Match not accepted in time, so you were removed from the queue.')
    } else {
      setError(payload.reason || 'The match was cancelled.')
    }
  })

  function handleAccept() {
    if (!proposal || accepted) return
    if (send('accept_match', { pending_id: proposal.pending_id })) {
      setAccepted(true)
      sfx.play('select')
    } else {
      setError('Not connected to the game server — reconnecting, try again in a moment.')
    }
  }

  function handleDecline() {
    if (!proposal) return
    send('decline_match', { pending_id: proposal.pending_id })
    setProposal(null)
    setAccepted(false)
  }

  useWSListener('match_start', (payload) => {
    setQueued(false)
    setProposal(null)
    setFound(true)
    sfx.play('found')
    haptic(HAPTIC.success)
    navigate(`/app/match/${payload.match_id}`, { state: payload })
  })

  useWSListener('match_failed', (payload) => {
    setQueued(false)
    setProposal(null)
    setError(payload.reason || 'Match could not be started')
  })

  async function handleJoin() {
    setError('')
    setNotice('')
    sfx.play('select')
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

  const category = subjects.find((s) => s.id === categoryId)
  const name = user.display_name || user.username
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  // Pool keys are "<category uuid>:<match type>" — show names, not ids.
  const poolLabel = (pool) => {
    const [catId, type] = pool.split(':')
    const cat = subjects.find((s) => s.id === catId)
    return `${cat?.name || 'Unknown'} · ${type === 'arena' ? 'Arena' : 'Ranked'}`
  }

  if (proposal) {
    const you = proposal.you || { username: name }
    const opp = proposal.opponent || {}
    return (
      <div className="page">
        <div className="found-stage">
          <span className="eyebrow">{proposal.match_type === 'arena' ? 'Arena' : 'Ranked'} · {subjects.find((s) => s.id === proposal.exam_category_id)?.name}</span>
          <h1 className="found-title">Match found!</h1>
          <div className="found-versus">
            <div className="found-player vs-left">
              <Avatar name={you.username} size={80} ring={accepted ? 'platinum' : undefined} />
              <strong>{you.username}</strong>
              {you.rating != null && <RankBadge rating={you.rating} size="sm" />}
              <span className={`found-state ${accepted ? 'ready' : ''}`}>{accepted ? '✓ Ready' : 'Deciding…'}</span>
            </div>
            <div className="found-timer">
              <TimerRing remaining={acceptLeft} total={proposal.accept_seconds} size={84} />
            </div>
            <div className="found-player vs-right">
              <Avatar name={opp.username} size={80} ring={opponentAccepted ? 'platinum' : undefined} />
              <strong>{opp.username}</strong>
              {opp.rating != null && <RankBadge rating={opp.rating} size="sm" />}
              <span className={`found-state ${opponentAccepted ? 'ready' : ''}`}>{opponentAccepted ? '✓ Ready' : 'Deciding…'}</span>
            </div>
          </div>
          {error && <div className="alert-error">{error}</div>}
          {!accepted ? (
            <div className="found-actions">
              <button className="btn-primary btn-xl" onClick={handleAccept} autoFocus>Accept</button>
              <button className="btn-ghost" onClick={handleDecline}>Decline</button>
            </div>
          ) : (
            <p className="waiting-line">
              <span className="spinner" />
              {opponentAccepted ? 'Both ready — starting…' : `Waiting for ${opp.username || 'your opponent'} to accept…`}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (queued || found) {
    return (
      <div className="page">
        <div className="search-stage">
          <div className="radar" aria-hidden="true">
            <span className="radar-sweep" />
            <span className="radar-ring r1" />
            <span className="radar-ring r2" />
            <span className="radar-ring r3" />
            <span className="radar-center">
              <Avatar name={name} size={64} />
            </span>
          </div>
          <div className="search-copy">
            <span className="eyebrow">{matchType === 'arena' ? 'Arena' : 'Ranked'} · {category?.name}</span>
            <h1>{found ? 'Opponent found!' : 'Searching for an opponent'}</h1>
            <div className="search-clock" aria-live="polite">{clock}</div>
            <p className="muted">{notice || "You'll get a prompt to accept when an opponent is found."}</p>
          </div>
          {!found && (
            <button className="btn-ghost" onClick={handleLeave}>Cancel search</button>
          )}
          {Object.keys(queueStats).length > 0 && (
            <ul className="queue-stats">
              {Object.entries(queueStats).map(([pool, count]) => (
                <li key={pool}><span>{poolLabel(pool)}</span><strong>{count}</strong></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Battle</span>
        <h1>Choose your battle</h1>
      </header>
      {error && <div className="alert-error">{error}</div>}

      <section>
        <h2>Mode</h2>
        <div className="mode-picker">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`mode-option ${matchType === m.key ? 'selected' : ''}`}
              aria-pressed={matchType === m.key}
              onClick={() => {
                setMatchType(m.key)
                sfx.play('select')
              }}
            >
              <span className="mode-option-icon" aria-hidden="true">{m.icon}</span>
              <strong>{m.title}</strong>
              <span>{m.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Exam category</h2>
        <div className="tile-picker">
          {subjects?.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tile-option ${categoryId === s.id ? 'selected' : ''}`}
              aria-pressed={categoryId === s.id}
              title={s.description}
              onClick={() => {
                setCategoryId(s.id)
                sfx.play('select')
              }}
            >
              <strong>{s.name}</strong>
              {s.code && <span>{s.code}</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="find-bar">
        <div>
          <strong>{matchType === 'arena' ? 'Arena' : 'Ranked'}</strong>
          <span className="muted"> · {category?.name || 'Pick a category'}</span>
        </div>
        <button className="btn-primary btn-xl" onClick={handleJoin} disabled={!categoryId}>
          Find match
        </button>
      </div>
    </div>
  )
}
