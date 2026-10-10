import { useState } from 'react'
import {
  getAudioPreferences,
  playAudioPreview,
  unlockAudio,
  updateAudioPreferences,
  type AudioPreferences,
} from './audioEngine'
import './AudioControls.css'
import { useI18n } from '../useI18n'

function AudioControls() {
  const { t } = useI18n()
  const [preferences, setPreferences] = useState<AudioPreferences>(getAudioPreferences)
  const [expanded, setExpanded] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [previewMessage, setPreviewMessage] = useState('')

  function update(next: AudioPreferences) {
    setPreferences(next)
    updateAudioPreferences(next)
    if (unlockAudio()) setAudioReady(true)
  }

  function enableAudio() {
    if (unlockAudio()) setAudioReady(true)
  }

  async function testSound() {
    if (!preferences.effectsEnabled) {
      const nextPreferences = { ...preferences, effectsEnabled: true }
      setPreferences(nextPreferences)
      updateAudioPreferences(nextPreferences)
    }
    const played = await playAudioPreview()
    setAudioReady(played)
    setPreviewMessage(
      played
        ? 'If you heard the chime, audio is working.'
        : 'Audio could not start. Check this tab’s mute and your device output.',
    )
  }

  return (
    <aside className="audio-controls" aria-label={t('Game audio settings')}>
      <button
        className="audio-controls-trigger"
        type="button"
        aria-expanded={expanded}
        aria-label={t(expanded ? 'Close audio settings' : 'Open audio settings')}
        onClick={() => {
          enableAudio()
          setExpanded((current) => !current)
        }}
      >
        <span aria-hidden="true">{preferences.musicEnabled ? '♫' : '♪̸'}</span>
        <span>{audioReady ? t('AUDIO ON') : t('AUDIO SETTINGS')}</span>
      </button>
      {expanded && (
        <section className="audio-controls-panel">
          <div className="audio-controls-heading">
            <span>{t('ATMOSPHERE')}</span>
            <button
              type="button"
              className="audio-controls-close"
              aria-label={t('Close audio settings')}
              onClick={() => setExpanded(false)}
            >
              ×
            </button>
          </div>
          <label className="audio-toggle">
            <span><i aria-hidden="true">♫</i> {t('MUSIC')}</span>
            <input
              type="checkbox"
              checked={preferences.musicEnabled}
              onChange={(event) => update({ ...preferences, musicEnabled: event.target.checked })}
            />
          </label>
          <label className="audio-toggle">
            <span><i aria-hidden="true">✧</i> {t('SOUND EFFECTS')}</span>
            <input
              type="checkbox"
              checked={preferences.effectsEnabled}
              onChange={(event) => update({ ...preferences, effectsEnabled: event.target.checked })}
            />
          </label>
          <label className="audio-volume">
            <span>{t('MASTER VOLUME')} <strong>{Math.round(preferences.volume * 100)}%</strong></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={preferences.volume}
              onChange={(event) => update({ ...preferences, volume: Number(event.target.value) })}
            />
          </label>
          <button className="audio-test-button" type="button" onClick={testSound}>
            {t('TEST SOUND')}
          </button>
          {previewMessage && <p role="status">{t(previewMessage)}</p>}
          <p>{t('Procedural, original game audio · settings saved on this device')}</p>
        </section>
      )}
    </aside>
  )
}

export default AudioControls
