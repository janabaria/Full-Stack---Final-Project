import { useState, type FormEvent } from 'react'
import './LoginPage.css'

type LoginPageProps = {
  onLogin: (username: string) => boolean
}

function LoginPage({ onLogin }: LoginPageProps) {
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
    if (!onLogin(username)) {
      setError('Your session could not be saved. Check your browser storage and try again.')
    }
  }

  return (
    <main className="login-page">
      <div className="login-grain" aria-hidden="true" />
      <a className="login-brand" href="/login" aria-label="Escape Room Online">
        <span className="login-brand-mark">E</span>
        <span><strong>ESCAPE ROOM</strong><small>ONLINE EXPERIENCE</small></span>
      </a>
      <div className="login-content">
        <div className="login-intro">
          <span className="login-overline"><i /> YOUR NEXT MOVE CHANGES EVERYTHING</span>
          <h1>Some doors<br /><em>should stay closed.</em></h1>
          <p>Every clue matters. Every second counts. Find your way out.</p>
        </div>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-topline"><span>LOCAL PLAYER SESSION</span><span>01 — 04</span></div>
          <div className="login-seal" aria-hidden="true">✧</div>
          <h2 id="login-title">Enter the unknown.</h2>
          <p className="login-card-description">Create or continue a local player session.</p>
          <form onSubmit={submitLogin}>
            <label htmlFor="login-identity">EMAIL OR USERNAME</label>
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
            <label htmlFor="login-password">PASSWORD</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              required
            />
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit">
              <span>UNLOCK YOUR SESSION</span><i aria-hidden="true">→</i>
            </button>
          </form>
          <div className="login-card-foot"><span>🔒</span> LOCAL BACKUP · CLOUD SYNC WHEN CONFIGURED</div>
        </section>
      </div>
      <footer className="login-footer"><span>ESCAPE ROOM ONLINE</span><span>DEMO SIGN-IN · LOCAL BACKUP + OPTIONAL CLOUD SYNC</span></footer>
    </main>
  )
}

export default LoginPage
