import { useState, type FormEvent } from 'react'
import './LoginPage.css'
import { usePreferences } from './preferencesContext'

type LoginPageProps = {
  onLogin: (email: string, password: string, createAccount: boolean, displayName: string) => Promise<void>
  authError?: string
}

function LoginPage({ onLogin, authError = '' }: LoginPageProps) {
  const { t } = usePreferences()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [createAccount, setCreateAccount] = useState(false)

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password || (createAccount && !displayName.trim())) {
      setError(createAccount
        ? 'Enter your display name, email, and password to create an account.'
        : 'Enter your email and password to continue.')
      return
    }
    void onLogin(email.trim(), password, createAccount, displayName.trim()).catch((loginError: unknown) => {
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
          <p className="login-card-description">
            {createAccount ? 'Create a Supabase account to join a co-op team.' : t('login.subtitle')}
          </p>
          <form onSubmit={submitLogin}>
            {createAccount && (
              <>
                <label htmlFor="login-display-name">Display name</label>
                <input
                  id="login-display-name"
                  name="displayName"
                  autoComplete="nickname"
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value)
                    setError('')
                  }}
                  required
                />
              </>
            )}
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
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
            {(error || authError) && <p className="login-error" role="alert">{error || authError}</p>}
            <button className="login-submit" type="submit">
              <span>{createAccount ? 'CREATE ACCOUNT' : t('login.continue')}</span><i aria-hidden="true">→</i>
            </button>
          </form>
          <button
            className="login-mode-toggle"
            type="button"
            onClick={() => {
              setCreateAccount((current) => !current)
              setError('')
            }}
          >
            {createAccount ? 'Already registered? Sign in' : 'New player? Create an account'}
          </button>
          <p className="login-card-foot">Sign-in is secured by Supabase Auth.</p>
        </section>
      </div>
    </main>
  )
}

export default LoginPage
