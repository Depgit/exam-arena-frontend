import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getEvent } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import EventStandings from '../../components/events/EventStandings'
import { certificatePlace, drawCertificate, shareOrDownload } from '../../lib/certificate'
import { PHASE_LABEL, fmtWhen, fmtLeft, durationLabel } from '../../components/events/eventTime'

const REFRESH_MS = 15000

/** One college event: countdown, "Find opponent" while live, and the leaderboard. */
export default function EventPage() {
  const { eventId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [skew, setSkew] = useState(0) // server clock − this device's clock
  const [certBusy, setCertBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () =>
      getEvent(eventId)
        .then(({ data }) => {
          if (!alive) return
          setDetail(data)
          setSkew(new Date(data.server_time).getTime() - Date.now())
        })
        .catch((err) => alive && setError(err.message))
    load()
    const refresh = setInterval(load, REFRESH_MS)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      alive = false
      clearInterval(refresh)
      clearInterval(tick)
    }
  }, [eventId])

  if (error) {
    return (
      <div className="page">
        <div className="alert-error">{error}</div>
        <Link to="/app/events" className="btn-ghost">← Events</Link>
      </div>
    )
  }
  if (!detail) return <div className="page"><p className="muted">Loading event…</p></div>

  const ev = detail.event
  const serverNow = now + skew
  const starts = new Date(ev.starts_at).getTime()
  const ends = new Date(ev.ends_at).getTime()
  const phase = ev.cancelled_at ? 'cancelled' : serverNow < starts ? 'upcoming' : serverNow < ends ? 'live' : 'ended'
  const leader = detail.standings[0]
  const certPlace = phase === 'ended' ? certificatePlace(detail.me) : null

  async function getCertificate() {
    if (certBusy || certPlace == null) return
    setCertBusy(true)
    try {
      const canvas = await drawCertificate({
        name: user.display_name || user.username,
        place: certPlace,
        eventName: ev.name,
        subject: ev.category_name,
        date: new Date(ev.starts_at),
        wins: detail.me.wins,
        points: detail.me.points,
        certId: `MR-${ev.id.slice(0, 6)}-${user.id.slice(0, 4)}`.toUpperCase(),
      })
      await shareOrDownload(canvas, `mindrace-certificate-${ev.code || 'event'}.png`, `My certificate from ${ev.name} on Mind Race 🎓 mindrace.in`)
    } finally {
      setCertBusy(false)
    }
  }

  return (
    <div className="page event-page">
      <Link to="/app/events" className="event-back">← Events</Link>
      <header className={`event-hero phase-${phase}`}>
        <span className={`event-phase ${phase}`}>{PHASE_LABEL[phase]}</span>
        <h1>{ev.name}</h1>
        <p className="muted">{ev.category_name} · {fmtWhen(ev.starts_at)} · {durationLabel(ev)} · 👥 {ev.members} joined</p>
        {ev.prize && <p className="event-prize">🎁 Prize: <strong>{ev.prize}</strong></p>}

        {phase === 'upcoming' && (
          <div className="event-clock"><span>Starts in</span><strong>{fmtLeft(starts - serverNow)}</strong></div>
        )}
        {phase === 'live' && (
          <>
            <div className="event-clock live"><span>Ends in</span><strong>{fmtLeft(ends - serverNow)}</strong></div>
            <button className="btn-primary btn-xl" onClick={() => navigate(`/app/matchmaking?event=${ev.id}`)}>
              ⚔️ Find opponent
            </button>
            <p className="muted small">You'll only be matched with players in this event. Every win counts here — and for your rating.</p>
          </>
        )}
        {phase === 'ended' && leader && leader.matches > 0 && (
          <div className="event-winner">👑 Winner: <strong>{leader.display_name || leader.username}</strong> · {leader.wins} wins</div>
        )}
        {phase === 'cancelled' && <p className="muted">This event was cancelled.</p>}
        {detail.me && phase !== 'cancelled' && (
          <p className="event-me">Your rank: <strong>#{detail.me.rank}</strong> · {detail.me.wins} wins · {detail.me.points} pts</p>
        )}
        {certPlace != null && (
          <button className="btn-primary btn-lg" onClick={getCertificate} disabled={certBusy}>
            {certBusy ? 'Making your certificate…' : certPlace > 0 ? '🏅 Get your certificate' : '🎓 Get your participation certificate'}
          </button>
        )}
        {phase === 'ended' && detail.me && certPlace == null && (
          <p className="muted small">Play at least one match in an event to earn a certificate.</p>
        )}
      </header>

      <section>
        <h2>Leaderboard</h2>
        <EventStandings standings={detail.standings} meId={user.id} ended={phase === 'ended'} />
      </section>
    </div>
  )
}
