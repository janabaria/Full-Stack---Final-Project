import type { TeamLeaderboardEntry } from './GameModeSelector'
import './TeamLeaderboardModal.css'

type TeamLeaderboardModalProps = {
  entries: TeamLeaderboardEntry[]
  onClose: () => void
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function TeamLeaderboardModal({ entries, onClose }: TeamLeaderboardModalProps) {
  return (
    <div className="team-leaderboard-backdrop" role="presentation">
      <section
        className="team-leaderboard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-leaderboard-title"
      >
        <p className="eyebrow-header">MAZORA / TEAM RACE</p>
        <h2 id="team-leaderboard-title">Campaign complete</h2>
        <p className="team-leaderboard-subtitle">Final standings for this team session</p>
        <ol className="team-leaderboard-list">
          {entries.map((entry, index) => (
            <li key={entry.userId}>
              <span className="team-leaderboard-rank">{index + 1}</span>
              <div>
                <strong>{entry.username}</strong>
                <small>{entry.finished ? 'All five rooms cleared' : 'Campaign in progress'}</small>
              </div>
              <strong className="team-leaderboard-score">{entry.score.toLocaleString()} pts</strong>
              <time>{formatDuration(entry.elapsedMs)}</time>
            </li>
          ))}
        </ol>
        <button className="primary-button" type="button" onClick={onClose}>Continue</button>
      </section>
    </div>
  )
}
