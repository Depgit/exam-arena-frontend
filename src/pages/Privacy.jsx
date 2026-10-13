import { Link } from 'react-router-dom'

const CONTACT = 'depcoder@gmail.com'
const UPDATED = '13 October 2026'

/** Privacy policy — public, linked from sign-up and the Play Store listing. */
export default function Privacy() {
  return (
    <div className="legal-page">
      <article className="legal-card">
        <Link to="/" className="legal-back">← Mind Race</Link>
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: {UPDATED}</p>

        <p>
          Mind Race (“we”, “us”) is a maths and logical reasoning game at mindrace.in and in our Android app.
          This policy explains what information we collect, why, and the choices you have. If you have any
          question, write to us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>Who can use Mind Race</h2>
        <p>
          Mind Race is made for school students, especially classes 9 and 10. If you are under 18, please use
          Mind Race with the permission of a parent or guardian, and ask them to read this policy with you. A
          parent or guardian can contact us at any time to see or delete their child’s account.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> your username, email address and password (stored only in
            scrambled, hashed form — we can’t read it). If you sign in with Google, we receive your name, email
            address and profile picture from Google.
          </li>
          <li>
            <strong>Profile you choose to add:</strong> a display name, and a new username if you change it.
          </li>
          <li>
            <strong>Game activity:</strong> your matches, answers, scores, ratings, rankings, streaks, daily
            challenges and practice sessions.
          </li>
          <li>
            <strong>Friends and challenges:</strong> friend requests, your friends list and the challenges you
            send or receive.
          </li>
          <li>
            <strong>Chat:</strong> messages you post in the global chat. These are visible to every player.
          </li>
          <li>
            <strong>Question reports:</strong> when you report a question as wrong or unclear.
          </li>
          <li>
            <strong>Usage information:</strong> when you were last active, and simple first-party analytics —
            a random ID kept in your browser, which pages you open and how you found us (for example a shared
            link). We do not use advertising trackers or third-party analytics, and we don’t use cookies for
            tracking.
          </li>
          <li>
            <strong>Technical information:</strong> like any website, our hosting providers may record your IP
            address and device or browser type to keep the service secure and working.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To run the game: create your account, match you with opponents, keep scores, ratings and streaks.</li>
          <li>To show your username, rating and results to other players (in matches, leaderboards and profiles).</li>
          <li>To send emails you need, such as a sign-in or verification code.</li>
          <li>To keep Mind Race safe: stop spam and cheating, and moderate chat.</li>
          <li>To improve the game, for example which questions are too hard or too easy.</li>
        </ul>
        <p>We do not sell your information, and we do not show personalised ads.</p>

        <h2>What other players can see</h2>
        <p>
          Your username (and display name, if you set one), your rating, match results, streaks and chat
          messages are visible to other players. Your email address and password are never shown to anyone.
        </p>

        <h2>How matches work</h2>
        <p>
          When no other player is available, you may be matched with a computer-controlled opponent so that you
          don’t have to wait. These opponents collect no information about you beyond the match itself.
        </p>

        <h2>Services we use</h2>
        <p>
          We use trusted providers to run Mind Race. They process information only to provide their service to
          us:
        </p>
        <ul>
          <li>Cloudflare — hosts the website and app.</li>
          <li>Render — runs our game server.</li>
          <li>Supabase — stores our database.</li>
          <li>Resend — sends our emails.</li>
          <li>Google — “Sign in with Google”, if you choose to use it.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li>Your account and game history are kept while your account exists.</li>
          <li>Demo (guest) accounts are deleted automatically after 3 days.</li>
          <li>Only the most recent chat messages are kept; older ones are deleted automatically.</li>
          <li>When you ask us to delete your account, we delete your personal information within 30 days.</li>
        </ul>

        <h2 id="delete-account">Your choices and rights (including deleting your account)</h2>
        <ul>
          <li>You can change your display name and username in your profile.</li>
          <li>
            You can ask us for a copy of your information, to correct it, or to delete your account and its
            data. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the email address on your account (or,
            for a child’s account, the parent or guardian can write to us). We reply within 7 days.
          </li>
          <li>You can remove the app or stop using the website at any time.</li>
        </ul>

        <h2>Keeping it safe</h2>
        <p>
          Passwords are stored hashed, connections use HTTPS, and only our team can access the admin tools. No
          system is perfectly secure, but we work to protect your information.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we change this policy, we’ll update the date at the top. For important changes, we’ll tell you in
          the app.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, requests or concerns: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </article>
    </div>
  )
}
