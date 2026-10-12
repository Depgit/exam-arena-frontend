import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { closeChallenge, getMatch, requestRematch } from '../../api/endpoints'
import LeaveMatchDialog from '../../components/game/LeaveMatchDialog'
import ShareButtons from '../../components/share/ShareButtons'
import { SITE, drawResultCard, groupShareText, matchShareText } from '../../lib/share'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket, useWSListener } from '../../context/WebSocketContext'
import { useSmoothCountdown } from '../../hooks/useSmoothCountdown'
import { useCountUp } from '../../hooks/useCountUp'
import { Avatar, Confetti, RankBadge, TimerRing } from '../../components/game/game'
import QuestionCard, { KeyHint, ProgressDots, sortOptions, useAnswerKeys } from '../../components/game/QuestionCard'
import * as sfx from '../../lib/sfx'
import { haptic, HAPTIC } from '../../lib/haptics'

const INTRO_MS = 1400
// How long to wait for the server's ack before sending an answer again.
const RESEND_AFTER_MS = 3000

function HudPlayer({ player, score, isMe, side, pulse }) {
  const shown = useCountUp(score ?? 0, { duration: 500 })
  return (
    <div className={`hud-player hud-${side} ${isMe ? 'me' : ''} ${pulse ? 'hud-pulse' : ''}`}>
      <Avatar name={player?.username} size={40} />
      <div className="hud-player-info">
        <span className="hud-name">
          {player?.username}
          {isMe && <span className="hud-you"> (you)</span>}
        </span>
        {player?.rating != null && <RankBadge rating={player.rating} size="sm" />}
      </div>
      <span className="hud-score" key={score}>{shown}</span>
    </div>
  )
}

// Bots in a reloaded match come back as their account name (bot.rookie).
const shownName = (name) =>
  name?.startsWith('bot.') ? `🤖 ${name.slice(4, 5).toUpperCase()}${name.slice(5)}` : name
// Avatar letter: skip a bot's 🤖 so it shows the bot's initial.
const avatarName = (name) => shownName(name)?.replace(/^🤖\s*/, '')
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
const ordinal = (n) => {
  const v = n % 100
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th')
}

// Group Race: everyone's live score, best first.
function GroupStandings({ players, scoreboard, me }) {
  const byId = Object.fromEntries(scoreboard.map((s) => [s.user_id, s]))
  const rows = players
    .map((p) => ({ ...p, score: byId[p.user_id]?.score ?? 0, left: byId[p.user_id]?.left }))
    .sort((a, b) => (a.left === b.left ? b.score - a.score : a.left ? 1 : -1))
  return (
    <ol className="group-standings" aria-label="Live standings">
      {rows.map((p, i) => (
        <li key={p.user_id} className={`${p.user_id === me ? 'me' : ''} ${p.left ? 'left' : ''}`}>
          <span className="gs-rank">{i + 1}</span>
          <span className="gs-name">{p.user_id === me ? 'You' : shownName(p.username)}</span>
          <span className="gs-score">{p.left ? 'left' : p.score}</span>
        </li>
      ))}
    </ol>
  )
}

function EloDelta({ delta, after }) {
  const shown = useCountUp(after ?? 0, { duration: 1100 })
  const cls = delta > 0 ? 'elo-gain' : delta < 0 ? 'elo-loss' : 'elo-draw'
  return (
    <div className="result-elo">
      <span className={`elo-delta ${cls}`}>{delta > 0 ? '+' : ''}{Math.round(delta)} ELO</span>
      {after != null && <span className="elo-new muted">→ {shown}</span>}
    </div>
  )
}

export default function LiveMatch() {
  const { matchId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { send, connected } = useWebSocket()

  // The match_start payload handed over by the page that started the match.
  // Read once: the browser keeps router state in its history, so pressing
  // Back to this page later would otherwise replay a finished match from it.
  const [start] = useState(() => location.state)
  const [questions, setQuestions] = useState(start?.questions || [])
  const [players, setPlayers] = useState(start?.players || [])
  const [matchType, setMatchType] = useState(start?.match_type || '')
  const isGroup = matchType === 'group'
  const [leftNotice, setLeftNotice] = useState('')
  const [timerSeconds, setTimerSeconds] = useState(start?.timer_seconds ?? null)
  // Last authoritative clock reading from the server. The server only speaks
  // every 10 seconds, so useSmoothCountdown interpolates between readings —
  // see the hook for why the client is allowed to do that.
  const [serverRemaining, setServerRemaining] = useState(start?.timer_seconds ?? null)
  const remaining = useSmoothCountdown(serverRemaining)
  const [scoreboard, setScoreboard] = useState([])
  const [answeredIds, setAnsweredIds] = useState(new Set()) // acknowledged by the server
  const [sentIds, setSentIds] = useState(new Set()) // sent, maybe not yet acknowledged
  // Answers the server hasn't acknowledged yet: questionId → { payload, sentAt }.
  // A send only reaches the server if the socket is open at that instant, so
  // anything locked in during a disconnect would otherwise be lost silently —
  // the player sees "locked in", the server never counts it, and the match
  // can't finish early. We keep resending until a score_update acks it; the
  // server ignores (and re-acks) duplicates, so resending is always safe.
  const outboxRef = useRef(new Map())
  const [unacked, setUnacked] = useState(0)
  // questionId → { correct, points } for this player's graded answers.
  const [graded, setGraded] = useState({})
  const [current, setCurrent] = useState(0)
  // questionId → optionId. A selection is only a draft: it can be changed or
  // cleared, and is sent (and scored) when the player presses Next.
  const [selections, setSelections] = useState({})
  const [results, setResults] = useState(null)
  const [leftBy, setLeftBy] = useState('') // who left the match early, if anyone
  const [confirmLeave, setConfirmLeave] = useState(false)
  // Rematch: null | { state: 'sending' | 'waiting' | 'declined' | 'error', roomId?, message? }
  const [rematch, setRematch] = useState(null)
  const [error, setError] = useState('')
  const [floater, setFloater] = useState(null) // { id, text, kind }
  const [opponentPulse, setOpponentPulse] = useState(0)
  // VS splash only for a fresh match (arrived via match_start), not a refresh.
  const [intro, setIntro] = useState(Boolean(start?.players?.length))
  const questionStartRef = useRef(Date.now())
  const isBotMatch = !isGroup && (matchType === 'bot' || players.some((p) => p.is_bot))

  // Drop the saved hand-off from this history entry, so Back/Forward to
  // this page later starts from the server, not from the old copy.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Always ask the server what this match is now. A fresh match (arrived
  // via match_start) is already on screen and only gets confirmed; a
  // refresh or reopen is filled in from here; a match that has ended —
  // e.g. reached again with Back — shows its final result instead of
  // replaying the questions.
  useEffect(() => {
    getMatch(matchId)
      .then(({ data }) => {
        if (data.match?.match_type && !start?.match_type) setMatchType(data.match.match_type)
        const status = data.match?.status
        if (status && status !== 'in_progress') {
          setIntro(false)
          setQuestions([])
          if (data.players?.length) setPlayers(data.players)
          const byScore = [...(data.players || [])].sort((a, b) => b.score - a.score)
          setResults(
            byScore.map((p) => ({
              user_id: p.user_id,
              username: p.username,
              score: p.score,
              // Bot matches store no final rank: rank by score, ties share.
              rank: p.final_rank ?? 1 + byScore.filter((o) => o.score > p.score).length,
              correct: null,
              total: null,
              elo_delta: p.rating_delta ?? null,
              rating_before: p.rating_before ?? null,
              rating_after: p.rating_after ?? null,
            }))
          )
          return
        }
        if (start?.questions?.length) return // fresh match: already on screen

        if (data.questions) setQuestions(data.questions)
        if (data.match?.timer_seconds) setTimerSeconds(data.match.timer_seconds)
        if (data.live_scores) setScoreboard(data.live_scores)
        if (data.players?.length && players.length === 0) setPlayers(data.players)
        // Reopened mid-match: restore our answers and the clock, and start on
        // the first question we haven't answered yet.
        if (data.remaining_seconds != null) setServerRemaining(data.remaining_seconds)
        if (data.my_answers) {
          const mine = data.my_answers
          setAnsweredIds(new Set(Object.keys(mine)))
          setGraded(mine)
          const firstOpen = (data.questions || []).findIndex((q) => !mine[q.id])
          if (firstOpen > 0) setCurrent(firstOpen)
        }
      })
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  useEffect(() => {
    if (!intro) return
    const t = setTimeout(() => setIntro(false), INTRO_MS)
    return () => clearTimeout(t)
  }, [intro])

  useEffect(() => {
    questionStartRef.current = Date.now()
  }, [current, intro])

  // Clock tick for the final five seconds.
  useEffect(() => {
    if (!results && remaining != null && remaining > 0 && remaining <= 5) sfx.play('tick')
  }, [remaining, results])

  useWSListener('score_update', (payload) => {
    if (payload.match_id !== matchId) return
    setScoreboard(payload.scoreboard || [])
    if (payload.user_id === user.id) {
      outboxRef.current.delete(payload.question_id)
      setUnacked(outboxRef.current.size)
      // A re-ack for an answer we already have results for: nothing new.
      if (graded[payload.question_id]) return
      setAnsweredIds((prev) => new Set(prev).add(payload.question_id))
      setGraded((g) => ({ ...g, [payload.question_id]: { correct: payload.is_correct, points: payload.points_earned } }))
      setFloater({
        id: Date.now(),
        text: payload.is_correct ? `+${payload.points_earned}` : 'Miss',
        kind: payload.is_correct ? 'good' : 'bad',
      })
      sfx.play(payload.is_correct ? 'correct' : 'wrong')
      haptic(payload.is_correct ? HAPTIC.success : HAPTIC.error)
    } else {
      setOpponentPulse(Date.now())
    }
  })

  // Group Race: someone gave up; the race goes on.
  useWSListener('player_left', (payload) => {
    if (payload.match_id !== matchId) return
    setScoreboard(payload.scoreboard || [])
    const who = players.find((p) => p.user_id === payload.user_id)
    setLeftNotice(`${shownName(who?.username) || 'A racer'} left the race`)
  })

  useEffect(() => {
    if (!leftNotice) return
    const t = setTimeout(() => setLeftNotice(''), 3000)
    return () => clearTimeout(t)
  }, [leftNotice])

  useWSListener('time_update', (payload) => {
    if (payload.match_id !== matchId) return
    setServerRemaining(payload.remaining_seconds)
  })

  useWSListener('match_end', (payload) => {
    if (payload.match_id !== matchId) return
    setConfirmLeave(false)
    if (payload.match_type) setMatchType(payload.match_type)
    setLeftBy(payload.left_by || '')
    setResults(payload.results)
    const me = payload.results?.find((r) => r.user_id === user.id)
    const tied = payload.results?.filter((r) => r.rank === 1).length > 1
    const podium = payload.match_type === 'group' && me?.rank <= 3
    sfx.play(me?.rank === 1 && !tied ? 'victory' : me?.rank === 1 || podium ? 'correct' : 'defeat')
  })

  // The opponent declined our rematch.
  useWSListener('friend_challenge_declined', (payload) => {
    if (rematch?.roomId && payload.match_id === rematch.roomId) setRematch({ state: 'declined', busy: payload.reason === 'busy' })
  })

  async function askRematch() {
    setRematch({ state: 'sending' })
    try {
      const { data } = await requestRematch(matchId)
      // They had asked too: the match is starting (match_start takes us there).
      if (data.joined) setRematch({ state: 'waiting', joined: true })
      else setRematch({ state: 'waiting', roomId: data.match_id })
    } catch (err) {
      setRematch({ state: 'error', message: err.message })
    }
  }

  async function cancelRematch() {
    const roomId = rematch?.roomId
    setRematch(null)
    if (roomId) closeChallenge(roomId).catch(() => {})
  }

  useWSListener('error', (payload) => {
    setError(payload.message)
  })

  const question = questions[current]
  const isLocked = (id) => answeredIds.has(id) || sentIds.has(id)
  const alreadyAnswered = question ? isLocked(question.id) : false
  const selected = question ? selections[question.id] || '' : ''
  const isLast = current >= questions.length - 1
  const sortedOptions = useMemo(() => sortOptions(question), [question])

  // True when this user has answered every question
  const allDone =
    questions.length > 0 && questions.every((q) => isLocked(q.id))

  const scoreOf = (id) => scoreboard.find((s) => s.user_id === id)?.score ?? 0
  const me = players.find((p) => p.user_id === user.id) || { user_id: user.id, username: user.username }
  const opponent = players.find((p) => p.user_id !== user.id) ||
    scoreboard.find((s) => s.user_id !== user.id)
  const answeredCount = questions.filter((q) => isLocked(q.id)).length
  // Group Race: my place right now (ties share), out of the racers still in.
  const racing = players.filter((p) => !scoreboard.find((s) => s.user_id === p.user_id)?.left)
  const myLiveRank = 1 + racing.filter((p) => p.user_id !== user.id && scoreOf(p.user_id) > scoreOf(user.id)).length

  function selectOption(optionId) {
    if (!question || alreadyAnswered) return
    sfx.play('select')
    haptic(HAPTIC.light)
    setSelections((s) => ({ ...s, [question.id]: optionId }))
  }

  function clearSelection() {
    if (!question || alreadyAnswered) return
    setSelections((s) => {
      const next = { ...s }
      delete next[question.id]
      return next
    })
  }

  // Next submits the selected answer (if any) and moves on. On the last
  // question it jumps back to the first one still unanswered.
  function goNext() {
    if (!question) return
    let sent = null
    if (!alreadyAnswered && selected) {
      const payload = {
        match_id: matchId,
        question_id: question.id,
        option_id: selected,
        time_taken_ms: Date.now() - questionStartRef.current,
      }
      // sentAt 0 = never reached an open socket; the retry loop sends it ASAP.
      outboxRef.current.set(question.id, { payload, sentAt: send('submit_answer', payload) ? Date.now() : 0 })
      setUnacked(outboxRef.current.size)
      sent = question.id
      setSentIds((prev) => new Set(prev).add(question.id))
    }
    if (!isLast) {
      setCurrent(current + 1)
      return
    }
    const firstOpen = questions.findIndex((q) => q.id !== sent && !isLocked(q.id))
    if (firstOpen !== -1) setCurrent(firstOpen)
  }

  // Resend unacknowledged answers: right after reconnecting, and every few
  // seconds while any are still waiting.
  useEffect(() => {
    if (!connected || results) return
    const flush = (force) => {
      const now = Date.now()
      for (const entry of outboxRef.current.values()) {
        if (force || now - entry.sentAt > RESEND_AFTER_MS) {
          if (send('submit_answer', entry.payload)) entry.sentAt = now
        }
      }
    }
    flush(true)
    const id = setInterval(() => flush(false), 1000)
    return () => clearInterval(id)
  }, [connected, results, send])

  const nextDisabled = isLast && (alreadyAnswered || !selected)
  const dotState = (q) => {
    const g = graded[q.id]
    return g ? (g.correct ? 'right' : 'wrong') : isLocked(q.id) ? 'answered' : ''
  }

  useAnswerKeys({
    enabled: !results && !intro && !!question,
    options: sortedOptions,
    onPick: selectOption,
    onEnter: nextDisabled ? undefined : goNext,
    onPrev: current > 0 ? () => setCurrent(current - 1) : undefined,
    onNext: current < questions.length - 1 ? () => setCurrent(current + 1) : undefined,
  })

  const nextLabel = alreadyAnswered
    ? 'Next →'
    : selected
      ? isLast ? 'Lock in' : 'Lock in & next →'
      : isLast ? 'Lock in' : 'Skip →'

  // ── Group Race results ──────────────────────────────────────────────
  if (results && isGroup) {
    const sorted = [...results].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    const mine = sorted.find((r) => r.user_id === user.id)
    const n = sorted.length
    const place = mine?.rank
    const title = !mine ? 'Race over' : place === 1 ? 'You won the race!' : `${ordinal(place)} of ${n}`
    return (
      <div className={`page match-results-page outcome-${place === 1 ? 'victory' : 'draw'}`}>
        {place === 1 && <Confetti />}
        <div className="results-header">
          <div className="results-trophy" aria-hidden="true">{MEDAL[place] || '🏁'}</div>
          <h1 className="results-title">{title}</h1>
          <p className="muted">
            {mine?.correct != null ? `${mine.correct}/${mine.total} correct · ` : ''}
            {mine?.score ?? 0} pts · Group Race (unrated)
          </p>
        </div>

        <div className="results-list">
          {sorted.map((r) => {
            const isMe = r.user_id === user.id
            return (
              <div key={r.user_id} className={`result-row ${isMe ? 'me' : ''}`}>
                <span className="result-rank">{MEDAL[r.rank] || `#${r.rank}`}</span>
                <Avatar name={avatarName(r.username)} size={36} />
                <div className="result-info">
                  <span className="result-name">
                    {shownName(r.username)}{isMe ? ' (you)' : ''}
                    {r.left && <span className="left-tag">left</span>}
                  </span>
                  {r.total != null && <span className="muted result-accuracy">{r.correct}/{r.total} correct</span>}
                </div>
                <span className="result-score">{r.score} pts</span>
              </div>
            )
          })}
        </div>

        {mine && !mine.left && (
          <div className="share-panel">
            <div>
              <strong>{place === 1 ? 'Brag a little' : 'Share your finish'}</strong>
              <span className="muted">Send it to friends — next race, bring them along.</span>
            </div>
            <ShareButtons
              kind="match"
              text={groupShareText({ place, players: n, me: mine, url: `${SITE}/r/${matchId}?ref=result` })}
              filename="mindrace-group-race.png"
              makeImage={() =>
                drawResultCard({
                  eyebrow: 'Group Race',
                  title: place === 1 ? 'WINNER' : ordinal(place).toUpperCase(),
                  subtitle: `of ${n} racers`,
                  stats: [
                    ['Score', `${mine.score}`],
                    ...(mine.correct != null ? [['Correct', `${mine.correct}/${mine.total}`]] : []),
                  ],
                  accent: place === 1 ? '#ffd43b' : place <= 3 ? '#a5b4fc' : '#ffffff',
                })
              }
            />
          </div>
        )}

        <div className="results-actions">
          <button className="btn-primary btn-xl" onClick={() => navigate('/app/group')}>
            👥 Race again
          </button>
          <button className="btn-ghost" onClick={() => navigate('/app/dashboard')}>
            Back to lobby
          </button>
        </div>
      </div>
    )
  }

  // ── Results screen ──────────────────────────────────────────────────
  if (results) {
    const sorted = [...results].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    const mine = sorted.find((r) => r.user_id === user.id)
    // The server gives tied players the same rank.
    const isDraw = mine?.rank === 1 && sorted.filter((r) => r.rank === 1).length > 1
    const won = mine?.rank === 1 && !isDraw
    const outcome = isDraw ? 'draw' : won ? 'victory' : mine ? 'defeat' : 'over'
    const title = { draw: 'Draw', victory: 'Victory', defeat: 'Defeat', over: 'Match over' }[outcome]
    const iLeft = leftBy === user.id
    const rival = sorted.find((r) => r.user_id !== user.id)
    const mode = isBotMatch ? 'bot' : start?.match_type
    const MODE_NAME = { ranked: 'Ranked', arena: 'Arena', friend: 'Friend', bot: 'Bot' }
    const canShare = mine && rival && !iLeft && outcome !== 'over'
    const leftNote = !leftBy ? '' : iLeft ? 'You left the match — your opponent wins.' : 'Your opponent left the match — the win is yours.'

    return (
      <div className={`page match-results-page outcome-${outcome}`}>
        {won && <Confetti />}
        <div className="results-header">
          <div className="results-trophy" aria-hidden="true">
            {iLeft ? '🏳️' : isDraw ? '🤝' : won ? '🏆' : mine ? '💀' : '⚔️'}
          </div>
          <h1 className="results-title">{iLeft ? 'You left' : title}</h1>
          {leftNote && <p className="left-note">{leftNote}</p>}
          <p className="muted">{mine?.correct != null ? `${mine.correct}/${mine.total} correct` : ''}</p>
          {isBotMatch && <p className="unrated-note">🤖 Unrated · bot match — your rating didn't change</p>}
        </div>

        <div className="results-list">
          {sorted?.map((r) => {
            const isMe = r.user_id === user.id
            return (
              <div key={r.user_id} className={`result-row ${isMe ? 'me' : ''}`}>
                <span className="result-rank">#{r.rank}</span>
                <Avatar name={r.username} size={36} />
                <div className="result-info">
                  <span className="result-name">
                    {r.username}{isMe ? ' (you)' : ''}
                    {r.left && <span className="left-tag">left</span>}
                  </span>
                  {r.total != null && (
                    <span className="muted result-accuracy">{r.correct}/{r.total} correct</span>
                  )}
                </div>
                <span className="result-score">{r.score} pts</span>
                {r.elo_delta != null && <EloDelta delta={r.elo_delta} after={r.rating_after != null ? Math.round(r.rating_after) : null} />}
              </div>
            )
          })}
        </div>

        {canShare && (
          <div className="share-panel">
            <div>
              <strong>{won ? 'Brag a little' : isDraw ? 'Share the draw' : 'Call for a rematch'}</strong>
              <span className="muted">Send it to friends — they can jump in at mindrace.in.</span>
            </div>
            <ShareButtons
              kind="match"
              text={matchShareText({ outcome, me: mine, opponent: rival, mode, isBot: isBotMatch, url: `${SITE}/r/${matchId}?ref=result` })}
              filename="mindrace-result.png"
              makeImage={() =>
                drawResultCard({
                  eyebrow: `${MODE_NAME[mode] || ''} match`.trim(),
                  title: title,
                  subtitle: `vs ${isBotMatch ? rival.username : '@' + rival.username}`,
                  stats: [
                    ['Score', `${mine.score}–${rival.score}`],
                    ...(mine.correct != null ? [['Correct', `${mine.correct}/${mine.total}`]] : []),
                    ...(mine.elo_delta != null ? [['Rating', `${mine.elo_delta > 0 ? '+' : ''}${mine.elo_delta}`]] : []),
                  ],
                  accent: won ? '#ffd43b' : isDraw ? '#a5b4fc' : '#f87171',
                })
              }
            />
          </div>
        )}

        {rival && !isBotMatch && !iLeft && (
          <div className="rematch-box" role="status">
            {!rematch && (
              <button className="btn-primary btn-lg rematch-btn" onClick={askRematch}>
                🔁 Rematch {rival.username}
              </button>
            )}
            {rematch?.state === 'sending' && <span className="muted">Asking {rival.username}…</span>}
            {rematch?.state === 'waiting' && (
              <>
                <span className="waiting-line">
                  <span className="spinner" />
                  {rematch.joined ? 'Starting the rematch…' : `Waiting for ${rival.username} to accept…`}
                </span>
                {!rematch.joined && (
                  <button className="btn-ghost small" onClick={cancelRematch}>Cancel</button>
                )}
              </>
            )}
            {rematch?.state === 'declined' && (
              <span className="muted">{rival.username} {rematch.busy ? 'is in another match now.' : 'said not now.'} <button className="btn-link" onClick={() => setRematch(null)}>Ask again</button></span>
            )}
            {rematch?.state === 'error' && (
              <span className="rematch-error">{rematch.message} <button className="btn-link" onClick={() => setRematch(null)}>OK</button></span>
            )}
          </div>
        )}

        <div className="results-actions">
          <button className="btn-primary btn-xl" onClick={() => navigate('/app/matchmaking')}>
            Play again
          </button>
          <button className="btn-ghost" onClick={() => navigate('/app/dashboard')}>
            Back to lobby
          </button>
        </div>
      </div>
    )
  }

  if (error && !question) {
    return (
      <div className="page">
        <div className="alert-error">{error}</div>
        <button className="btn-primary" onClick={() => navigate('/app/dashboard')}>Back to lobby</button>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="page-center">
        <div className="spinner" />
        Loading match…
      </div>
    )
  }

  // ── Intro ────────────────────────────────────────────────────────────
  if (intro && isGroup) {
    return (
      <div className="vs-screen group-intro" onClick={() => setIntro(false)} role="presentation">
        <div className="vs-mark">GO!</div>
        <strong className="group-intro-title">{players.length} racers · same 10 questions</strong>
        <div className="group-intro-avatars">
          {players.map((p) => (
            <span key={p.user_id} className={p.user_id === user.id ? 'me' : ''}>
              <Avatar name={avatarName(p.username)} size={52} />
              <small>{p.user_id === user.id ? 'You' : shownName(p.username)}</small>
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (intro) {
    return (
      <div className="vs-screen" onClick={() => setIntro(false)} role="presentation">
        <div className="vs-side vs-left">
          <Avatar name={me.username} size={96} />
          <strong>{me.username}</strong>
          {me.rating != null && <RankBadge rating={me.rating} />}
        </div>
        <div className="vs-mark">VS</div>
        <div className="vs-side vs-right">
          <Avatar name={opponent?.username} size={96} />
          <strong>{opponent?.username}</strong>
          {opponent?.rating != null && <RankBadge rating={opponent.rating} />}
        </div>
      </div>
    )
  }

  const hud = (
    <div className="match-hud">
      <HudPlayer player={me} score={scoreOf(user.id)} isMe side="left" />
      <div className="hud-center">
        <TimerRing remaining={remaining} total={timerSeconds} />
        {!connected && <span className="hud-offline" role="status">Reconnecting…</span>}
        <button type="button" className="hud-leave" onClick={() => setConfirmLeave(true)} title={isGroup ? 'Leave the race' : 'Leave the match — your opponent wins'}>
          🏳️ Leave
        </button>
      </div>
      {isGroup ? (
        <div className="hud-player hud-right hud-rank" key={opponentPulse}>
          <span className="hud-rank-num">{MEDAL[myLiveRank] || `#${myLiveRank}`}</span>
          <span className="muted">of {racing.length}</span>
        </div>
      ) : opponent ? (
        <HudPlayer player={opponent} score={scoreOf(opponent.user_id)} side="right" pulse={opponentPulse} key={opponentPulse} />
      ) : (
        <div className="hud-player hud-right" />
      )}
    </div>
  )

  const standings = isGroup && (
    <>
      <GroupStandings players={players} scoreboard={scoreboard} me={user.id} />
      {leftNotice && <p className="group-left-note" role="status">{leftNotice}</p>}
    </>
  )

  const leaveDialog = confirmLeave && (
    <LeaveMatchDialog
      matchId={matchId}
      rated={!isBotMatch && !isGroup}
      group={isGroup}
      onClose={() => setConfirmLeave(false)}
      onLeft={() => (isGroup ? navigate('/app/dashboard', { replace: true }) : setConfirmLeave(false))}
    />
  )

  // ── All questions answered — waiting for opponent ────────────────────
  if (allDone) {
    return (
      <div className="page match-page">
        {hud}
        {standings}
        <div className="waiting-all-done">
          <div className="spinner" />
          {unacked > 0 ? (
            <>
              <h2>{connected ? 'Sending your answers…' : 'Reconnecting…'}</h2>
              <p className="muted">
                {unacked} answer{unacked === 1 ? '' : 's'} not confirmed by the server yet — they'll be sent
                automatically{connected ? '' : ' as soon as the connection is back'}.
              </p>
            </>
          ) : (
            <>
              <h2>All answers in</h2>
              <p className="muted">
                {isGroup
                  ? 'Waiting for the other racers… the race ends when everyone finishes or the timer runs out.'
                  : 'Waiting for your opponent… the match ends when they finish or the timer runs out.'}
              </p>
            </>
          )}
          <ProgressDots questions={questions} current={-1} stateOf={dotState} />
        </div>
        {leaveDialog}
      </div>
    )
  }

  // ── Active question ──────────────────────────────────────────────────
  return (
    <div className="page match-page">
      {hud}
      {standings}

      <div className="match-progress" aria-label={`${answeredCount} of ${questions.length} answered`}>
        <span style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {error && <div className="alert-error">{error}</div>}

      <QuestionCard
        key={question.id}
        question={question}
        index={current}
        total={questions.length}
        selectedId={selected}
        onSelect={selectOption}
        locked={alreadyAnswered}
        floater={floater}
      >
        {alreadyAnswered ? (
          <p className={`answer-status ${graded[question.id] ? (graded[question.id].correct ? 'good' : 'bad') : ''}`}>
            {graded[question.id]
              ? graded[question.id].correct
                ? `✓ Correct · +${graded[question.id].points}`
                : '✗ Wrong answer'
              : connected
                ? '⏳ Sending…'
                : '⚠️ Reconnecting — your answer will be sent'}
          </p>
        ) : (
          <KeyHint action="lock in">
            {selected && (
              <button type="button" className="btn-ghost small" onClick={clearSelection}>
                Clear
              </button>
            )}
          </KeyHint>
        )}
      </QuestionCard>

      <div className="match-nav">
        <ProgressDots questions={questions} current={current} stateOf={dotState} onJump={setCurrent} />
        <button
          className={selected && !alreadyAnswered ? 'btn-primary btn-lg' : 'btn-ghost'}
          onClick={goNext}
          disabled={nextDisabled}
        >
          {nextLabel}
        </button>
      </div>
      {leaveDialog}
    </div>
  )
}
