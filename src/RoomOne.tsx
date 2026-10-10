import { useCallback, useEffect, useRef, useState } from 'react'
import './RoomOne.css'
import { usePreferences } from './preferencesContext'
import { translateRoomText } from './roomTranslations'

const messageWords = [
  { id: 'truth', text: 'TRUTH' },
  { id: 'clock', text: 'CLOCK' },
  { id: 'the-first', text: 'THE' },
  { id: 'behind', text: 'BEHIND' },
  { id: 'the-last', text: 'THE' },
  { id: 'hidden', text: 'HIDDEN' },
  { id: 'is', text: 'IS' },
]
const arabicMessageWords: Record<string, string> = {
  truth: 'الحقيقة',
  clock: 'الساعة',
  'the-first': 'تلك',
  behind: 'وراء',
  'the-last': 'عقارب',
  hidden: 'محجوبة',
  is: 'تكون',
}

const ROOM_TIME_LIMIT_SECONDS = 2 * 60

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
}: {
  onEnterRoomTwo?: () => void
  onBackHome?: () => void
  onRoomComplete?: (details: { score: number; hintsUsed: number }) => void
}) {
  const { language } = usePreferences()
  const tr = (text: string) => translateRoomText(text, language)
  const wordLabel = (id: string, englishText: string) =>
    language === 'ar' ? arabicMessageWords[id] ?? englishText : englishText
  const [secondsLeft, setSecondsLeft] = useState(ROOM_TIME_LIMIT_SECONDS)
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

  const formattedTime = `${Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`
  const wordBank = messageWords.filter(
    (word) => !slots.includes(word.id),
  )
  const progress = roomComplete ? 7 : puzzleSolved ? 4 : 1
  const displayedRoom = tr('ROOM 01')

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
    const expectedOrder = ['the-first', 'truth', 'is', 'hidden', 'behind', 'the-last', 'clock']
    const englishTheWordsAreInterchangeable =
      language === 'en' &&
      ((slots[0] === 'the-first' && slots[5] === 'the-last') ||
        (slots[0] === 'the-last' && slots[5] === 'the-first'))
    const isCorrect = slots.every((wordId, index) =>
      englishTheWordsAreInterchangeable && (index === 0 || index === 5)
        ? true
        : wordId === expectedOrder[index],
    )
    if (!isCorrect) {
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
    setSecondsLeft(ROOM_TIME_LIMIT_SECONDS)
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
        <a className="brand" href="#room-01" aria-label="MAZORA">
          <span className="brand-mark">
            <img src="/images/mazora-logo-transparent.png" alt="MAZORA Escape Room Game Logo" />
          </span>
          <span>
            <span className="brand-name">MAZORA</span>
            <span className="brand-caption">{tr('PUZZLE ESCAPE ROOM')}</span>
          </span>
        </a>
        <div className="topbar-right">
          <span className="live-indicator">
            <i /> {tr('LIVE SESSION')}
          </span>
          <span
            className="avatar-button"
            aria-hidden="true"
          >
            A
          </span>
        </div>
      </header>

      <section className="mission-bar" aria-label={tr('Room status')}>
        <div className="room-identity">
          <span className="eyebrow">{tr('CURRENT LOCATION')}</span>
          <strong>{displayedRoom}</strong>
          <span className="identity-divider" />
          <span className="room-name">{tr('THE MISSING MESSAGE')}</span>
        </div>
        <div className="game-stats">
          <div className="stat timer-stat">
            <span className="stat-icon timer-icon" aria-hidden="true">◷</span>
            <span>
              <span className="stat-label">{tr('TIME REMAINING')}</span>
              <strong className={secondsLeft < 60 ? 'urgent-time' : ''}>
                {formattedTime}
              </strong>
            </span>
          </div>
          <div className="stat">
            <span className="stat-icon score-icon" aria-hidden="true">✧</span>
            <span>
              <span className="stat-label">{tr('YOUR SCORE')}</span>
              <strong>{score.toLocaleString()} <small>{tr('PTS')}</small></strong>
            </span>
          </div>
          <div className="stat progress-stat">
            <span className="stat-label">{tr('PROGRESS')}</span>
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
            <span aria-hidden="true">✧</span> {tr('HINT · -50 PTS')}
          </button>
          <button
            className="button button-menu"
            type="button"
            onClick={() => setModal('menu')}
          >
            {tr('ESCAPE MENU')} <span aria-hidden="true">☰</span>
          </button>
        </div>
      </section>

      <section className="scene-wrap" aria-label={tr('The mysterious office')}>
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
            aria-label={tr('Inspect the bookshelf')}
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
            <span className="inspect-label">{tr('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-clock"
            type="button"
            aria-label={tr('Inspect the antique clock')}
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
            <span className="inspect-label">{tr('INSPECT')}</span>
          </button>

          <button
            className={`scene-object object-door ${doorOpen ? 'is-open' : ''}`}
            type="button"
            aria-label={tr(puzzleSolved ? 'Inspect the locked door' : 'The door is locked')}
            onClick={() => puzzleSolved && setModal('keypad')}
            disabled={!puzzleSolved || roomComplete}
          >
            <span className="doorway">
              <span className="door-glow-behind">
                <span className="next-room-light">{tr('ROOM 02')}</span>
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
            <span className="inspect-label">{tr(puzzleSolved ? 'UNLOCK' : 'LOCKED')}</span>
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
            aria-label={tr('Inspect the locked desk drawer')}
            onClick={() => inspect('Desk and locked drawer')}
          >
            <span className="inspect-label">{tr('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-lamp"
            type="button"
            aria-label={tr('Inspect the desk lamp')}
            onClick={() => inspect('Desk lamp')}
          >
            <span className="lamp-shade" />
            <span className="lamp-stem" />
            <span className="lamp-base" />
            <span className="lamp-beam" />
            <span className="inspect-label">{tr('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-letter"
            type="button"
            aria-label={tr(puzzleSolved ? 'Read the decrypted message' : 'Inspect the mysterious letter')}
            onClick={() => setModal('puzzle')}
          >
            <span className="letter-art">
              <i className="letter-seal">✦</i>
              <i className="letter-line" />
              <i className="letter-line short" />
            </span>
            <span className="inspect-label">{tr(puzzleSolved ? 'READ' : 'INSPECT')}</span>
          </button>

          <button
            className="scene-object object-typewriter"
            type="button"
            aria-label={tr('Inspect the typewriter')}
            onClick={() => inspect('Typewriter')}
          >
            <span className="typewriter-paper" />
            <span className="typewriter-body">
              <i className="typewriter-keys" />
              <i className="typewriter-roller" />
            </span>
            <span className="inspect-label">{tr('INSPECT')}</span>
          </button>

          <button
            className="scene-object object-photos"
            type="button"
            aria-label={tr('Inspect the old photographs')}
            onClick={() => inspect('Old photographs')}
          >
            <span className="photo-frame photo-one"><i /></span>
            <span className="photo-frame photo-two"><i /></span>
            <span className="inspect-label">{tr('INSPECT')}</span>
          </button>

          <span className="scene-vignette" />
          {accessGranted && (
            <div className="access-granted-toast" role="status">
              <strong>{tr('ACCESS GRANTED')}</strong>
              <span>{tr('The lock releases with a heavy click.')}</span>
            </div>
          )}
          <div className="scene-caption">
            <span className="caption-mark" />
            <span>{tr('AN OFFICE LEFT IN HASTE')}</span>
          </div>
          <div className="scene-hotkey">
            <span className="keycap">ESC</span> {tr('MENU')}
          </div>
        </div>
      </section>

      <footer className="room-footer">
        <div className="chapter-progress">
          <span className="eyebrow">{tr('YOUR JOURNEY')}</span>
          <div className="room-steps" aria-label={tr('Room progression')}>
            <span className={`room-step active ${roomComplete ? 'finished' : ''}`}>
              <i>{roomComplete ? '✓' : '01'}</i> {tr('ROOM 01')}
            </span>
            <span className="step-line" />
            {[2, 3, 4, 5].map((room) => (
              <span className={`room-step ${room === 2 && roomComplete ? 'unlocked' : 'locked'}`} key={room}>
                <i>{room === 2 && roomComplete ? '✓' : '⌑'}</i> {tr(`ROOM 0${room}`)}
              </span>
            ))}
          </div>
        </div>
        <div className="footer-note">
          <span className="status-dot" /> {tr('ALL PROGRESS SAVED LOCALLY')}
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
                aria-label={tr('Close dialog')}
                onClick={closeModal}
              >
                ×
              </button>
            )}
            <span className="modal-kicker">
              {activeModal === 'puzzle' && tr(puzzleSolved ? 'MESSAGE RECOVERED' : 'EVIDENCE · 01')}
              {activeModal === 'keypad' && tr('ACCESS CONTROL')}
              {activeModal === 'menu' && tr('PAUSE MENU')}
              {activeModal === 'hint' && tr('FIELD NOTES')}
              {activeModal === 'inspect' && tr('OBJECT FOUND')}
              {activeModal === 'complete' && tr('CASE FILE · CLOSED')}
              {activeModal === 'gameover' && tr('TIME EXPIRED')}
              {activeModal === 'roomtwo' && tr('NEXT CHAPTER')}
            </span>

            {activeModal === 'puzzle' && (
              <div className="puzzle-content">
                <h1 id="modal-title">{tr(puzzleSolved ? 'MESSAGE DECRYPTED' : 'THE MISSING MESSAGE')}</h1>
                {puzzleSolved ? (
                  <div className="decrypted-message">
                    <p>{tr('You found the hidden code.')}</p>
                    <span className="code-reveal">4 <i>·</i> 8 <i>·</i> 2 <i>·</i> 7</span>
                    <span className="code-caption">{tr('ACCESS CODE DISCOVERED')}</span>
                    <p className="modal-hint-copy">{tr('The antique clock has more to tell you. Find a way out.')}</p>
                    <button className="button button-primary" type="button" onClick={() => setModal(null)}>
                      {tr('RETURN TO THE ROOM')}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="modal-description">
                      {tr('Someone left you a message... but the words are out of order.')}
                    </p>
                    <p className="puzzle-instruction">{tr('DRAG WORDS INTO THE RIGHT ORDER')}</p>
                    <div className="word-slots" aria-label={tr('Message, arranged word slots')}>
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
                                aria-label={`${wordLabel(word.id, word.text)}, ${language === 'ar' ? 'الموضع' : 'position'} ${index + 1}. ${tr('Click to remove.')}`}
                              >
                                {wordLabel(word.id, word.text)}
                              </button>
                            ) : (
                              <span className="slot-number">0{index + 1}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="bank-label">{tr('SCATTERED WORDS')} <span>{tr('· CLICK OR DRAG')}</span></p>
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
                          {wordLabel(word.id, word.text)}
                        </button>
                      ))}
                    </div>
                    {puzzleError && (
                      <p className="feedback-error" role="alert">{tr('Something is wrong... Try again.')}</p>
                    )}
                    <button
                      className="button button-primary check-message"
                      type="button"
                      disabled={slots.some((wordId) => wordId === null)}
                      onClick={checkMessage}
                    >
                      {tr('CHECK MESSAGE')} <span aria-hidden="true">→</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {activeModal === 'keypad' && (
              <div className="keypad-content">
                <h1 id="modal-title">{tr('LOCKED DOOR')}</h1>
                <p className="modal-description">{tr('Enter the 4-digit access code.')}</p>
                <div className={`code-display ${codeError ? 'code-denied' : ''}`} aria-label={`${enteredCode.length} of 4 digits entered`}>
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
                      aria-label={key === 'back' ? tr('Delete last digit') : key === 'enter' ? tr('Enter access code') : key}
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
                    <strong>{tr('ACCESS DENIED')}</strong>
                    <span>{tr('Incorrect code. Search the room for more clues.')}</span>
                  </div>
                )}
              </div>
            )}

            {activeModal === 'menu' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{tr('TAKE A BREATH.')}</h1>
                <p className="modal-description">{tr('The clock is still running. Your progress is safe.')}</p>
                <div className="menu-options">
                  <button className="button button-primary" type="button" onClick={() => setModal(null)}>
                    {tr('RETURN TO THE ROOM')}
                  </button>
                  <button className="button button-secondary" type="button" onClick={restartRoom}>
                    {tr('RESTART ROOM 01')}
                  </button>
                  {onBackHome && (
                    <button className="button button-secondary" type="button" onClick={onBackHome}>
                      {tr('BACK TO HOME')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeModal === 'hint' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{tr('A NUDGE, NOT AN ANSWER.')}</h1>
                <p className="modal-description">{tr('One hint used · 50 points deducted.')}</p>
                <div className="hint-card"><span>{tr('FIELD NOTE')} 0{hintCount}</span><p>{tr(hintText)}</p></div>
                <p className="hint-remaining">{hints.length - hintCount} {tr(hints.length - hintCount === 1 ? 'hint' : 'hints')} {tr('remaining')}</p>
                <button className="button button-primary" type="button" onClick={() => setModal(null)}>
                  {tr('BACK TO INVESTIGATING')}
                </button>
              </div>
            )}

            {activeModal === 'inspect' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{tr(inspectedObject)}</h1>
                <p className="modal-description">
                  {tr(inspectedObject.includes('4827')
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
                  {tr('CONTINUE SEARCHING')}
                </button>
              </div>
            )}

            {activeModal === 'complete' && (
              <div className="complete-content">
                <span className="complete-emblem">✦</span>
                <h1 id="modal-title">{tr('ROOM 01 COMPLETE')}</h1>
                <p className="complete-subtitle">{tr('THE MISSING MESSAGE')}</p>
                <p className="modal-description">{tr('You solved the puzzle and unlocked the next room.')}</p>
                <div className="completion-reward">{tr('+250 POINTS')}</div>
                <div className="score-breakdown">
                  <span><i>{tr('PUZZLE BONUS')}</i><strong>+100</strong></span>
                  <span><i>{tr('TIME BONUS')}</i><strong>+{Math.floor(secondsLeft / 60) * 10}</strong></span>
                  <span><i>{tr('DOOR UNLOCKED')}</i><strong>+150</strong></span>
                  <span className="total-score"><i>{tr('TOTAL SCORE')}</i><strong>{score.toLocaleString()} {tr('PTS')}</strong></span>
                </div>
                <div className="room-unlocked"><span>✧</span> {tr('ROOM 02 UNLOCKED')}</div>
                {roomTwoEntered ? (
                  <div className="room-two-placeholder">
                    <strong>{tr('THE NEXT CHAPTER AWAITS')}</strong>
                    <span>{tr('Room 02 is unlocked and ready to connect.')}</span>
                  </div>
                ) : (
                  <button className="button button-primary enter-room-button" type="button" onClick={() => {
                    setRoomTwoEntered(true)
                    setModal('roomtwo')
                    onEnterRoomTwo?.()
                  }}>
                    {tr('ENTER ROOM 02')} <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            )}

            {activeModal === 'gameover' && (
              <div className="simple-modal-content gameover-content">
                <span className="gameover-mark">00:00</span>
                <h1 id="modal-title">{tr('THE ROOM WENT DARK.')}</h1>
                <p className="modal-description">{tr('Time ran out before you could escape. The room is ready for another attempt.')}</p>
                <button className="button button-primary" type="button" onClick={restartRoom}>
                  {tr('RESTART ROOM 01')} <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}

            {activeModal === 'roomtwo' && (
              <div className="simple-modal-content">
                <h1 id="modal-title">{tr('ROOM 02 IS UNLOCKED.')}</h1>
                <p className="modal-description">{tr('The next chapter can now be connected here. Your Room 01 score is')} {score.toLocaleString()} {tr('points.')}</p>
                <button className="button button-primary" type="button" onClick={() => setModal('complete')}>
                  {tr('BACK TO CASE SUMMARY')}
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
