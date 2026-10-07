import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { getMatch } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket, useWSListener } from '../../context/WebSocketContext'
import { useSmoothCountdown } from '../../hooks/useSmoothCountdown'
import { useCountUp } from '../../hooks/useCountUp'
import { Avatar, Confetti, RankBadge, TimerRing } from '../../components/game/game'
import QuestionCard, { KeyHint, ProgressDots, sortOptions, useAnswerKeys } from '../../components/game/QuestionCard'
import * as sfx from '../../lib/sfx'
import { haptic, HAPTIC } from '../../lib/haptics'

const INTRO_MS = 1400

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
  const { send } = useWebSocket()

  const [questions, setQuestions] = useState(location.state?.questions || [])
  const [players, setPlayers] = useState(location.state?.players || [])
  const [timerSeconds, setTimerSeconds] = useState(location.state?.timer_seconds ?? null)
  // Last authoritative clock reading from the server. The server only speaks
  // every 10 seconds, so useSmoothCountdown interpolates between readings —
  // see the hook for why the client is allowed to do that.
  const [serverRemaining, setServerRemaining] = useState(location.state?.timer_seconds ?? null)
  const remaining = useSmoothCountdown(serverRemaining)
  const [scoreboard, setScoreboard] = useState([])
  const [answeredIds, setAnsweredIds] = useState(new Set()) // acknowledged by the server
  const [sentIds, setSentIds] = useState(new Set()) // sent, maybe not yet acknowledged
  // questionId → { correct, points } for this player's graded answers.
  const [graded, setGraded] = useState({})
  const [current, setCurrent] = useState(0)
  // questionId → optionId. A selection is only a draft: it can be changed or
  // cleared, and is sent (and scored) when the player presses Next.
  const [selections, setSelections] = useState({})
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [floater, setFloater] = useState(null) // { id, text, kind }
  const [opponentPulse, setOpponentPulse] = useState(0)
  // VS splash only for a fresh match (arrived via match_start), not a refresh.
  const [intro, setIntro] = useState(Boolean(location.state?.players?.length))
  const questionStartRef = useRef(Date.now())

  // If we arrived here without router state (e.g. page refresh), hydrate
  // from the REST endpoint instead. Completed matches show final results.
  useEffect(() => {
    if (questions && questions.length > 0) return
    getMatch(matchId)
      .then(({ data }) => {
        if (data.questions) setQuestions(data.questions)
        if (data.match?.timer_seconds) setTimerSeconds(data.match.timer_seconds)
        if (data.live_scores) setScoreboard(data.live_scores)
        if (data.players?.length && players.length === 0) setPlayers(data.players)
        if (data.match?.status === 'completed') {
          setResults(
            data.players.map((p) => ({
              user_id: p.user_id,
              username: p.username,
              score: p.score,
              rank: p.final_rank,
              correct: null,
              total: null,
              elo_delta: null,
              rating_before: null,
              rating_after: null,
            }))
          )
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

  useWSListener('time_update', (payload) => {
    if (payload.match_id !== matchId) return
    setServerRemaining(payload.remaining_seconds)
  })

  useWSListener('match_end', (payload) => {
    if (payload.match_id !== matchId) return
    setResults(payload.results)
    const me = payload.results?.find((r) => r.user_id === user.id)
    const tied = payload.results?.filter((r) => r.rank === 1).length > 1
    sfx.play(me?.rank === 1 && !tied ? 'victory' : me?.rank === 1 ? 'correct' : 'defeat')
  })

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
      send('submit_answer', {
        match_id: matchId,
        question_id: question.id,
        option_id: selected,
        time_taken_ms: Date.now() - questionStartRef.current,
      })
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

  // ── Results screen ──────────────────────────────────────────────────
  if (results) {
    const sorted = [...results].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    const mine = sorted.find((r) => r.user_id === user.id)
    // The server gives tied players the same rank.
    const isDraw = mine?.rank === 1 && sorted.filter((r) => r.rank === 1).length > 1
    const won = mine?.rank === 1 && !isDraw
    const outcome = isDraw ? 'draw' : won ? 'victory' : mine ? 'defeat' : 'over'
    const title = { draw: 'Draw', victory: 'Victory', defeat: 'Defeat', over: 'Match over' }[outcome]

    return (
      <div className={`page match-results-page outcome-${outcome}`}>
        {won && <Confetti />}
        <div className="results-header">
          <div className="results-trophy" aria-hidden="true">
            {isDraw ? '🤝' : won ? '🏆' : mine ? '💀' : '⚔️'}
          </div>
          <h1 className="results-title">{title}</h1>
          <p className="muted">{mine?.correct != null ? `${mine.correct}/${mine.total} correct` : ''}</p>
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

  // ── VS intro ─────────────────────────────────────────────────────────
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
      </div>
      {opponent ? (
        <HudPlayer player={opponent} score={scoreOf(opponent.user_id)} side="right" pulse={opponentPulse} key={opponentPulse} />
      ) : (
        <div className="hud-player hud-right" />
      )}
    </div>
  )

  // ── All questions answered — waiting for opponent ────────────────────
  if (allDone) {
    return (
      <div className="page match-page">
        {hud}
        <div className="waiting-all-done">
          <div className="spinner" />
          <h2>All questions locked in</h2>
          <p className="muted">Waiting for your opponent… the match ends when they finish or the timer runs out.</p>
          <ProgressDots questions={questions} current={-1} stateOf={dotState} />
        </div>
      </div>
    )
  }

  // ── Active question ──────────────────────────────────────────────────
  return (
    <div className="page match-page">
      {hud}

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
              : '⏳ Locked in…'}
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
    </div>
  )
}
