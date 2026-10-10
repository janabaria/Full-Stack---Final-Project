import { useState, type FormEvent } from 'react'
import './LoginPage.css'
import { usePreferences } from './preferencesContext'

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>
}

function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = usePreferences()
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
      <a className="login-brand" href="/login" aria-label="MAZORA">
        <img className="login-brand-logo" src="/images/mazora-logo-transparent.png" alt="MAZORA Escape Room Game Logo" />
      </a>
      <div className="login-content">
        <section className="login-card" aria-labelledby="login-title">
          <h1 id="login-title">{t('login.welcome')}</h1>
          <p className="login-card-description">{t('login.subtitle')}</p>
          <form onSubmit={submitLogin}>
            <label htmlFor="login-identity">{t('login.identity')}</label>
            <input
              id="login-identity"
              name="username"
              autoComplete="username"
              placeholder={t('login.identityPlaceholder')}
              value={identity}
              onChange={(event) => {
                setIdentity(event.target.value)
                setError('')
              }}
              required
            />
            <label htmlFor="login-password">{t('login.password')}</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              required
            />
            {error && <p className="login-error" role="alert">{t(error)}</p>}
            <button className="login-submit" type="submit">
              <span>{t('login.continue')}</span><i aria-hidden="true">→</i>
            </button>
          </form>
          <p className="login-card-foot">{t('login.localProgress')}</p>
        </section>
      </div>
    </main>
  )
}

export default LoginPage
