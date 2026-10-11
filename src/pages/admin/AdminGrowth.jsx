import { useEffect, useState } from 'react'
import { getAdminGrowth, getAdminReferrals } from '../../api/endpoints'

const PERIODS = [7, 14, 30]
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null)
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const SHARE_NAMES = { daily: 'Daily score', match: 'Match result', invite: 'Room invite', referral: 'Invite link', night_reminder: 'Night reminder', night_invite: 'Night invite', other: 'Other' }

function Tile({ label, value, sub, hero }) {
  return (
    <div className={`kpi-card ${hero ? 'growth-hero' : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="muted">{sub}</span>}
    </div>
  )
}

// One measure per day as thin bars; hover a bar for its value.
function DailyBars({ title, rows, field, note }) {
  const max = Math.max(1, ...rows.map((r) => r[field]))
  const total = rows.reduce((s, r) => s + r[field], 0)
  return (
    <figure className="growth-chart">
      <figcaption>
        <span>{title}</span>
        <strong>{total}</strong>
      </figcaption>
      <div className="growth-bars" role="img" aria-label={`${title} per day`}>
        {rows.map((r) => (
          <span key={r.date} className="growth-bar-slot" data-tip={`${shortDate(r.date)}: ${r[field]}`}>
            <span className="growth-bar" style={{ height: `${(r[field] / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <div className="growth-axis">
        <span>{shortDate(rows[0].date)}</span>
        <span>{note || 'today'}</span>
      </div>
    </figure>
  )
}

function Ranked({ title, items, empty, names = {} }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="form-card growth-ranked">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.name}>
              <span className="growth-ranked-name">{names[i.name] || i.name}</span>
              <span className="growth-ranked-track">
                <span style={{ width: `${(i.count / max) * 100}%` }} />
              </span>
              <strong>{i.count}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Every player who has invited someone: accepted (signed up + verified)
// and pending (signed up, not verified yet). Searchable by name.
function Referrals() {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    getAdminReferrals().then(({ data }) => setList(data || [])).catch(() => setList([]))
  }, [])
  const needle = q.trim().toLowerCase()
  const shown = (list || []).filter((r) => !needle || r.username.toLowerCase().includes(needle) || r.display_name.toLowerCase().includes(needle))
  const total = (list || []).reduce((s, r) => s + r.accepted, 0)
  return (
    <section className="form-card">
      <div className="growth-section-head">
        <div>
          <h3>Referrals</h3>
          <p className="muted growth-hint">
            Counted when the invited player signs up and verifies their email. {total} accepted in total.
          </p>
        </div>
        <input
          className="growth-search"
          type="search"
          placeholder="Find a player…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Find a player"
        />
      </div>
      <div className="table-scroll">
        <table className="growth-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Accepted</th>
              <th>Pending</th>
              <th>Last accepted</th>
            </tr>
          </thead>
          <tbody>
            {list == null && (
              <tr><td colSpan={4} className="muted">Loading…</td></tr>
            )}
            {list && shown.length === 0 && (
              <tr><td colSpan={4} className="muted">{list.length ? 'No player matches.' : 'No referrals yet.'}</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.user_id}>
                <td>
                  {r.display_name} <span className="muted">@{r.username}</span>
                </td>
                <td><strong>{r.accepted}</strong></td>
                <td>{r.pending}</td>
                <td>{r.last_accepted_at ? shortDate(r.last_accepted_at.slice(0, 10)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function AdminGrowth() {
  const [days, setDays] = useState(14)
  const [g, setG] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setError('')
    getAdminGrowth(days)
      .then(({ data }) => !cancelled && setG(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [days])

  const f = g?.funnel
  const d1 = f ? pct(f.came_back_next_day, f.next_day_eligible) : null
  const steps = f
    ? [
        ['Visitors', f.visitors, 'opened the site'],
        ['Tried the demo', f.demo_started, 'tapped "Look around first"'],
        ['Signed up', f.signups, 'created a real account'],
        ['Finished a match', f.finished_match, 'of those new players'],
        ['Came back next day', f.came_back_next_day, `of ${f.next_day_eligible} whose next day is over`],
      ]
    : []
  const top = Math.max(1, ...steps.map((s) => s[1]))

  return (
    <div className="page growth-page">
      <header className="growth-head">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Growth</h1>
          <p className="muted">
            Days are India time.
            {g?.tracking_since ? ` Visits, demo taps and shares are counted since ${shortDate(g.tracking_since)}.` : ' Visits, demo taps and shares start counting after this deploy.'}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} type="button" className={`segmented-btn ${days === p ? 'selected' : ''}`} aria-pressed={days === p} onClick={() => setDays(p)}>
              {p} days
            </button>
          ))}
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}
      {!g && !error && <div className="page-center"><div className="spinner" /></div>}

      {g && (
        <>
          <div className="kpi-grid">
            <Tile
              hero
              label="Came back next day"
              value={d1 == null ? '—' : `${d1}%`}
              sub={f.next_day_eligible ? `${f.came_back_next_day} of ${f.next_day_eligible} new players` : 'Shows once new players have had a full next day'}
            />
            <Tile label="Visitors" value={f.visitors} sub={`last ${days} days`} />
            <Tile label="New players" value={f.signups} sub={`${f.demo_started} tried the demo`} />
            <Tile
              label="Finished a match"
              value={pct(f.finished_match, f.signups) == null ? '—' : `${pct(f.finished_match, f.signups)}%`}
              sub={`${f.finished_match} of ${f.signups} new players`}
            />
          </div>

          <section className="form-card growth-funnel">
            <h3>From visit to coming back</h3>
            <ol>
              {steps.map(([label, n, note]) => (
                <li key={label}>
                  <span className="funnel-label">
                    <strong>{label}</strong>
                    <span className="muted">{note}</span>
                  </span>
                  <span className="funnel-track">
                    <span style={{ width: `${Math.max(n ? 2 : 0, (n / top) * 100)}%` }} />
                  </span>
                  <strong className="funnel-n">{n}</strong>
                </li>
              ))}
            </ol>
            <p className="muted growth-hint">
              Early on, watch the last two steps: a player who finishes a match and comes back the next day is the
              one who stays.
            </p>
          </section>

          <div className="growth-charts">
            <DailyBars title="Visitors" rows={g.daily} field="visitors" />
            <DailyBars title="New players" rows={g.daily} field="signups" />
            <DailyBars title="Active players" rows={g.daily} field="active_players" />
          </div>

          <section className="form-card">
            <h3>Do new players come back?</h3>
            <p className="muted growth-hint">Each row is the players who signed up that day.</p>
            <div className="table-scroll">
              <table className="growth-table">
                <thead>
                  <tr>
                    <th>Signed up</th>
                    <th>New players</th>
                    <th>Finished a match</th>
                    <th>Back next day</th>
                    <th>Back within 7 days</th>
                  </tr>
                </thead>
                <tbody>
                  {g.cohorts.length === 0 && (
                    <tr><td colSpan={5} className="muted">No sign-ups in this period.</td></tr>
                  )}
                  {g.cohorts.map((c) => (
                    <tr key={c.date}>
                      <td>{shortDate(c.date)}</td>
                      <td>{c.signups}</td>
                      <td>{c.finished_match} <span className="muted">({pct(c.finished_match, c.signups)}%)</span></td>
                      <td>
                        {!c.tracked ? (
                          <span className="muted" title="Return visits are recorded from the tracking start date">not tracked</span>
                        ) : c.d1_complete ? (
                          <>{c.returned_d1} <span className="muted">({pct(c.returned_d1, c.signups)}%)</span></>
                        ) : (
                          <span className="muted">{c.returned_d1} so far…</span>
                        )}
                      </td>
                      <td>
                        {!c.tracked ? (
                          <span className="muted">not tracked</span>
                        ) : (
                          <>
                            {c.returned_d7}{' '}
                            <span className="muted">{c.d7_complete ? `(${pct(c.returned_d7, c.signups)}%)` : 'so far…'}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="two-col">
            <Ranked title="Where visitors come from" items={g.sources} empty="No visits recorded yet." />
            <Ranked title="What gets shared" items={g.shares} empty="No shares yet." names={SHARE_NAMES} />
          </div>

          <Referrals />

          <section className="form-card">
            <h3>Day by day</h3>
            <div className="table-scroll">
              <table className="growth-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Visitors</th>
                    <th>Tried demo</th>
                    <th>New players</th>
                    <th>Active players</th>
                    <th>Matches</th>
                    <th>Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {[...g.daily].reverse().map((r) => (
                    <tr key={r.date}>
                      <td>{r.date === g.today ? 'Today' : shortDate(r.date)}</td>
                      <td>{r.visitors}</td>
                      <td>{r.demo_started}</td>
                      <td>{r.signups}</td>
                      <td>{r.active_players}</td>
                      <td>{r.matches_finished}</td>
                      <td>{r.shares}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
