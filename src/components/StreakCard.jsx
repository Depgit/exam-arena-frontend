import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStreak } from '../context/StreakContext'
import { countdown } from '../lib/night'

const WEEKDAY = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'narrow' })

/**
 * Lobby card: the daily play streak, the last 7 days, and what to do today
 * — keep it alive before midnight, or come back tomorrow.
 */
export default function StreakCard({ inline = false }) {
  const { streak } = useStreak()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!streak?.at_risk) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [streak?.at_risk])

  if (!streak) return null
  const { current, best, played_today: today, at_risk: atRisk } = streak
  const left = new Date(streak.resets_at).getTime() - now

  let message
  if (today) message = <>✓ Today counts. Come back tomorrow to make it <strong>{current + 1}</strong>.</>
  else if (atRisk) message = <>Your streak ends in <strong className="streak-left">{countdown(left)}</strong> — finish one match or the daily to keep it.</>
  else if (best > 0) message = <>Start a new streak today — your best is <strong>{best}</strong> days.</>
  else message = <>Finish a match or the daily challenge every day to build a streak.</>

  if (inline) {
    const short = today
      ? 'Done for today ✓'
      : atRisk
        ? <>Ends in <strong className="streak-left">{countdown(left)}</strong></>
        : 'Play today to start one'
    return (
      <div className={`streak-inline ${atRisk ? 'at-risk' : ''} ${today ? 'done' : ''}`} aria-label={`${current}-day streak`}>
        <div className="streak-inline-top">
          <span className="streak-inline-flame" aria-hidden="true">{current > 0 ? '🔥' : '🪵'}</span>
          <span className="streak-inline-count">
            <strong>{current}</strong> day streak
          </span>
        </div>
        <ol className="streak-week mini" aria-label="Last 7 days">
          {streak.week.map((d, i) => (
            <li key={d.date} className={`${d.played ? 'on' : ''} ${i === 6 ? 'today' : ''}`} title={d.date}>
              <span className="streak-dot" />
              <span className="streak-day">{WEEKDAY(d.date)}</span>
            </li>
          ))}
        </ol>
        <span className="streak-inline-msg">{short}</span>
      </div>
    )
  }

  return (
    <section className={`streak-card ${atRisk ? 'at-risk' : ''} ${today ? 'done' : ''}`} aria-label="Daily streak">
      <div className="streak-flame" aria-hidden="true">{current > 0 ? '🔥' : '🪵'}</div>
      <div className="streak-body">
        <div className="streak-title">
          <strong>{current}</strong> day{current === 1 ? '' : 's'} streak
          {best > current && <span className="muted"> · best {best}</span>}
        </div>
        <p className="streak-msg">{message}</p>
        <ol className="streak-week" aria-label="Last 7 days">
          {streak.week.map((d, i) => (
            <li key={d.date} className={`${d.played ? 'on' : ''} ${i === 6 ? 'today' : ''}`} title={d.date}>
              <span className="streak-dot">{d.played ? '🔥' : ''}</span>
              <span className="streak-day">{i === 6 ? 'Today' : WEEKDAY(d.date)}</span>
            </li>
          ))}
        </ol>
      </div>
      {!today && (
        <div className="streak-cta">
          <Link to="/app/matchmaking" className="btn-primary">⚔️ Play a match</Link>
          <Link to="/app/daily" className="btn-ghost">📅 Daily</Link>
        </div>
      )}
    </section>
  )
}
