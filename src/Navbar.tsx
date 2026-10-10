import { useState } from 'react'
import { usePreferences } from './preferencesContext'
import { getAudioPreferences, unlockAudio, updateAudioPreferences } from './audio/audioEngine'
import './Navbar.css'

type NavbarProps = {
  agentName: string
  onSignOut: () => void
}

export default function Navbar({ agentName, onSignOut }: NavbarProps) {
  const { language, setLanguage, audioEnabled, toggleAudio, audioError, t } = usePreferences()
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const preferences = getAudioPreferences()
    return preferences.musicEnabled || preferences.effectsEnabled
  })

  async function toggleAllSound() {
    const enabled = !soundEnabled
    const preferences = getAudioPreferences()
    updateAudioPreferences({
      ...preferences,
      musicEnabled: enabled,
      effectsEnabled: enabled,
    })
    if (enabled) unlockAudio()
    setSoundEnabled(enabled)
    if (enabled !== audioEnabled) await toggleAudio()
  }

  return (
    <header className="mazora-navbar">
      <a className="mazora-navbar-brand" href="/" aria-label="MAZORA home">
        <img src="/images/mazora-logo-transparent.png" alt="" />
        <span>MAZORA</span>
      </a>
      <div className="mazora-navbar-actions">
        <div className="mazora-navbar-language" role="group" aria-label={t('preferences.language')}>
          <button type="button" className={language === 'en' ? 'is-active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
          <button type="button" className={language === 'ar' ? 'is-active' : ''} aria-pressed={language === 'ar'} onClick={() => setLanguage('ar')}>AR</button>
        </div>
        <button
          className={`mazora-navbar-sound${soundEnabled ? ' is-active' : ''}`}
          type="button"
          onClick={() => void toggleAllSound()}
          aria-label={soundEnabled ? 'Mute sound and ambient audio' : 'Enable sound and ambient audio'}
          aria-pressed={soundEnabled}
          title={soundEnabled ? 'Mute sound and ambient audio' : 'Enable sound and ambient audio'}
        >
          <span aria-hidden="true">{soundEnabled ? '♫' : '♪̸'}</span>
          <span className="mazora-navbar-sound-label">{soundEnabled ? 'SOUND ON' : 'SOUND OFF'}</span>
        </button>
        <div className="mazora-navbar-agent">
          <span className="mazora-navbar-agent-avatar" aria-hidden="true">{agentName.slice(0, 1).toUpperCase()}</span>
          <span><small>AGENT</small><strong>{agentName}</strong></span>
        </div>
        <button className="mazora-navbar-signout" type="button" onClick={onSignOut}>{t('home.signOut')}</button>
      </div>
      {audioError && <span className="mazora-navbar-audio-error" role="status">{audioError}</span>}
    </header>
  )
}
