import { useState, type FormEvent } from 'react'
import './LoginPage.css'
import { useI18n } from './useI18n'

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>
}

function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = useI18n()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = identity.trim()
    if (!username || !password) {
      setError('Enter your username and password to continue.')
      return
    }
    void onLogin(username, password).catch((loginError: unknown) => {
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in. Please try again.')
    })
  }

  return (
    <main className="login-page">
      <div className="login-grain" aria-hidden="true" />
      <a className="login-brand" href="/login" aria-label={t('Escape Room Online')}>
        <span className="login-brand-mark">E</span>
        <span><strong>ESCAPE ROOM</strong><small>{t('ONLINE EXPERIENCE')}</small></span>
      </a>
      <div className="login-content">
        <div className="login-intro">
          <span className="login-overline"><i /> {t('YOUR NEXT MOVE CHANGES EVERYTHING')}</span>
          <h1>{t('Some doors')}<br /><em>{t('should stay closed.')}</em></h1>
          <p>{t('Every clue matters. Every second counts. Find your way out.')}</p>
        </div>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-topline"><span>{t('LOCAL PLAYER SESSION')}</span><span>01 — 04</span></div>
          <div className="login-seal" aria-hidden="true">✧</div>
          <h2 id="login-title">{t('Enter the unknown.')}</h2>
          <p className="login-card-description">{t('Create or continue a local player session.')}</p>
          <form onSubmit={submitLogin}>
            <label htmlFor="login-identity">{t('EMAIL OR USERNAME')}</label>
            <input
              id="login-identity"
              name="username"
              autoComplete="username"
              placeholder="investigator@example.com"
              value={identity}
              onChange={(event) => {
                setIdentity(event.target.value)
                setError('')
              }}
              required
            />
            <label htmlFor="login-password">{t('PASSWORD')}</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('Enter your password')}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              required
            />
            {error && <p className="login-error" role="alert">{t(error)}</p>}
            <button className="login-submit" type="submit">
              <span>{t('UNLOCK YOUR SESSION')}</span><i aria-hidden="true">→</i>
            </button>
          </form>
          <div className="login-card-foot"><span>🔒</span> {t('LOCAL BACKUP · CLOUD SYNC WHEN CONFIGURED')}</div>
        </section>
      </div>
      <footer className="login-footer"><span>ESCAPE ROOM ONLINE</span><span>{t('DEMO SIGN-IN · LOCAL BACKUP + OPTIONAL CLOUD SYNC')}</span></footer>
    </main>
  )
}

export default LoginPage
