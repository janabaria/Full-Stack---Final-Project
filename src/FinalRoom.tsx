import { useEffect, useRef, useState } from 'react'
import './FinalRoom.css'
import { usePreferences } from './preferencesContext'
import { translateRoomText } from './roomTranslations'

const accessCode = '4126'
const hints = [
  'Count the corners of the vault before you touch the keypad.',
  'The second and third digits come from a dozen and half a dozen.',
  'A dozen is 12. Half a dozen is 6.',
]

type FinalRoomProps = {
  initialScore: number
  onComplete: (details: { score: number; hintsUsed: number }) => void
  onGameOver?: () => void
}

function FinalRoom({ initialScore, onComplete }: FinalRoomProps) {
  const { language } = usePreferences()
  const tr = (text: string) => translateRoomText(text, language)
  const [timeLeft, setTimeLeft] = useState(8 * 60)
  const [score, setScore] = useState(initialScore)
  const [code, setCode] = useState('')
  const [hintIndex, setHintIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [complete, setComplete] = useState(false)
  const gameOverNotifiedRef = useRef(false)
  const gameOver = timeLeft === 0 && !complete

  useEffect(() => {
    if (complete || gameOver) return
    const timer = window.setTimeout(() => {
      setTimeLeft((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [complete, gameOver, timeLeft])

  useEffect(() => {
    if (!gameOver || gameOverNotifiedRef.current) return
    gameOverNotifiedRef.current = true
    onGameOver?.()
  }, [gameOver, onGameOver])

  const formattedTime = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`

  function addDigit(digit: string) {
    if (code.length < 4) {
      setCode((current) => `${current}${digit}`)
      setMessage('')
    }
  }

  function submitCode() {
    if (code.length !== 4) return
    if (code !== accessCode) {
      setCode('')
      setMessage('ACCESS DENIED — Revisit the clues and try again.')
      return
    }
    const finalScore = score + timeLeft * 5 + 500
    setScore(finalScore)
    setComplete(true)
    onComplete({ score: finalScore, hintsUsed: hintIndex })
  }

  function useHint() {
    if (hintIndex >= hints.length) return
    setScore((current) => Math.max(0, current - 50))
    setMessage(hints[hintIndex])
    setHintIndex((current) => current + 1)
  }

  function restart() {
    setTimeLeft(8 * 60)
    setScore(initialScore)
    setCode('')
    setHintIndex(0)
    setMessage('')
    setComplete(false)
  }

  return (
    <main className="final-room">
      <header className="final-room-header">
        <a href="/" className="final-brand"><span><img src="/images/mazora-logo-transparent.png" alt="MAZORA Escape Room Game Logo" /></span> MAZORA</a>
        <div className="final-room-stats">
          <span>{tr('FINAL ROOM')}</span><strong>{formattedTime}</strong><strong>{score.toLocaleString()} {tr('PTS')}</strong>
        </div>
      </header>
      <section className="vault-scene" aria-label={tr('The final vault')}>
        <div className="vault-halo" />
        <div className={`vault-door ${complete ? 'vault-open' : ''}`}>
          <div className="vault-rings"><i /><i /><i /><span>✦</span></div>
          <div className="vault-handle" />
        </div>
        <div className="vault-side-light vault-side-left" />
        <div className="vault-side-light vault-side-right" />
        <div className="vault-floor" />
        <div className="final-case">
          <div className="final-case-heading">
            <span className="final-room-kicker">{tr('ROOM 05')} <i /> {tr('THE LAST LOCK')}</span>
            <h1>{tr('One final truth.')}</h1>
            <p>{tr('The vault remembers every clue. Enter its four-digit code and make your escape.')}</p>
          </div>
          <div className="final-clue">
            <span>{tr('THE FINAL NOTE')}</span>
            <p>{tr('“Four corners begin the sequence. A dozen follows; half a dozen brings it to its end.”')}</p>
          </div>
          <div className="final-code-display" aria-label={language === 'ar' ? `أُدخل ${code.length} من ٤ أرقام` : `${code.length} of four digits entered`}>
            {[0, 1, 2, 3].map((slot) => <i className={code.length > slot ? 'digit-on' : ''} key={slot}>{code.length > slot ? '●' : '○'}</i>)}
          </div>
          <div className="final-keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'].map((key) => (
              <button
                type="button"
                key={key}
                aria-label={key === '←' ? tr('Clear code') : key === '✓' ? tr('Unlock the final vault') : key}
                onClick={() => {
                  if (key === '←') {
                    setCode('')
                    setMessage('')
                  } else if (key === '✓') submitCode()
                  else addDigit(key)
                }}
              >
                {key}
              </button>
            ))}
          </div>
          <button className="final-hint-button" type="button" onClick={useHint} disabled={hintIndex >= hints.length}>
            ✧ {tr(hintIndex >= hints.length ? 'NO HINTS REMAINING' : 'REQUEST A HINT · -50 PTS')}
          </button>
          {message && <p className={`final-feedback ${message.startsWith('ACCESS') ? 'feedback-denied' : ''}`} role="status">{tr(message)}</p>}
        </div>
      </section>
      {(complete || gameOver) && (
        <div className="final-result-backdrop">
          <section className="final-result-card" role="dialog" aria-modal="true" aria-labelledby="final-result-title">
            <span className="result-star">{complete ? '✦' : '00:00'}</span>
            <p>{tr(complete ? 'ALL FIVE ROOMS CLEARED' : 'TIME EXPIRED')}</p>
            <h2 id="final-result-title">{tr(complete ? 'YOU ESCAPED.' : 'THE VAULT REMAINS SEALED.')}</h2>
            <span className="result-total">{complete ? score.toLocaleString() : tr('The clock ran out.')}{complete && ` ${tr('PTS')}`}</span>
            {complete ? (
              <p className="result-copy">{tr('The last lock yields. You made it out.')}</p>
            ) : (
              <button className="final-restart" type="button" onClick={restart}>{tr('RETRY FINAL ROOM')}</button>
            )}
          </section>
        </div>
      )}
      <footer className="final-room-footer"><span>{tr('THE LAST LOCK')}</span><span>{tr('ALL PROGRESS SAVED ON THIS DEVICE')}</span></footer>
    </main>
  )
}

export default FinalRoom
