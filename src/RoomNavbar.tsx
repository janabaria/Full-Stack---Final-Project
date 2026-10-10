import PreferenceControls from './PreferenceControls'
import { usePreferences } from './preferencesContext'
import { translateRoomText } from './roomTranslations'
import './RoomNavbar.css'

type RoomNavbarProps = {
  playerName: string
  onBackHome: () => void
}

export default function RoomNavbar({ playerName, onBackHome }: RoomNavbarProps) {
  const { language } = usePreferences()
  return (
    <header className="room-navbar">
      <a className="room-navbar-brand" href="/" onClick={(event) => {
        event.preventDefault()
        onBackHome()
      }} aria-label="MAZORA">
        <span className="room-navbar-mark">
          <img src="/images/mazora-logo-transparent.png" alt="" />
        </span>
        <span>MAZORA</span>
      </a>
      <nav className="room-navbar-links" aria-label="Room navigation">
        <a href="/" onClick={(event) => {
          event.preventDefault()
          onBackHome()
        }}>
          <span aria-hidden="true">←</span> {translateRoomText('BACK TO HOME', language)}
        </a>
      </nav>
      <div className="room-navbar-right">
        <PreferenceControls inline />
        <div className="room-navbar-player">
          <span className="room-navbar-online-dot" />
          <span className="room-navbar-player-name">{playerName}</span>
          <span className="room-navbar-avatar" aria-hidden="true">
            {playerName.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}
