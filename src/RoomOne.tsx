import { useCallback, useEffect, useRef, useState } from 'react'
import './RoomOne.css'
import { useI18n } from './useI18n'

const messageWords = [
  { id: 'truth', text: 'TRUTH' },
  { id: 'clock', text: 'CLOCK' },
  { id: 'the-first', text: 'THE' },
  { id: 'behind', text: 'BEHIND' },
  { id: 'the-last', text: 'THE' },
  { id: 'hidden', text: 'HIDDEN' },
  { id: 'is', text: 'IS' },
]

const hints = [
  'Look carefully at the objects around the desk.',
  'The antique clock may be more important than it looks.',
  'Think about where the message says the truth is hidden.',
]

type ModalName =
  | 'puzzle'
  | 'keypad'
  | 'menu'
  | 'hint'
  | 'inspect'
  | 'complete'
  | 'roomtwo'
  | null

function RoomOne({
  onEnterRoomTwo,
  onBackHome,
  onRoomComplete,
  onGameOver,
}: {
  onEnterRoomTwo?: () => void
  onBackHome?: () => void
  onRoomComplete?: (details: { score: number; hintsUsed: number }) => void
  onGameOver?: () => void
}) {
  const { t } = useI18n()
  const [secondsLeft, setSecondsLeft] = useState(2 * 60)
  const [score, setScore] = useState(750)
  const [modal, setModal] = useState<ModalName>(null)
  const [hintCount, setHintCount] = useState(0)
  const [hintText, setHintText] = useState('')
  const [inspectedObject, setInspectedObject] = useState('')
  const [slots, setSlots] = useState<(string | null)[]>(
    Array(messageWords.length).fill(null),
  )
  const [draggedItem, setDraggedItem] = useState('')
  const [puzzleError, setPuzzleError] = useState(false)
  const [puzzleSolved, setPuzzleSolved] = useState(false)
  const [enteredCode, setEnteredCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [doorOpen, setDoorOpen] = useState(false)
  const [accessGranted, setAccessGranted] = useState(false)
  const [roomComplete, setRoomComplete] = useState(false)
  const [roomTwoEntered, setRoomTwoEntered] = useState(false)
  const completionNotifiedRef = useRef(false)
  const gameOverNotifiedRef = useRef(false)
  const activeModal =
    secondsLeft === 0 && !roomComplete ? 'gameover' : modal

  useEffect(() => {
    if (roomComplete || secondsLeft === 0) return

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [roomComplete, secondsLeft])

  useEffect(() => {
    if (!doorOpen || roomComplete) return
    const animation = window.setTimeout(() => {
      setAccessGranted(false)
      setRoomComplete(true)
      setModal('complete')
    }, 900)

    return () => window.clearTimeout(animation)
  }, [doorOpen, roomComplete])

  useEffect(() => {
    if (!roomComplete || completionNotifiedRef.current) return
    completionNotifiedRef.current = true
    onRoomComplete?.({ score, hintsUsed: hintCount })
  }, [hintCount, onRoomComplete, roomComplete, score])

  useEffect(() => {
    if (secondsLeft !== 0 || roomComplete || gameOverNotifiedRef.current) return
    gameOverNotifiedRef.current = true
    onGameOver?.()
  }, [onGameOver, roomComplete, secondsLeft])

  const formattedTime = `${Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`
  const wordBank = messageWords.filter(
    (word) => !slots.includes(word.id),
  )
  const progress = roomComplete ? 7 : puzzleSolved ? 4 : 1
  const displayedRoom = 'ROOM 01'

  function placeWord(wordId: string, targetIndex?: number) {
    setSlots((current) => {
      const next = [...current]
      const sourceIndex = next.indexOf(wordId)
      if (sourceIndex === targetIndex) return current

      if (sourceIndex !== -1) {
        const displaced = targetIndex === undefined ? null : next[targetIndex]
        next[sourceIndex] = displaced
        if (targetIndex !== undefined) next[targetIndex] = wordId
        return next
      }

      const emptyIndex =
        targetIndex ?? next.findIndex((slot) => slot === null)
      if (emptyIndex === -1) return current
      next[emptyIndex] = wordId
      return next
    })
    setPuzzleError(false)
  }

  function checkMessage() {
    const arranged = slots
      .map((wordId) => messageWords.find((word) => word.id === wordId)?.text)
      .join(' ')

    if (arranged !== 'THE TRUTH IS HIDDEN BEHIND THE CLOCK') {
      setPuzzleError(true)
      return
    }

    if (!puzzleSolved) setScore((current) => current + 100)
    setPuzzleSolved(true)
    setPuzzleError(false)
  }

  function useHint() {
    if (hintCount >= hints.length) return
    setScore((current) => current - 50)
    setHintText(hints[hintCount])
    setHintCount((current) => current + 1)
    setModal('hint')
  }

  function inspect(name: string) {
    setInspectedObject(name)
    setModal('inspect')
  }

  const enterCodeDigit = useCallback((digit: string) => {
    if (enteredCode.length < 4 && !doorOpen) {
      setEnteredCode((current) => `${current}${digit}`)
      setCodeError(false)
    }
  }, [enteredCode.length, doorOpen])

  const checkDoorCode = useCallback(() => {
    if (enteredCode.length !== 4) return
    if (enteredCode !== '4827') {
      setCodeError(true)
      setEnteredCode('')
      window.setTimeout(() => setCodeError(false), 700)
      return
    }

    const timeBonus = Math.floor(secondsLeft / 60) * 10
    setScore((current) => current + 150 + timeBonus)
    setModal(null)
    setAccessGranted(true)
    setDoorOpen(true)
  }, [enteredCode, secondsLeft])

  function restartRoom() {
    setSecondsLeft(2 * 60)
    setScore(750)
    setHintCount(0)
    setHintText('')
    setSlots(Array(messageWords.length).fill(null))
    setPuzzleError(false)
    setPuzzleSolved(false)
    setEnteredCode('')
    setCodeError(false)
    setDoorOpen(false)
    setAccessGranted(false)
    setRoomComplete(false)
    setRoomTwoEntered(false)
    completionNotifiedRef.current = false
    setModal(null)
  }

  const closeModal = useCallback(() => {
    if (modal === 'complete') return
    setModal(null)
  }, [modal])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (activeModal === null) setModal('menu')
        else closeModal()
      }
      if (activeModal === 'keypad' && /^[0-9]$/.test(event.key)) {
        enterCodeDigit(event.key)
      }
      if (activeModal === 'keypad' && event.key === 'Enter') checkDoorCode()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeModal, closeModal, checkDoorCode, enterCodeDigit])

  return (
    <main className="game-shell">
      <header className="topbar">
        <a className="brand" href="#room-01" aria-label={t('Escape Room Online')}>
          <span className="brand-mark" aria-hidden="true">
            E
          </span>
          <span>
            <span className="brand-name">ESCAPE ROOM</span>
            <span className="brand-caption">{t('ONLINE EXPERIENCE')}</span>
          </span>
        </a>
        <div className="topbar-right">
          <span className="live-indicator">
            <i /> {t('LIVE SESSION')}
          </span>
          <span
            className="icon-button sound-button"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6" />
            </svg>
          </span>
          <span
            className="avatar-button"
            aria-hidden="true"
          >
            A
          </span>
        </div>
      </header>

      <section className="mission-bar" aria-label={t('Room status')}>
        <div className="room-identity">
          <span className="eyebrow">{t('CURRENT LOCATION')}</span>
          <strong>{t(displayedRoom)}</strong>
          <span className="identity-divider" />
          <span className="room-name">{t('THE MISSING MESSAGE')}</span>
        </div>
        <div className="game-stats">
          <div className="stat timer-stat">
            <span className="stat-icon timer-icon" aria-hidden="true">◷</span>
            <span>
              <span className="stat-label">{t('TIME REMAINING')}</span>
              <strong className={secondsLeft < 60 ? 'urgent-time' : ''}>
                {formattedTime}
              </strong>
            </span>
          </div>
          <div className="stat">
            <span className="stat-icon score-icon" aria-hidden="true">✧</span>
            <span>
              <span className="stat-label">{t('YOUR SCORE')}</span>
              <strong>{score.toLocaleString()} <small>{t('PTS')}</small></strong>
            </span>
          </div>
          <div className="stat progress-stat">
            <span className="stat-label">{t('PROGRESS')}</span>
            <strong>{progress} <small>/ 7</small></strong>
          </div>
        </div>
        <div className="game-actions">
          <button
            className="button button-hint"
            type="button"
            onClick={useHint}
            disabled={hintCount >= hints.length || roomComplete}
          >
            <span aria-hidden="true">✧</span> {t('HINT · -50 PTS')}
          </button>
          <button
            className="button button-menu"
            type="button"
            onClick={() => setModal('menu')}
          >
            {t('ESCAPE MENU')} <span aria-hidden="true">☰</span>
          </button>
        </div>
      </section>

      <section className="scene-wrap" aria-label={t('The mysterious office')}>
        <div className={`room-scene ${doorOpen ? 'doorway-lit' : ''}`}>
          <div className="room-ceiling" />
          <div className="wall-panels" />
          <div className="wall-moulding moulding-top" />
          <div className="wall-moulding moulding-bottom" />
          <div className="floorboards" />
          <div className="ambient-light" />
          <div className="window-shape" aria-hidden="true">
            <div className="window-cross window-cross-x" />
            <div className="window-cross window-cross-y" />
          </div>
          <div className="window-glow" />

          <button
            className="scene-object object-bookshelf"
            type="button"
            aria-label={t('Inspect the bookshelf')}
            onClick={() => inspect('Bookshelf')}
          >
            <span className="bookshelf-top" />
            <span className="bookshelf-frame">
              <span className="book-row">
                {['#665846', '#7e403d', '#c1a16d', '#465766', '#806347', '#5b3842'].map((color, index) => (
                  <i key={index} style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="shelf-board" />
              <span className="book-row second-row">
                {['#4b5a57', '#986449', '#574c68', '#a18254', '#714b42'].map((color, index) => (
                  <i key={index} style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="shelf-board" />
              <span className="book-row third-row">
                {['#6d3f3f', '#697a72', '#c0a879', '#51455a', '#825b3e', '#495466'].map((color, index) => (
                  <i key={index} style={{ backgroundColor: color }} />
                ))}
              </span>
            </span>
            <span className="bookshelf-foot" />
            <span className="inspect-label">{t('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-clock"
            type="button"
            aria-label={t('Inspect the antique clock')}
            onClick={() =>
              puzzleSolved
                ? inspect('Antique clock — a hidden code, 4827, was found in the message.')
                : inspect('Antique clock')
            }
          >
            <span className="clock-frame">
              <span className="clock-face">
                <i className="clock-hand clock-hand-hour" />
                <i className="clock-hand clock-hand-minute" />
                <i className="clock-pin" />
              </span>
            </span>
            <span className="inspect-label">{t('INSPECT')}</span>
          </button>

          <button
            className={`scene-object object-door ${doorOpen ? 'is-open' : ''}`}
            type="button"
            aria-label={t(puzzleSolved ? 'Inspect the locked door' : 'The door is locked')}
            onClick={() => puzzleSolved && setModal('keypad')}
            disabled={!puzzleSolved || roomComplete}
          >
            <span className="doorway">
              <span className="door-glow-behind">
                <span className="next-room-light">{t('ROOM')}<br />02</span>
              </span>
              <span className="door-panel-art">
                <span className="door-inset" />
                <span className="door-inset lower" />
                <span className={`door-lock ${puzzleSolved ? 'lock-ready' : ''}`}>
                  {doorOpen ? '✦' : '⌑'}
                </span>
                <span className="door-knob" />
              </span>
            </span>
            <span className="inspect-label">{t(puzzleSolved ? 'UNLOCK' : 'LOCKED')}</span>
          </button>

          <div className="desk">
            <span className="desk-back" />
            <span className="desk-top" />
            <span className="desk-front">
              <span className="desk-drawer">
                <i />
              </span>
              <span className="desk-drawer lower-drawer">
                <i />
              </span>
            </span>
            <span className="desk-leg left-leg" />
            <span className="desk-leg right-leg" />
          </div>

          <button
            className="scene-object object-desk"
            type="button"
            aria-label={t('Inspect the locked desk drawer')}
            onClick={() => inspect('Desk and locked drawer')}
          >
            <span className="inspect-label">{t('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-lamp"
            type="button"
            aria-label={t('Inspect the desk lamp')}
            onClick={() => inspect('Desk lamp')}
          >
            <span className="lamp-shade" />
            <span className="lamp-stem" />
            <span className="lamp-base" />
            <span className="lamp-beam" />
            <span className="inspect-label">{t('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-letter"
            type="button"
            aria-label={t(puzzleSolved ? 'Read the decrypted message' : 'Inspect the mysterious letter')}
            onClick={() => setModal('puzzle')}
          >
            <span className="letter-art">
              <i className="letter-seal">✦</i>
              <i className="letter-line" />
              <i className="letter-line short" />
            </span>
            <span className="inspect-label">{t(puzzleSolved ? 'READ' : 'INSPECT')}</span>
          </button>

          <button
            className="scene-object object-typewriter"
            type="button"
            aria-label={t('Inspect the typewriter')}
            onClick={() => inspect('Typewriter')}
          >
            <span className="typewriter-paper" />
            <span className="typewriter-body">
              <i className="typewriter-keys" />
              <i className="typewriter-roller" />
            </span>
            <span className="inspect-label">{t('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-photos"
            type="button"
            aria-label={t('Inspect the old photographs')}
            onClick={() => inspect('Old photographs')}
          >
            <span className="photo-frame photo-one"><i /></span>
            <span className="photo-frame photo-two"><i /></span>
            <span className="inspect-label">{t('INSPECT')}</span>
          </button>

          <span className="scene-vignette" />
          {accessGranted && (
            <div className="access-granted-toast" role="status">
              <strong>{t('ACCESS GRANTED')}</strong>
              <span>{t('The lock releases with a heavy click.')}</span>
            </div>
          )}
          <div className="scene-caption">
            <span className="caption-mark" />
            <span>{t('AN OFFICE LEFT IN HASTE')}</span>
          </div>
          <div className="scene-hotkey">
            <span className="keycap">ESC</span> {t('MENU')}
          </div>
        </div>
      </section>

      <footer className="room-footer">
        <div className="chapter-progress">
          <span className="eyebrow">{t('YOUR JOURNEY')}</span>
          <div className="room-steps" aria-label={t('Room progression')}>
            <span className={`room-step active ${roomComplete ? 'finished' : ''}`}>
              <i>{roomComplete ? '✓' : '01'}</i> {t('ROOM 01')}
            </span>
            <span className="step-line" />
            {[2, 3, 4, 5].map((room) => (
              <span className={`room-step ${room === 2 && roomComplete ? 'unlocked' : 'locked'}`} key={room}>
                <i>{room === 2 && roomComplete ? '✓' : '⌑'}</i> {t('ROOM 0{room}', { room })}
              </span>
            ))}
          </div>
        </div>
        <div className="footer-note">
          <span className="status-dot" /> {t('ALL PROGRESS SAVED LOCALLY')}
        </div>
      </footer>

      {activeModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <section
            className={`modal-card ${activeModal === 'keypad' && codeError ? 'shake' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {activeModal !== 'complete' && activeModal !== 'gameover' && (
              <button
                className="modal-close"
                type="button"
                aria-label={t('Close dialog')}
                onClick={closeModal}
              >
                ×
              </button>
            )}
            <span className="modal-kicker">
              {activeModal === 'puzzle' && t(puzzleSolved ? 'MESSAGE RECOVERED' : 'EVIDENCE · 01')}
              {activeModal === 'keypad' && t('ACCESS CONTROL')}
              {activeModal === 'menu' && t('PAUSE MENU')}
              {activeModal === 'hint' && t('FIELD NOTES')}
              {activeModal === 'inspect' && t('OBJECT FOUND')}
              {activeModal === 'complete' && t('CASE FILE · CLOSED')}
              {activeModal === 'gameover' && t('TIME EXPIRED')}
              {activeModal === 'roomtwo' && t('NEXT CHAPTER')}
            </span>

            {activeModal === 'puzzle' && (
              <div className="puzzle-content">
                <h1 id="modal-title">{t(puzzleSolved ? 'MESSAGE DECRYPTED' : 'THE MISSING MESSAGE')}</h1>
                {puzzleSolved ? (
                  <div className="decrypted-message">
                    <p>{t('You found the hidden code.')}</p>
                    <span className="code-reveal">4 <i>·</i> 8 <i>·</i> 2 <i>·</i> 7</span>
                    <span className="code-caption">{t('ACCESS CODE DISCOVERED')}</span>
                    <p className="modal-hint-copy">{t('The antique clock has more to tell you. Find a way out.')}</p>
                    <button className="button button-primary" type="button" onClick={() => setModal(null)}>
                      {t('RETURN TO THE ROOM')}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="modal-description">
                      {t('Someone left you a message... but the words are out of order.')}
                    </p>
                    <p className="puzzle-instruction">{t('DRAG WORDS INTO THE RIGHT ORDER')}</p>
                    <div className="word-slots" aria-label={t('Message, arranged word slots')}>
                      {slots.map((wordId, index) => {
                        const word = messageWords.find((item) => item.id === wordId)
                        return (
                          <div
                            className={`word-slot ${word ? 'filled' : ''}`}
                            key={index}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault()
                              const transfer = event.dataTransfer.getData('text/plain')
                              if (transfer.startsWith('slot:')) {
                                const source = Number(transfer.slice(5))
                                const movedId = slots[source]
                                if (movedId) placeWord(movedId, index)
                              } else if (transfer) {
                                placeWord(transfer, index)
                              }
                            }}
                          >
                            {word ? (
                              <button
                                type="button"
                                className="word-chip placed-word"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData('text/plain', `slot:${index}`)
                                  setDraggedItem(word.id)
                                }}
                                onDragEnd={() => setDraggedItem('')}
                                onClick={() => placeWord(word.id)}
                                aria-label={t('{word}, position {position}. Click to remove.', { word: word.text, position: index + 1 })}
                              >
                                {t(word.text)}
                              </button>
                            ) : (
                              <span className="slot-number">0{index + 1}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="bank-label">{t('SCATTERED WORDS')} <span>{t('· CLICK OR DRAG')}</span></p>
                    <div className="word-bank">
                      {wordBank.map((word) => (
                        <button
                          type="button"
                          className={`word-chip ${draggedItem === word.id ? 'is-dragging' : ''}`}
                          key={word.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', word.id)
                            setDraggedItem(word.id)
                          }}
                          onDragEnd={() => setDraggedItem('')}
                          onClick={() => placeWord(word.id)}
                        >
                          {t(word.text)}
                        </button>
                      ))}
                    </div>
                    {puzzleError && (
                      <p className="feedback-error" role="alert">{t('Something is wrong... Try again.')}</p>
                    )}
                    <button
                      className="button button-primary check-message"
                      type="button"
                      disabled={slots.some((wordId) => wordId === null)}
                      onClick={checkMessage}
                    >
                      {t('CHECK MESSAGE')} <span aria-hidden="true">→</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {activeModal === 'keypad' && (
              <div className="keypad-content">
                <h1 id="modal-title">{t('LOCKED DOOR')}</h1>
                <p className="modal-description">{t('Enter the 4-digit access code.')}</p>
                <div className={`code-display ${codeError ? 'code-denied' : ''}`} aria-label={t('{entered} of 4 digits entered', { entered: enteredCode.length })}>
                  {[0, 1, 2, 3].map((digit) => (
                    <span key={digit} className={enteredCode.length > digit ? 'digit-filled' : ''}>
                      {enteredCode.length > digit ? '●' : '○'}
                    </span>
                  ))}
                </div>
                <div className="keypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'enter'].map((key) => (
                    <button
                      type="button"
                      className={`keypad-key ${key === 'enter' ? 'keypad-enter' : ''} ${key === 'back' ? 'keypad-back' : ''}`}
                      key={key}
                      aria-label={key === 'back' ? t('Delete last digit') : key === 'enter' ? t('Enter access code') : key}
                      onClick={() => {
                        if (key === 'back') {
                          setEnteredCode((current) => current.slice(0, -1))
                          setCodeError(false)
                        } else if (key === 'enter') {
                          checkDoorCode()
                        } else {
                          enterCodeDigit(key)
                        }
                      }}
                    >
                      {key === 'back' ? '←' : key === 'enter' ? '✓' : key}
                    </button>
                  ))}
                </div>
                {codeError && (
                  <div className="access-denied" role="alert">
                    <strong>{t('ACCESS DENIED')}</strong>
                    <span>{t('Incorrect code. Search the room for more clues.')}</span>
                  </div>
                )}
              </div>
            )}

            {activeModal === 'menu' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{t('TAKE A BREATH.')}</h1>
                <p className="modal-description">{t('The clock is still running. Your progress is safe.')}</p>
                <div className="menu-options">
                  <button className="button button-primary" type="button" onClick={() => setModal(null)}>
                    {t('RETURN TO THE ROOM')}
                  </button>
                  <button className="button button-secondary" type="button" onClick={restartRoom}>
                    {t('RESTART ROOM 01')}
                  </button>
                  {onBackHome && (
                    <button className="button button-secondary" type="button" onClick={onBackHome}>
                      {t('BACK HOME')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeModal === 'hint' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{t('A NUDGE, NOT AN ANSWER.')}</h1>
                <p className="modal-description">{t('One hint used · 50 points deducted.')}</p>
                <div className="hint-card"><span>{t('FIELD NOTES')} 0{hintCount}</span><p>{t(hintText)}</p></div>
                <p className="hint-remaining">{t('{count} hints remaining', { count: hints.length - hintCount })}</p>
                <button className="button button-primary" type="button" onClick={() => setModal(null)}>
                  {t('BACK TO INVESTIGATING')}
                </button>
              </div>
            )}

            {activeModal === 'inspect' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{t(inspectedObject)}</h1>
                <p className="modal-description">
                  {t(inspectedObject.includes('4827')
                    ? 'The letter revealed the code. It may be what the locked door needs.'
                    : inspectedObject === 'Desk and locked drawer'
                      ? 'The drawer is locked tight. Something in the room may hold its key.'
                      : inspectedObject === 'Typewriter'
                        ? 'A sheet has been left in the carriage, but it is blank. The ribbon smells of dust.'
                        : inspectedObject === 'Old photographs'
                          ? 'Faded photographs of the office. A clock appears in the background of each one.'
                          : inspectedObject === 'Bookshelf'
                            ? 'Old books crowd the shelves. Their spines are faded and out of order.'
                            : inspectedObject === 'Desk lamp'
                              ? 'A pool of warm light falls across a handwritten letter on the desk.'
                              : 'A brass clock keeps ticking. Its hands seem to have stopped at midnight.')}
                </p>
                <button className="button button-primary" type="button" onClick={() => setModal(null)}>
                  {t('CONTINUE SEARCHING')}
                </button>
              </div>
            )}

            {activeModal === 'complete' && (
              <div className="complete-content">
                <span className="complete-emblem">✦</span>
                <h1 id="modal-title">{t('ROOM 01 COMPLETE')}</h1>
                <p className="complete-subtitle">{t('THE MISSING MESSAGE')}</p>
                <p className="modal-description">{t('You solved the puzzle and unlocked the next room.')}</p>
                <div className="completion-reward">+250 {t('POINTS')}</div>
                <div className="score-breakdown">
                  <span><i>{t('PUZZLE BONUS')}</i><strong>+100</strong></span>
                  <span><i>{t('TIME BONUS')}</i><strong>+{Math.floor(secondsLeft / 60) * 10}</strong></span>
                  <span><i>{t('DOOR UNLOCKED')}</i><strong>+150</strong></span>
                  <span className="total-score"><i>{t('TOTAL SCORE')}</i><strong>{score.toLocaleString()} {t('PTS')}</strong></span>
                </div>
                <div className="room-unlocked"><span>✧</span> {t('ROOM 02 UNLOCKED')}</div>
                {roomTwoEntered ? (
                  <div className="room-two-placeholder">
                    <strong>{t('THE NEXT CHAPTER AWAITS')}</strong>
                    <span>{t('Room 02 is unlocked and ready to connect.')}</span>
                  </div>
                ) : (
                  <button className="button button-primary enter-room-button" type="button" onClick={() => {
                    setRoomTwoEntered(true)
                    setModal('roomtwo')
                    onEnterRoomTwo?.()
                  }}>
                    {t('ENTER ROOM 02')} <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            )}

            {activeModal === 'gameover' && (
              <div className="simple-modal-content gameover-content">
                <span className="gameover-mark">00:00</span>
                <h1 id="modal-title">{t('THE ROOM WENT DARK.')}</h1>
                <p className="modal-description">{t('Time ran out before you could escape. The room is ready for another attempt.')}</p>
                <button className="button button-primary" type="button" onClick={restartRoom}>
                  {t('RESTART ROOM 01')} <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}

            {activeModal === 'roomtwo' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{t('ROOM 02 IS UNLOCKED.')}</h1>
                <p className="modal-description">{t('The next chapter can now be connected here. Your Room 01 score is {score} points.', { score: score.toLocaleString() })}</p>
                <button className="button button-primary" type="button" onClick={() => setModal('complete')}>
                  {t('BACK TO CASE SUMMARY')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default RoomOne
