import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import LoginPage from './LoginPage'
import RoomOne from './RoomOne'
import { Room3 } from './components/Room3'
import FinalRoom from './FinalRoom'
import roomThreeImage from './images/ROOM3.png'

type Choice = {
  text: string
  correct: boolean
}

type Question = {
  category: string
  prompt: string
  hint: string
  fragment: string
  choices: Choice[]
}

type GameProgress = {
  currentRoom: number
  completedRooms: number[]
  unlockedRooms: number[]
  score: number
  hintsUsed: number
  gameStarted: boolean
  gameCompleted: boolean
}

type PlayerSession = {
  username: string
}

const STORAGE_KEY = 'escape-room-online-progress-v1'
const PLAYER_KEY = 'escape-room-online-player-v1'

const ROOM_CONFIG = [
  { id: 1, name: 'THE MISSING MESSAGE', path: '/rooms/1', description: 'An abandoned office. A message out of order.' },
  { id: 2, name: 'THE INTERVIEW', path: '/rooms/2', description: 'Every answer hides a fragment of the code.' },
  { id: 3, name: 'THE SECURITY WING', path: '/rooms/3', description: 'Bypass the systems and find the keycard.' },
  { id: 4, name: 'THE LAST LOCK', path: '/rooms/4', description: 'One final truth stands between you and freedom.' },
] as const

const questions: Question[] = [
  {
    category: 'SELF-AWARENESS',
    prompt: '“Tell me about a weakness you’re working on.”',
    hint: 'Choose an honest answer that shows what you’re doing to improve.',
    fragment: 'CON',
    choices: [
      { text: '“I care too much about doing a great job.”', correct: false },
      {
        text: '“I used to take on too much, so I’ve been learning to prioritize and ask for help sooner.”',
        correct: true,
      },
      { text: '“I don’t really have any weaknesses.”', correct: false },
    ],
  },
  {
    category: 'TEAMWORK',
    prompt: '“Tell me about a time you disagreed with a teammate.”',
    hint: 'Show that you listened, stayed respectful, and worked toward a shared solution.',
    fragment: 'FI',
    choices: [
      { text: '“I explained why they were wrong and got the team to agree with me.”', correct: false },
      {
        text: '“I listened to their perspective, shared my concerns, and we found a solution together.”',
        correct: true,
      },
      { text: '“I avoid disagreements, so I let them make the decision.”', correct: false },
    ],
  },
  {
    category: 'PROBLEM SOLVING',
    prompt: '“What would you do if you were asked to do something you haven’t done before?”',
    hint: 'A strong answer pairs curiosity with a practical plan to learn.',
    fragment: 'DEN',
    choices: [
      { text: '“I’d wait until someone showed me exactly what to do.”', correct: false },
      {
        text: '“I’d clarify the goal, research what I need to know, and ask focused questions as I go.”',
        correct: true,
      },
      { text: '“I’d try to figure it out without telling anyone I was unsure.”', correct: false },
    ],
  },
  {
    category: 'MOTIVATION',
    prompt: '“Why should we choose you for this role?”',
    hint: 'Connect a relevant strength to what the team needs, and keep it specific.',
    fragment: 'T',
    choices: [
      {
        text: '“My experience in organizing projects fits your needs, and I’m excited to help the team deliver great work.”',
        correct: true,
      },
      { text: '“I need a job, and I’m available to start immediately.”', correct: false },
      { text: '“I’m probably the best candidate you’ll interview.”', correct: false },
    ],
  },
]

const defaultProgress: GameProgress = {
  currentRoom: 1,
  completedRooms: [],
  unlockedRooms: [1],
  score: 750,
  hintsUsed: 0,
  gameStarted: false,
  gameCompleted: false,
}

function loadPlayer(): PlayerSession | null {
  try {
    const saved = window.localStorage.getItem(PLAYER_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Partial<PlayerSession>
    return typeof parsed.username === 'string' && parsed.username.trim()
      ? { username: parsed.username.trim() }
      : null
  } catch {
    return null
  }
}

function loadProgress(username?: string): GameProgress {
  if (!username) return defaultProgress

  try {
    const profileKey = `${STORAGE_KEY}:${encodeURIComponent(username.toLocaleLowerCase())}`
    const saved = window.localStorage.getItem(profileKey)
    if (!saved) return defaultProgress

    const parsed = JSON.parse(saved) as Partial<GameProgress>

    const savedCompleted = Array.isArray(parsed.completedRooms)
      ? parsed.completedRooms.filter(
          (room): room is number =>
            Number.isInteger(room) && room >= 1 && room <= ROOM_CONFIG.length,
        )
      : []
    const completedRooms: number[] = []
    for (let room = 1; room <= ROOM_CONFIG.length; room += 1) {
      if (!savedCompleted.includes(room)) break
      completedRooms.push(room)
    }
    const unlockedRooms = Array.from(
      { length: completedRooms.length + 1 },
      (_, index) => index + 1,
    )
    const currentRoom = Math.min(
      Math.max(Number(parsed.currentRoom) || 1, 1),
      unlockedRooms.length,
    )

    return {
      ...defaultProgress,
      ...parsed,
      currentRoom,
      completedRooms,
      unlockedRooms,
      gameCompleted: completedRooms.length === ROOM_CONFIG.length,
    }
  } catch {
    return defaultProgress
  }
}

function getContinueTarget(progress: GameProgress): string {
  if (progress.gameCompleted) return '/game-complete'
  if (progress.currentRoom >= 1) return `/rooms/${progress.currentRoom}`
  return '/'
}

export function RoomTwoGame({
  initialScore = 750,
  onEnterRoomThree,
  onBackHome,
  onRoomComplete,
}: {
  initialScore?: number
  onEnterRoomThree?: () => void
  onBackHome?: () => void
  onRoomComplete?: (details: { score: number; hintsUsed: number }) => void
}) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [complete, setComplete] = useState(false)
  const [score, setScore] = useState(initialScore)
  const [hintsUsed, setHintsUsed] = useState(0)
  const completionNotifiedRef = useRef(false)

  const question = questions[questionIndex]
  const correctCount = questionIndex + (answered && feedback === 'correct' ? 1 : 0)
  const fragments = questions
    .slice(0, questionIndex + (answered && feedback === 'correct' ? 1 : 0))
    .map((item) => item.fragment)
  const password = fragments.join('')

  useEffect(() => {
    if (!complete || completionNotifiedRef.current) return
    completionNotifiedRef.current = true
    onRoomComplete?.({ score, hintsUsed })
  }, [complete, hintsUsed, onRoomComplete, score])

  function submitAnswer() {
    if (selectedChoice === null || answered) return

    const isCorrect = question.choices[selectedChoice].correct
    if (isCorrect) {
      setScore((current) => current + 250)
    }
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    setAnswered(isCorrect)
  }

  function continueGame() {
    if (questionIndex === questions.length - 1) {
      setComplete(true)
      return
    }

    setQuestionIndex((current) => current + 1)
    setSelectedChoice(null)
    setAnswered(false)
    setFeedback(null)
    setShowHint(false)
  }

  function revealHint() {
    if (showHint) {
      setShowHint(false)
      return
    }

    setShowHint(true)
    setScore((current) => current - 50)
    setHintsUsed((current) => current + 1)
  }

  return (
    <main className="game-shell room-two-shell">
      <header className="topbar">
        <a className="brand" href="/" onClick={(event) => {
          event.preventDefault()
          onBackHome?.()
        }} aria-label="Escape Room Online home">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>ESCAPE<span className="brand-light">ROOM</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="/" onClick={(event) => {
            event.preventDefault()
            onBackHome?.()
          }}>Rooms</a>
          <a href="#room">Leaderboard</a>
          <a href="#room">How to play</a>
        </nav>
        <div className="player-chip">
          <span className="online-dot" />
          <span>PLAYER 01</span>
          <span className="player-avatar" aria-hidden="true">H</span>
        </div>
      </header>

      <section className="game-content" id="room">
        <div className="room-heading">
          <div>
            <a className="back-link" href="#room"><span aria-hidden="true">←</span> ALL ROOMS</a>
            <div className="title-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> ROOM 02 <span className="eyebrow-dot">/</span> THE INTERVIEW</div>
                <h1>The Interview</h1>
                <p className="room-subtitle">Every answer brings you closer to the exit.</p>
              </div>
            </div>
          </div>
          <div className="room-status"><span className="status-dot" /> ROOM IN PROGRESS</div>
        </div>

        <div className="game-grid">
          <section className="office-scene" aria-label="A mysterious interview room">
            <div className="scene-topline">
              <span><span className="live-indicator" /> LIVE SCENE</span>
              <span className="scene-coordinate">NIGHT SHIFT <span>·</span> 09:41 PM</span>
            </div>
            <div className="window-frame">
              <div className="window-glow" />
              <div className="window-mullion" />
              <div className="city-light city-light-one" />
              <div className="city-light city-light-two" />
              <div className="city-light city-light-three" />
              <div className="city-light city-light-four" />
            </div>
            <div className="shelf">
              <span /><span /><span /><span /><span />
            </div>
            <div className="portrait">
              <span className="portrait-head" />
              <span className="portrait-body" />
            </div>
            <div className="lamp">
              <span className="lamp-shade" />
              <span className="lamp-neck" />
              <span className="lamp-base" />
            </div>
            <div className="scene-person">
              <div className="person-halo" />
              <div className="person-head">
                <span className="person-hair" />
                <span className="person-face">
                  <i className="eye eye-left" />
                  <i className="eye eye-right" />
                </span>
                <span className="person-ear" />
              </div>
              <div className="person-neck" />
              <div className="person-suit">
                <span className="shirt" />
                <span className="tie" />
                <span className="lapel lapel-left" />
                <span className="lapel lapel-right" />
              </div>
              <div className="person-label"><span className="label-dot" /> THE INTERVIEWER</div>
            </div>
            <div className="desk">
              <div className="desk-edge" />
              <div className="desk-object desk-folder" />
              <div className="desk-object desk-paper" />
              <div className="desk-object desk-cup"><span /></div>
              <div className="desk-front" />
            </div>
            <div className="scene-caption">
              <span className="caption-icon">◈</span>
              <span>“Take your time. The right answer is already in you.”</span>
            </div>
            <div className="scene-floorshine" />
          </section>

          <aside className="room-sidebar">
            <div className="sidebar-panel">
              <div className="score-card">
                <span className="progress-label">TOTAL SCORE</span>
                <strong>{score.toLocaleString()} PTS</strong>
              </div>
              <div className="progress-track" aria-label={`${Math.round((correctCount / questions.length) * 100)}% complete`}>
                <span style={{ width: `${(correctCount / questions.length) * 100}%` }} />
              </div>
              <div className="step-list">
                {questions.map((item, index) => {
                  const isSolved = index < correctCount
                  const isCurrent = index === questionIndex && !complete
                  return (
                    <div className={`step-item${isSolved ? ' is-solved' : ''}${isCurrent ? ' is-current' : ''}`} key={item.category}>
                      <span className="step-icon">{isSolved ? '✓' : String(index + 1).padStart(2, '0')}</span>
                      <span className="step-name">{item.category}</span>
                      <span className="step-state">{isSolved ? 'SOLVED' : isCurrent ? 'IN PLAY' : 'LOCKED'}</span>
                    </div>
                  )
                })}
              </div>
              <div className="divider" />
              <div className="password-title"><span>▣</span> PASSWORD FRAGMENTS</div>
              <p className="password-caption">Collect every fragment to unlock the door.</p>
              <div className="password-slots" aria-label={`Password collected: ${password || 'none yet'}`}>
                {questions.map((item, index) => (
                  <span className={`password-slot${index < fragments.length ? ' is-filled' : ''}`} key={item.fragment}>
                    {fragments[index] ?? '•••'}
                  </span>
                ))}
              </div>
              <div className="room-tip"><span className="tip-icon">✧</span><span>Think clearly. A great answer is honest, thoughtful, and specific.</span></div>
            </div>
          </aside>
        </div>

        <section className="question-card" aria-live="polite">
          {!complete ? (
            <>
              <div className="question-main">
                <div className="question-meta">
                  <span className="question-number">QUESTION {String(questionIndex + 1).padStart(2, '0')}</span>
                  <span className="meta-divider" />
                  <span className="question-category">{question.category}</span>
                </div>
                <h2>{question.prompt}</h2>
                <div className="answer-list" role="group" aria-label="Choose your answer">
                  {question.choices.map((choice, index) => {
                    const isSelected = selectedChoice === index
                    const isCorrect = answered && choice.correct
                    const isWrong = feedback === 'incorrect' && isSelected
                    return (
                      <button
                        className={`answer-option${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                        key={choice.text}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={answered}
                        onClick={() => {
                          setSelectedChoice(index)
                          setFeedback(null)
                        }}
                      >
                        <span className="choice-marker">{String.fromCharCode(65 + index)}</span>
                        <span className="choice-text">{choice.text}</span>
                        <span className="choice-check">{isCorrect ? '✓' : isWrong ? '×' : '↗'}</span>
                      </button>
                    )
                  })}
                </div>
                {feedback === 'incorrect' && (
                  <p className="feedback feedback-error"><span>↻</span> Not quite. Try another response, or use a hint to rethink what the interviewer is looking for.</p>
                )}
                {feedback === 'correct' && (
                  <p className="feedback feedback-success"><span>✦</span> That’s a thoughtful answer. You found a password fragment: <strong>{question.fragment}</strong></p>
                )}
              </div>
              <div className="question-footer">
                <button className="hint-button" type="button" onClick={revealHint} aria-expanded={showHint}>
                  <span className="bulb-icon">✧</span> {showHint ? 'HIDE HINT' : 'NEED A HINT?'}
                </button>
                {showHint && <p className="hint-message">{question.hint}</p>}
                <div className="footer-actions">
                  {!answered ? (
                    <button className="primary-button" type="button" onClick={submitAnswer} disabled={selectedChoice === null}>
                      SUBMIT ANSWER <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="primary-button" type="button" onClick={continueGame}>
                      {questionIndex === questions.length - 1 ? 'UNLOCK THE EXIT' : 'NEXT QUESTION'} <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="completion-panel">
              <span className="completion-spark">✦</span>
              <div className="question-meta"><span className="question-number">ROOM COMPLETE</span></div>
              <h2>You nailed the interview.</h2>
              <p>You collected every fragment and unlocked the next room.</p>
              <div className="completion-password"><span>EXIT CODE</span><strong>{questions.map((item) => item.fragment).join('')}</strong><span className="completion-unlocked">ROOM 03 UNLOCKED ✓</span></div>
              <button className="primary-button" type="button" onClick={onEnterRoomThree ?? (() => undefined)}>ENTER ROOM 03 <span aria-hidden="true">→</span></button>
            </div>
          )}
        </section>
        <footer className="game-footer">
          <span>ESCAPE ROOM ONLINE <span className="footer-separator">/</span> ROOM 02</span>
          <span><span className="footer-lock">▣</span> ROOM 02 · THE INTERVIEW</span>
        </footer>
      </section>
    </main>
  )
}

function App() {
  const [player, setPlayer] = useState<PlayerSession | null>(() => loadPlayer())
  const [progress, setProgress] = useState<GameProgress>(() => loadProgress(player?.username))
  const [requestedRoute, setRequestedRoute] = useState(() => window.location.pathname || '/')
  const [storageWarning, setStorageWarning] = useState('')
  const roomMatch = requestedRoute.match(/^\/rooms\/([1-4])(?:\/|$)/)
  const isLockedRoom = roomMatch
    ? !progress.unlockedRooms.includes(Number(roomMatch[1]))
    : false
  const route = !player
    ? '/login'
    : requestedRoute === '/login' || isLockedRoom ||
        (requestedRoute === '/game-complete' && !progress.gameCompleted)
      ? '/'
      : requestedRoute

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setRequestedRoute(nextPath)
  }, [])

  useEffect(() => {
    const handlePopState = () => setRequestedRoute(window.location.pathname || '/')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (window.location.pathname !== route) {
      window.history.replaceState({}, '', route)
    }
  }, [requestedRoute, route])

  useEffect(() => {
    const titleByRoute: Record<string, string> = {
      '/login': 'Escape Room Online | Login',
      '/': 'Escape Room Online | Home',
      '/rooms': 'Escape Room Online | Mission Control',
      '/leaderboard': 'Escape Room Online | Leaderboard',
      '/game-complete': 'Escape Room Online — Final Escape',
      '/rooms/4': 'Escape Room Online — Final Room',
    }

    const roomMatch = route.match(/^\/rooms\/([1-4])(?:\/|$)/)
    if (roomMatch) {
      document.title = `Escape Room Online — Room 0${roomMatch[1]}`
      return
    }

    document.title = titleByRoute[route] ?? 'Escape Room Online'
  }, [route])

  useEffect(() => {
    try {
      if (player) {
        const profileKey = `${STORAGE_KEY}:${encodeURIComponent(player.username.toLocaleLowerCase())}`
        window.localStorage.setItem(profileKey, JSON.stringify(progress))
      }
    } catch (error) {
      console.error('Could not save escape-room progress.', error)
    }
  }, [player, progress])

  const continueTarget = useMemo(() => getContinueTarget(progress), [progress])

  const completeRoom = useCallback((room: number, finalScore: number, usedHints: number) => {
    setProgress((current) => {
      if (room > 1 && !current.completedRooms.includes(room - 1)) return current
      if (current.completedRooms.includes(room)) return current

      const completedRooms = current.completedRooms.includes(room)
        ? current.completedRooms
        : [...current.completedRooms, room]

      const unlockedRooms = Array.from(
        { length: Math.min(completedRooms.length + 1, ROOM_CONFIG.length) },
        (_, index) => index + 1,
      )

      return {
        ...current,
        currentRoom: Math.min(room + 1, ROOM_CONFIG.length),
        completedRooms,
        unlockedRooms,
        score: Math.max(finalScore, current.score),
        hintsUsed: current.hintsUsed + usedHints,
        gameCompleted: room === ROOM_CONFIG.length,
        gameStarted: true,
      }
    })
  }, [])

  const handleRoomOneComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    completeRoom(1, details.score, details.hintsUsed)
  }, [completeRoom])

  const handleRoomTwoComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    completeRoom(2, details.score, details.hintsUsed)
  }, [completeRoom])

  const handleRoomThreeComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    completeRoom(3, details.score, details.hintsUsed)
  }, [completeRoom])

  const handleRoomFourComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    completeRoom(4, details.score, details.hintsUsed)
    navigate('/game-complete')
  }, [completeRoom, navigate])

  const handleLogin = useCallback((username: string) => {
    const nextPlayer = { username }
    try {
      window.localStorage.setItem(PLAYER_KEY, JSON.stringify(nextPlayer))
      setProgress(loadProgress(username))
      setStorageWarning('')
      setPlayer(nextPlayer)
      navigate('/')
      return true
    } catch (error) {
      console.error('Could not create the local player session.', error)
      return false
    }
  }, [navigate])

  const handleLogout = useCallback(() => {
    try {
      window.localStorage.removeItem(PLAYER_KEY)
      setPlayer(null)
      navigate('/login')
    } catch (error) {
      console.error('Could not clear the local player session.', error)
      setStorageWarning('Could not sign out. Check your browser storage settings.')
    }
  }, [navigate])

  const handleRoomOneEnter = useCallback(() => {
    if (!progress.completedRooms.includes(1)) {
      navigate('/')
      return
    }
    navigate('/rooms/2')
  }, [navigate, progress.completedRooms])

  const handleRoomTwoEnter = useCallback(() => {
    if (!progress.completedRooms.includes(2)) {
      navigate('/')
      return
    }
    navigate('/rooms/3')
  }, [navigate, progress.completedRooms])

  const handleRoomThreeEnter = useCallback(() => {
    if (!progress.completedRooms.includes(3)) {
      navigate('/')
      return
    }
    navigate('/rooms/4')
  }, [navigate, progress.completedRooms])

  const startGame = useCallback(() => {
    setProgress((current) => ({
      ...current,
      gameStarted: true,
      currentRoom: 1,
      unlockedRooms: [1],
      completedRooms: [],
      score: 750,
      hintsUsed: 0,
      gameCompleted: false,
    }))
    navigate('/rooms/1')
  }, [navigate])

  const roomsPage = (
    <div className="dashboard-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow-header">ESCAPE ROOM ONLINE</p>
          <h1>Global mission control</h1>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={() => navigate('/')}>
            HOME
          </button>
          <button className="primary-button small" type="button" onClick={() => navigate(continueTarget)}>
            CONTINUE GAME
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow-header">CURRENT STATUS</p>
          <h2>Room progression and campaign summary</h2>
        </div>
        <div className="status-badge">{progress.gameCompleted ? 'COMPLETED' : 'IN PROGRESS'}</div>
      </section>

      <div className="room-grid">
        {ROOM_CONFIG.map((room) => {
          const isCompleted = progress.completedRooms.includes(room.id)
          const isUnlocked = progress.unlockedRooms.includes(room.id)
          const isCurrent = progress.currentRoom === room.id && !isCompleted

          return (
            <button
              key={room.id}
              type="button"
              className={`room-card room-art-${room.id} ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-complete' : ''} ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}
              disabled={!isUnlocked}
              onClick={() => isUnlocked && navigate(room.path)}
              style={room.id === 3 ? {
                backgroundImage: `linear-gradient(180deg, rgba(8, 8, 16, .18), rgba(8, 8, 16, .96)), url(${roomThreeImage})`,
              } : undefined}
              aria-label={`Room ${room.id}: ${room.name}. ${isCompleted ? 'Completed' : isUnlocked ? 'Unlocked' : `Locked. Complete room ${room.id - 1} to unlock.`}`}
            >
              <span className="room-card-art" aria-hidden="true" />
              <span className="card-kicker">ROOM 0{room.id}</span>
              <h3>{room.name}</h3>
              <p className="room-card-description">{room.description}</p>
              <div className="room-card-state">
                {isCompleted && <span>✓ COMPLETED</span>}
                {!isCompleted && isUnlocked && <span>◇ UNLOCKED <b>GO TO ROOM {room.id} →</b></span>}
                {!isCompleted && !isUnlocked && <span>⌑ LOCKED — COMPLETE ROOM {room.id - 1} TO UNLOCK</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderContent = () => {
    if (route === '/') {
      return (
        <div className="dashboard-shell home-shell">
          <header className="app-header compact home-header">
            <div className="home-wordmark">
              <span className="home-brand-mark">E</span>
              <div>
                <p className="eyebrow-header">YOUR INVESTIGATION BEGINS</p>
                <h1>Escape Room Online</h1>
              </div>
            </div>
            <div className="home-account">
              <span className="home-player">AGENT <strong>{player?.username}</strong></span>
              <button className="ghost-button" type="button" onClick={handleLogout}>SIGN OUT</button>
            </div>
          </header>

          <section className="home-panel">
            <div className="home-copy">
              <p className="eyebrow-header">MISSION BRIEF <span className="brief-marker">/ 04 ROOMS</span></p>
              <h2>Solve the puzzles,<br />unlock the rooms.</h2>
              <p>
                Solve the puzzles, unlock the rooms, and escape before time runs out.
              </p>
            </div>
            <div className="home-actions">
              <button className="primary-button" type="button" onClick={() => navigate('/rooms/1')}>
                GO TO ROOM 1 <span aria-hidden="true">→</span>
              </button>
              {progress.gameStarted && (
                <button className="ghost-button" type="button" onClick={() => navigate(continueTarget)}>
                  CONTINUE GAME
                </button>
              )}
              <button className="home-restart-link" type="button" onClick={startGame}>
                {progress.gameStarted ? 'RESTART CAMPAIGN' : 'NEW INVESTIGATION'}
              </button>
            </div>
          </section>

          {storageWarning && <p className="storage-warning" role="alert">{storageWarning}</p>}

          <section className="progression-section" aria-labelledby="progression-title">
            <div className="progression-heading">
              <div>
                <p className="eyebrow-header">THE ESCAPE SEQUENCE</p>
                <h2 id="progression-title">Your path through the rooms</h2>
              </div>
              <span className="progression-count">{progress.completedRooms.length} / 4 CLEARED</span>
            </div>
            <div className="room-grid home-room-grid">
              {ROOM_CONFIG.map((room, index) => {
                const isCompleted = progress.completedRooms.includes(room.id)
                const isUnlocked = progress.unlockedRooms.includes(room.id)
                const isCurrent = progress.currentRoom === room.id && !isCompleted
                return (
                  <button
                    key={room.id}
                    type="button"
                    className={`room-card room-art-${room.id} ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-complete' : ''} ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}
                    disabled={!isUnlocked}
                    onClick={() => isUnlocked && navigate(room.path)}
                    style={room.id === 3 ? {
                      backgroundImage: `linear-gradient(180deg, rgba(8, 8, 16, .18), rgba(8, 8, 16, .97)), url(${roomThreeImage})`,
                    } : undefined}
                    aria-label={`Room ${room.id}: ${room.name}. ${isCompleted ? 'Completed' : isUnlocked ? 'Unlocked' : `Locked. Complete room ${room.id - 1} to unlock.`}`}
                  >
                    <span className="room-card-art" aria-hidden="true" />
                    <span className="room-card-topline"><span>ROOM 0{room.id}</span><i>{isCompleted ? '✓' : isUnlocked ? '◇' : '⌑'}</i></span>
                    <span className="room-card-copy">
                      <strong>{room.name}</strong>
                      <span>{room.description}</span>
                    </span>
                    <span className={`room-card-state ${isUnlocked ? 'state-open' : 'state-locked'}`}>
                      {isCompleted
                        ? '✓ COMPLETED'
                        : isUnlocked
                          ? <>UNLOCKED <b>GO TO ROOM {room.id} <i aria-hidden="true">→</i></b></>
                          : <>⌑ LOCKED <small>Complete Room {room.id - 1} to unlock.</small></>}
                    </span>
                    {index < ROOM_CONFIG.length - 1 && <span className="room-connector" aria-hidden="true">→</span>}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="summary-grid">
            <div className="summary-card">
              <span>ROOMS COMPLETED</span>
              <strong>{progress.completedRooms.length}/4</strong>
            </div>
            <div className="summary-card">
              <span>SCORE</span>
              <strong>{progress.score.toLocaleString()} PTS</strong>
            </div>
            <div className="summary-card">
              <span>HINTS USED</span>
              <strong>{progress.hintsUsed}</strong>
            </div>
          </div>
        </div>
      )
    }

    if (route === '/rooms') return roomsPage

    if (route === '/game-complete') {
      return (
        <div className="dashboard-shell complete-shell">
          <div className="final-panel">
            <p className="eyebrow-header">ALL ROOMS COMPLETE</p>
            <h1>YOU ESCAPED!</h1>
            <div className="final-score-box">
              <span>FINAL SCORE</span>
              <strong>{progress.score.toLocaleString()}</strong>
            </div>
            <div className="final-meta">
              <span>ROOMS COMPLETED: {progress.completedRooms.length}</span>
              <span>HINTS USED: {progress.hintsUsed}</span>
            </div>
            <div className="final-actions">
              <button className="primary-button" type="button" onClick={() => navigate('/leaderboard')}>
                VIEW LEADERBOARD
              </button>
              <button className="ghost-button" type="button" onClick={() => navigate('/rooms')}>
                VIEW ROOMS
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (route === '/leaderboard') {
      return (
        <div className="dashboard-shell complete-shell">
          <div className="final-panel leaderboard-panel">
            <p className="eyebrow-header">LEADERBOARD</p>
            <h1>Top operators</h1>
            <ol className="leaderboard-list">
              {[
                { name: 'Player 01', score: progress.score },
                { name: 'Astra', score: 4120 },
                { name: 'Nox', score: 3850 },
                { name: 'Echo', score: 3300 },
              ].map((entry, index) => (
                <li key={entry.name}>
                  <span>#{index + 1}</span>
                  <strong>{entry.name}</strong>
                  <em>{entry.score.toLocaleString()} PTS</em>
                </li>
              ))}
            </ol>
            <button className="primary-button" type="button" onClick={() => navigate('/')}>
              BACK HOME
            </button>
          </div>
        </div>
      )
    }

    if (route.startsWith('/rooms/1')) {
      if (!progress.unlockedRooms.includes(1)) {
        return null
      }

      return (
        <RoomOne
          onEnterRoomTwo={handleRoomOneEnter}
          onBackHome={() => navigate('/')}
          onRoomComplete={handleRoomOneComplete}
        />
      )
    }

    if (route.startsWith('/rooms/2')) {
      if (!progress.unlockedRooms.includes(2)) {
        return null
      }

      return (
        <RoomTwoGame
          initialScore={progress.score}
          onEnterRoomThree={handleRoomTwoEnter}
          onBackHome={() => navigate('/')}
          onRoomComplete={handleRoomTwoComplete}
        />
      )
    }

    if (route.startsWith('/rooms/3')) {
      if (!progress.unlockedRooms.includes(3)) {
        return null
      }

      return (
        <Room3
          initialScore={progress.score}
          onBackHome={() => navigate('/')}
          onRoomComplete={handleRoomThreeComplete}
          onEnterFinalRoom={handleRoomThreeEnter}
        />
      )
    }

    if (route.startsWith('/rooms/4')) {
      if (!progress.unlockedRooms.includes(4)) return null
      return (
        <FinalRoom
          initialScore={progress.score}
          onComplete={handleRoomFourComplete}
        />
      )
    }

    return <div>{roomsPage}</div>
  }

  if (!player) return <LoginPage onLogin={handleLogin} />

  return renderContent()
}

export default App
