import { useCallback, useEffect, useState } from 'react'
import { adminCreateEvent, adminEvents, adminEvent, adminCancelEvent, getSubjects } from '../../api/endpoints'
import { useConfirm } from '../../context/ConfirmContext'
import EventStandings from '../../components/events/EventStandings'
import { PHASE_LABEL, phaseOf, fmtWhen, durationLabel } from '../../components/events/eventTime'

const DURATIONS = [30, 45, 60, 90, 120, 180]

// "2026-10-20T15:30" for a datetime-local input, in this device's time.
function localInput(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Admin: create college events, share their codes, watch their leaderboards. */
export default function AdminEvents() {
  const confirm = useConfirm()
  const [subjects, setSubjects] = useState([])
  const [events, setEvents] = useState(null)
  const [form, setForm] = useState(() => {
    const start = new Date(Date.now() + 60 * 60 * 1000)
    start.setMinutes(0, 0, 0)
    return { name: '', exam_category_id: '', starts_at: localInput(start), duration_minutes: 60, prize: '' }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(null) // event id whose leaderboard is shown
  const [detail, setDetail] = useState(null)

  const load = useCallback(() => {
    adminEvents().then(({ data }) => setEvents(data ?? [])).catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    load()
    getSubjects().then(({ data }) => {
      setSubjects(data ?? [])
      if (data?.length) setForm((f) => ({ ...f, exam_category_id: f.exam_category_id || data[0].id }))
    })
  }, [load])

  useEffect(() => {
    if (!open) return
    let alive = true
    const fetchDetail = () => adminEvent(open).then(({ data }) => alive && setDetail(data)).catch(() => {})
    fetchDetail()
    const t = setInterval(fetchDetail, 15000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [open])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data } = await adminCreateEvent({
        name: form.name,
        exam_category_id: form.exam_category_id,
        starts_at: new Date(form.starts_at).toISOString(),
        duration_minutes: Number(form.duration_minutes),
        prize: form.prize,
      })
      setNotice(`Created “${data.name}” — join code ${data.code}`)
      setForm((f) => ({ ...f, name: '', prize: '' }))
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`${what} copied`)
    } catch {
      setNotice(text)
    }
  }

  const invite = (ev) =>
    `🎓 ${ev.name} on Mind Race!\n` +
    `${ev.category_name} · ${fmtWhen(ev.starts_at)} · ${durationLabel(ev)}\n` +
    `Join with code ${ev.code}: ${window.location.origin}/app/events?code=${ev.code}`

  async function cancel(ev) {
    const ok = await confirm({
      title: `Cancel “${ev.name}”?`,
      message: 'Players can no longer join or play in it. Matches already played stay in their records.',
      confirmText: 'Cancel event',
      cancelText: 'Keep it',
      tone: 'danger',
      icon: '🗓️',
    })
    if (!ok) return
    try {
      await adminCancelEvent(ev.id)
      setNotice(`“${ev.name}” cancelled`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>College events</h1>
        <p className="muted">Create a private, time-boxed competition. Share the code with the college; members only play each other while it's live.</p>
      </header>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}

      <form className="form-card event-form" onSubmit={create}>
        <h3>New event</h3>
        <label className="field">
          <span className="field-label">Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DPS Noida — Maths Sprint" maxLength={120} required />
        </label>
        <div className="event-form-row">
          <label className="field">
            <span className="field-label">Subject</span>
            <select value={form.exam_category_id} onChange={(e) => setForm({ ...form, exam_category_id: e.target.value })}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Starts</span>
            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field-label">Duration</span>
            <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}>
              {DURATIONS.map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} minutes`}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Prize for the winner <span className="muted">(optional)</span></span>
          <input value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="e.g. ₹500 Amazon coupon" maxLength={200} />
          <span className="field-help">Shown to students on the event. You hand it over yourself after the event — the winner's email appears here.</span>
        </label>
        <button className="btn-primary btn-lg" type="submit" disabled={busy || !form.name.trim()}>
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </form>

      <section>
        <h2>All events</h2>
        {events === null && <p className="muted">Loading…</p>}
        {events && events.length === 0 && <p className="muted">No events yet.</p>}
        <div className="admin-event-list">
          {events?.map((ev) => {
            const phase = phaseOf(ev)
            return (
              <div key={ev.id} className={`admin-event phase-${phase}`}>
                <div className="admin-event-main">
                  <div>
                    <span className={`event-phase ${phase}`}>{PHASE_LABEL[phase]}</span>
                    <strong className="event-name">{ev.name}</strong>
                    <span className="muted">{ev.category_name} · {fmtWhen(ev.starts_at)} · {durationLabel(ev)} · 👥 {ev.members}</span>
                    {ev.prize && <span className="event-prize">🎁 {ev.prize}</span>}
                  </div>
                  <div className="admin-event-actions">
                    <button type="button" className="event-code" onClick={() => copy(ev.code, 'Code')} title="Copy code">{ev.code}</button>
                    <button type="button" className="btn-ghost small" onClick={() => copy(invite(ev), 'Invite message')}>Copy invite</button>
                    <button type="button" className="btn-ghost small" onClick={() => { setDetail(null); setOpen(open === ev.id ? null : ev.id) }}>
                      {open === ev.id ? 'Hide' : 'Leaderboard'}
                    </button>
                    {(phase === 'upcoming' || phase === 'live') && (
                      <button type="button" className="btn-danger small" onClick={() => cancel(ev)}>Cancel</button>
                    )}
                  </div>
                </div>
                {open === ev.id && (
                  <div className="admin-event-board">
                    {detail?.winner_email && (
                      <div className="event-winner-contact">
                        👑 Winner: <strong>{detail.standings[0].display_name || detail.standings[0].username}</strong> ·{' '}
                        <a href={`mailto:${detail.winner_email}?subject=${encodeURIComponent(`Your prize from ${ev.name} — Mind Race`)}`}>{detail.winner_email}</a>
                        {ev.prize && <> · send: <strong>{ev.prize}</strong></>}
                      </div>
                    )}
                    {detail ? <EventStandings standings={detail.standings} ended={detail.phase === 'ended'} /> : <p className="muted">Loading…</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
