import { usePreferences } from './preferencesContext'
import { translateRoomText } from './roomTranslations'
import './PreferenceControls.css'

function PreferenceControls({ inline = false }: { inline?: boolean }) {
  const {
    language,
    setLanguage,
    audioEnabled,
    toggleAudio,
    audioError,
    t,
  } = usePreferences()

  return (
    <aside className={`preference-controls${inline ? ' is-inline' : ''}`} aria-label={t('preferences.language')}>
      <div className="preference-language" role="group" aria-label={t('preferences.language')}>
        <button
          type="button"
          className={language === 'en' ? 'is-active' : ''}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          type="button"
          className={language === 'ar' ? 'is-active' : ''}
          aria-pressed={language === 'ar'}
          onClick={() => setLanguage('ar')}
        >
          AR
        </button>
      </div>
      <button
        className={`preference-audio ${audioEnabled ? 'is-active' : ''}`}
        type="button"
        aria-pressed={audioEnabled}
        aria-label={`${t('preferences.audio')}: ${t(audioEnabled ? 'preferences.on' : 'preferences.off')}`}
        title={`${t('preferences.audio')}: ${t(audioEnabled ? 'preferences.on' : 'preferences.off')}`}
        onClick={() => void toggleAudio()}
      >
        <span aria-hidden="true">{audioEnabled ? '◖))' : '◖×'}</span>
      </button>
      {audioError && <span className="preference-error" role="status">{translateRoomText(audioError, language)}</span>}
    </aside>
  )
}

export default PreferenceControls
