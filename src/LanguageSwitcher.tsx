import { useI18n } from './useI18n'

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n()
  const nextLanguage = language === 'en' ? 'ar' : 'en'
  return (
    <button
      className="language-switcher"
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      aria-label={t('Switch language')}
      lang={nextLanguage}
    >
      {nextLanguage === 'ar' ? 'العربية' : 'English'}
    </button>
  )
}
