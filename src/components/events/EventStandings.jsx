import { Avatar } from '../game/game'

/** An event's leaderboard: wins, then points. The leader gets a crown once it ends. */
export default function EventStandings({ standings, meId, ended }) {
  if (!standings?.length) return <p className="muted">No one has joined yet.</p>
  return (
    <table className="leaderboard-table event-standings">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th className="num">Wins</th>
          <th className="num">Matches</th>
          <th className="num">Points</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s) => {
          const name = s.display_name || s.username
          const winner = ended && s.rank === 1 && s.matches > 0
          return (
            <tr key={s.user_id} className={s.user_id === meId ? 'me' : ''}>
              <td>{winner ? '👑' : `#${s.rank}`}</td>
              <td>
                <span className="lb-player">
                  <Avatar name={name} size={28} />
                  <span className="lb-player-name">{name}{s.user_id === meId ? ' (you)' : ''}</span>
                </span>
              </td>
              <td className="num">{s.wins}</td>
              <td className="num">{s.matches}</td>
              <td className="num">{s.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
