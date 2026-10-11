import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNight } from '../api/endpoints'
import { useWSListener } from '../context/WebSocketContext'
import { countdown, downloadIcs, googleCalendarLink, hourLabel } from '../lib/night'
import { Avatar } from './game/game'
import { track } from '../lib/analytics'

/**
 * Mind Race Night on the Lobby: a countdown before it starts, a live
 * "join the race" panel with tonight's standings while it runs, and the
 * night's champion afterwards.
 */
export default function NightBanner({ compact = false, slim = false }) {
  const [night, setNight] = useState(null)
  const [now, setNow] = useState(Date.now())
  const skew = useRef(0) // server clock minus ours

  const load = useCallback(() => {
    getNight()
      .then(({ data }) => {
        skew.current = new Date(data.server_time).getTime() - Date.now()
        setNight(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [load])

  // Standings move while it's live; refresh every 30 seconds.
  useEffect(() => {
    if (night?.phase !== 'live') return
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [night?.phase, load])

  useWSListener('night_event', load)

  // Reload when the countdown reaches the start or the end.
  const serverNow = now + skew.current
  const boundary = night && (night.phase === 'upcoming' ? night.starts_at : night.phase === 'live' ? night.ends_at : null)
  useEffect(() => {
    if (boundary && serverNow >= new Date(boundary).getTime()) load()
  }, [boundary, serverNow >= (boundary ? new Date(boundary).getTime() : Infinity), load]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!night) return null
  const when = `${hourLabel(night.hour)}–${hourLabel((night.hour + Math.ceil(night.minutes / 60)) % 24)}`
  const name = (s) => s.display_name || s.username

  if (night.phase === 'live') {
    const left = new Date(night.ends_at).getTime() - serverNow
    const top = night.standings.slice(0, compact ? 3 : 5)
    return (
      <section className="night-card live" aria-label="Mind Race Night">
        <div className="night-main">
          <span className="night-live-badge">
            <span className="night-pulse" aria-hidden="true" /> LIVE
          </span>
          <h2>Mind Race Night is on</h2>
          <p className="night-sub">
            <strong>{night.online}</strong> online · <strong>{night.playing}</strong> in matches · ends in {countdown(left)}
          </p>
          <Link to="/app/matchmaking" className="btn-primary btn-lg night-join">
            ⚔️ Join the race
          </Link>
        </div>
        <div className="night-board">
          <span className="night-board-title">Tonight's leaders</span>
          {top.length === 0 ? (
            <p className="muted">No results yet — win the first match!</p>
          ) : (
            <ol>
              {top.map((s) => (
                <li key={s.user_id}>
                  <span className="night-rank">{s.rank === 1 ? '👑' : `#${s.rank}`}</span>
                  <Avatar name={name(s)} size={26} />
                  <span className="night-name">{name(s)}</span>
                  <span className="night-score">
                    {s.wins}W <small>/ {s.matches}</small>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    )
  }

  // Slim strip (Lobby) before and after the event; the full card is for live.
  if (slim) {
    const champ = night.phase === 'ended' ? night.standings[0] : night.last_champion
    const until = new Date(night.starts_at).getTime() - serverNow
    return (
      <section className="night-strip-slim" aria-label="Mind Race Night">
        <span className="night-moon" aria-hidden="true">🌙</span>
        <span className="night-slim-text">
          <strong>Mind Race Night</strong>{' '}
          {night.phase === 'upcoming' ? (
            <>· today {hourLabel(night.hour)} · starts in <strong className="night-count">{countdown(until)}</strong></>
          ) : (
            <>· back tomorrow at {hourLabel(night.hour)}</>
          )}
          {champ && <span className="night-slim-champ"> · 👑 {name(champ)}</span>}
        </span>
        <a
          className="btn-ghost small night-slim-btn"
          href={googleCalendarLink(night.next_starts_at, night.minutes)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('share_clicked', { kind: 'night_reminder', channel: 'google_calendar' })}
        >
          🔔 Remind me
        </a>
      </section>
    )
  }

  if (night.phase === 'ended') {
    const champ = night.standings[0]
    return (
      <section className="night-card ended" aria-label="Mind Race Night">
        <div className="night-main">
          <span className="eyebrow">🌙 Mind Race Night · tonight</span>
          {champ ? (
            <h2>
              {name(champ)} <span className="night-crown">is tonight's champion 👑</span>
            </h2>
          ) : (
            <h2>That's a wrap for tonight</h2>
          )}
          <p className="night-sub">
            {champ ? `${champ.wins} wins in ${champ.matches} matches. ` : ''}Next race: tomorrow at {hourLabel(night.hour)}.
          </p>
          <Reminders night={night} />
        </div>
        {night.standings.length > 1 && !compact && (
          <div className="night-board">
            <span className="night-board-title">Final standings</span>
            <ol>
              {night.standings.slice(0, 5).map((s) => (
                <li key={s.user_id}>
                  <span className="night-rank">{s.rank === 1 ? '👑' : `#${s.rank}`}</span>
                  <Avatar name={name(s)} size={26} />
                  <span className="night-name">{name(s)}</span>
                  <span className="night-score">{s.wins}W</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    )
  }

  // upcoming
  const until = new Date(night.starts_at).getTime() - serverNow
  return (
    <section className="night-card upcoming" aria-label="Mind Race Night">
      <div className="night-main">
        <span className="eyebrow">🌙 Mind Race Night · every day {when} IST</span>
        <h2>
          Everyone plays at once — <span className="night-accent">tonight at {hourLabel(night.hour)}</span>
        </h2>
        <p className="night-sub">
          Starts in <strong className="night-count">{countdown(until)}</strong>. Real opponents, live leaderboard, one champion.
          {night.last_champion && <> Last night's champion: <strong>{name(night.last_champion)}</strong> 👑</>}
        </p>
        <Reminders night={night} />
      </div>
    </section>
  )
}

function Reminders({ night }) {
  const invite = `🌙 Mind Race Night tonight at ${hourLabel(night.hour)}! 1v1 math & logic battles — everyone plays at once. Join me 👉 https://mindrace.in/?ref=night`
  return (
    <div className="night-actions">
      <a
        className="btn-primary"
        href={googleCalendarLink(night.next_starts_at, night.minutes)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('share_clicked', { kind: 'night_reminder', channel: 'google_calendar' })}
      >
        🔔 Remind me daily
      </a>
      <a
        className="btn-ghost"
        href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('share_clicked', { kind: 'night_invite', channel: 'whatsapp' })}
      >
        Invite friends
      </a>
      <button
        type="button"
        className="btn-link night-ics"
        onClick={() => {
          track('share_clicked', { kind: 'night_reminder', channel: 'ics' })
          downloadIcs(night.next_starts_at, night.minutes)
        }}
      >
        Apple / Outlook calendar
      </button>
    </div>
  )
}
