import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CONTACT = 'depcoder@gmail.com'

const MODES = [
  ['⚔️', 'Ranked', 'You are paired with a player close to your rating. Win to climb, lose and you drop a little.'],
  ['🌀', 'Arena', 'Open to everyone — you face the next waiting player, whatever their rating. The fastest way into a match.'],
  ['🎮', 'Friend Match', 'Create a private room and send the link or code to a friend. Just the two of you.'],
  ['🏁', 'Group Race', 'Up to 8 players answer the same questions at once. Great for a class or a group of friends.'],
  ['🤖', 'vs Bot', 'No one around? Play a bot — Rookie, Ace or Master. Bot matches don’t change your rating.'],
  ['🎯', 'Practice', 'Solve questions at your own pace by subject. No opponent, no rating — just practice.'],
  ['📅', 'Daily Challenge', 'The same set of questions for everyone, once a day. Keep your streak going and compare scores.'],
]

/** About Mind Race — public, for anyone who wants to know what it is. */
export default function About() {
  const { user } = useAuth()
  const home = user ? '/app/dashboard' : '/'

  return (
    <div className="legal-page">
      <article className="legal-card about-card">
        <Link to={home} className="legal-back">← Mind Race</Link>

        <header className="about-hero">
          <span className="about-mark" aria-hidden="true">⚡</span>
          <h1>About Mind Race</h1>
          <p className="about-lead">
            Mind Race is a free, live 1v1 battle game for <strong>maths and logical reasoning</strong>. Two players
            get the same questions at the same time — the one who answers more correctly, and faster, wins.
          </p>
          <p className="muted">
            Made for school students, especially <strong>classes 9 and 10</strong>, and anyone preparing for
            Olympiads and aptitude tests who wants practice to feel like a game instead of homework.
          </p>
        </header>

        <h2>How a match works</h2>
        <ol className="about-steps">
          <li><strong>Pick a subject</strong> — Maths or Logical Reasoning — and a mode.</li>
          <li><strong>Get matched</strong> with an opponent in seconds, and accept the match.</li>
          <li><strong>Answer 10 questions in 90 seconds.</strong> Both of you see the same questions.</li>
          <li>
            <strong>Score points:</strong> 100 for every correct answer, plus a speed bonus — +50 if you answer
            within 10 seconds, +25 within 30 seconds. Wrong answers score nothing.
          </li>
          <li><strong>See the result</strong> — who won, what you got right, and how your rating changed.</li>
        </ol>
        <p>
          Questions are short and numerical: percentages, ratios, averages, number series, coding–decoding,
          directions, puzzles and more — the kind you meet in school exams and aptitude tests.
        </p>

        <h2>Game modes</h2>
        <div className="about-modes">
          {MODES.map(([icon, title, text]) => (
            <div key={title} className="about-mode">
              <span className="about-mode-icon" aria-hidden="true">{icon}</span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>

        <h2>Rating and leaderboard</h2>
        <p>
          Every player starts at a rating of <strong>1200</strong>. Win a rated match and your rating goes up; lose
          and it goes down. Beating a stronger player earns more than beating a weaker one (it’s the same ELO
          idea used in chess). The <strong>leaderboard</strong> shows the top players, and your profile keeps your
          matches, wins, accuracy and streak.
        </p>

        <h2>🌙 Mind Race Night</h2>
        <p>
          Every evening from <strong>8 to 9 PM (IST)</strong> is Mind Race Night — the busiest hour, when the most
          players are online. Matches come fast, and wins during the hour count towards that night’s own
          leaderboard.
        </p>

        <h2>🎓 College &amp; school events</h2>
        <p>
          Teachers and organisers can run a private event for their class or college. Students join with a code,
          and while the event is live they battle <strong>only each other</strong>. When time runs out, the event
          leaderboard decides the winner, and every participant can download a certificate (winner, runner-up,
          3rd place or participation). Any prize is announced by the organiser. Want to run one? Write to{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>Friends and chat</h2>
        <p>
          Add friends, see when they’re online, and challenge them directly. There is a global chat to talk with
          other players — please keep it friendly. The chat is moderated.
        </p>

        <h2>Free, and safe for students</h2>
        <ul>
          <li><strong>Free to play</strong> — no payments, no coins to buy.</li>
          <li>
            The website shows a few ads (non-personalised) to pay for servers. The Android app has no ads.
          </li>
          <li>We only collect what the game needs. Read the <Link to="/privacy">Privacy Policy</Link>.</li>
          <li>
            Spotted a wrong question? Use the report (🚩) button on it — we check every report.
          </li>
        </ul>

        <h2>Try it</h2>
        <p>
          Not sure yet? Tap <strong>“Look around first”</strong> on the login page — you can explore and play one
          free match against our bot without signing up. Creating an account takes about 20 seconds.
        </p>
        <div className="about-cta">
          {user ? (
            <Link className="btn-primary btn-lg" to="/app/matchmaking">⚔️ Play a match</Link>
          ) : (
            <>
              <Link className="btn-primary btn-lg" to="/register">Create free account</Link>
              <Link className="btn-ghost" to="/login">Log in or try the demo</Link>
            </>
          )}
        </div>

        <h2>Contact</h2>
        <p>
          Questions, ideas or a bug to report? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Mind Race is
          made by a small independent team in India, and we read every message.
        </p>
      </article>
    </div>
  )
}
