import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getMyEvents, joinEvent } from '../../api/endpoints'
import { PHASE_LABEL, phaseOf, fmtWhen, durationLabel } from '../../components/events/eventTime'

/** College events: join one with its code, and see the ones you're in. */
export default function Events() {
  const [params] = useSearchParams()
  const [code, setCode] = useState((params.get('code') || '').toUpperCase())
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getMyEvents().then(({ data }) => setEvents(data ?? [])).catch((err) => setError(err.message))
  }, [])

  async function join(e) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const { data } = await joinEvent(code.trim())
      navigate(`/app/events/${data.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">College events</span>
        <h1>Events</h1>
        <p className="muted">Got a code from your college? Join the event, then race your classmates while it's live.</p>
      </header>
      {error && <div className="alert-error">{error}</div>}

      <form className="form-card event-join" onSubmit={join}>
        <h3>🎓 Join an event</h3>
        <div className="event-join-row">
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EVENT CODE"
            maxLength={12}
            aria-label="Event code"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn-primary btn-lg" type="submit" disabled={busy || code.trim().length < 4}>
            {busy ? 'Joining…' : 'Join'}
          </button>
        </div>
      </form>

      <section>
        <h2>Your events</h2>
        {events === null && <p className="muted">Loading…</p>}
        {events && events.length === 0 && <p className="muted">You haven't joined any events yet.</p>}
        <div className="event-list">
          {events?.map((ev) => {
            const phase = phaseOf(ev)
            return (
              <Link key={ev.id} to={`/app/events/${ev.id}`} className={`event-card phase-${phase}`}>
                <span className={`event-phase ${phase}`}>{PHASE_LABEL[phase]}</span>
                <strong className="event-name">{ev.name}</strong>
                <span className="muted">{ev.category_name} · {fmtWhen(ev.starts_at)} · {durationLabel(ev)}</span>
                <span className="muted">👥 {ev.members} joined</span>
                {ev.prize && <span className="event-prize">🎁 {ev.prize}</span>}
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
