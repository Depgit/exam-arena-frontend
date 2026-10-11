import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyReferrals } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import ShareButtons from './share/ShareButtons'
import { Avatar } from './game/game'
import { inviteLink } from '../lib/referral'

/**
 * "Invite friends": your invite link, share buttons, and who joined.
 * full = the /app/invite page; otherwise a compact card for the Lobby.
 */
export default function InviteCard({ full = false }) {
  const { user, isGuest } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (isGuest) return
    getMyReferrals().then(({ data }) => setData(data)).catch(() => {})
  }, [isGuest])

  if (isGuest || !user) return null
  const code = data?.code || user.username
  const link = inviteLink(code)
  const text = `⚡ I'm racing on Mind Race — 1v1 math & logic battles, 90 seconds a match. Join me and we'll be friends right away 👉 ${link}`

  return (
    <section className={`invite-card ${full ? 'full' : ''}`}>
      <div className="invite-head">
        <div>
          <span className="eyebrow">🎁 Invite friends</span>
          <h3>Bring your friends into the race</h3>
          <p className="muted">
            When a friend signs up with your link and verifies their email, it counts — and you're friends instantly.
          </p>
        </div>
        <div className="invite-count" aria-label={`${data?.accepted ?? 0} friends joined`}>
          <strong>{data?.accepted ?? 0}</strong>
          <span>joined</span>
          {data?.pending > 0 && <small>+{data.pending} pending</small>}
        </div>
      </div>
      <div className="invite-link-row">
        <code>{link.replace('https://', '')}</code>
      </div>
      <ShareButtons kind="referral" label="Share invite" text={text} />
      {full && (
        <div className="invite-list">
          <h4>Who joined</h4>
          {!data?.friends?.length ? (
            <p className="muted">No one yet — your first invite is one tap away.</p>
          ) : (
            <ul>
              {data.friends.map((f) => (
                <li key={f.username}>
                  <Avatar name={f.display_name} size={32} />
                  <strong className="invite-name">{f.display_name}</strong>
                  <span className="muted">@{f.username}</span>
                  {f.accepted_at ? (
                    <span className="verified-tag">✓ counted</span>
                  ) : (
                    <span className="unverified-tag" title="Counts once they verify their email">pending</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!full && (
        <Link to="/app/invite" className="invite-more">
          See who joined →
        </Link>
      )}
    </section>
  )
}
