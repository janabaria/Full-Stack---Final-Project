import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import RoomOne from './RoomOne'
import { Room3 } from './components/Room3'

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

const STORAGE_KEY = 'escape-room-online-progress-v1'

const ROOM_CONFIG = [
  { id: 1, name: 'THE MISSING MESSAGE', path: '/rooms/1' },
  { id: 2, name: 'THE INTERVIEW', path: '/rooms/2' },
  { id: 3, name: 'THE FINAL EXIT', path: '/rooms/3' },
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

function loadProgress(): GameProgress {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultProgress

    const parsed = JSON.parse(saved) as Partial<GameProgress>

    return {
      ...defaultProgress,
      ...parsed,
      completedRooms: Array.isArray(parsed.completedRooms) ? parsed.completedRooms : [],
      unlockedRooms: Array.isArray(parsed.unlockedRooms) ? parsed.unlockedRooms : [1],
    }
  } catch {
    return defaultProgress
  }
}

function getContinueTarget(progress: GameProgress): string {
  if (progress.gameCompleted) return '/game-complete'
  if (progress.currentRoom >= 1) return `/rooms/${progress.currentRoom}`
  return '/rooms'
}

export function RoomTwoGame({
  initialScore = 750,
  onEnterRoomThree,
  onRoomComplete,
}: {
  initialScore?: number
  onEnterRoomThree?: () => void
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
    setScore(initialScore)
  }, [initialScore])

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
        <a className="brand" href="#room" aria-label="Escape Room Online home">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>ESCAPE<span className="brand-light">ROOM</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#rooms">Rooms</a>
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
  const [progress, setProgress] = useState<GameProgress>(() => loadProgress())
  const [route, setRoute] = useState(() => window.location.pathname || '/')

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setRoute(nextPath)
  }, [])

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname || '/')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const titleByRoute: Record<string, string> = {
      '/': 'Escape Room Online | Home',
      '/rooms': 'Escape Room Online | Mission Control',
      '/leaderboard': 'Escape Room Online | Leaderboard',
      '/game-complete': 'Escape Room Online — Final Escape',
    }

    if (route.startsWith('/rooms/1')) {
      document.title = 'Escape Room Online — Room 01'
      return
    }

    if (route.startsWith('/rooms/2')) {
      document.title = 'Escape Room Online — Room 02'
      return
    }

    if (route.startsWith('/rooms/3')) {
      document.title = 'Escape Room Online — Room 03'
      return
    }

    document.title = titleByRoute[route] ?? 'Escape Room Online'
  }, [route])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // ignore storage issues
    }
  }, [progress])

  useEffect(() => {
    const path = window.location.pathname || '/'
    const requiredRoomOne = path.startsWith('/rooms/1') && !progress.unlockedRooms.includes(1)
    const requiredRoomTwo = path.startsWith('/rooms/2') && !progress.unlockedRooms.includes(2)
    const requiredRoomThree = path.startsWith('/rooms/3') && !progress.unlockedRooms.includes(3)

    if (requiredRoomOne || requiredRoomTwo || requiredRoomThree) {
      navigate('/rooms')
    }
  }, [navigate, progress.unlockedRooms])

  const continueTarget = useMemo(() => getContinueTarget(progress), [progress])

  const completeRoom = useCallback((room: number, finalScore: number, usedHints: number) => {
    setProgress((current) => {
      const completedRooms = current.completedRooms.includes(room)
        ? current.completedRooms
        : [...current.completedRooms, room]

      const unlockedRooms = Array.from(new Set([...current.unlockedRooms, room === 1 ? 2 : room === 2 ? 3 : 3]))

      const nextScore = Math.max(finalScore, current.score)
      const nextGameCompleted = room === 3 || current.gameCompleted

      return {
        ...current,
        currentRoom: room === 3 ? 3 : room + 1,
        completedRooms,
        unlockedRooms,
        score: nextScore,
        hintsUsed: current.hintsUsed + usedHints,
        gameCompleted: nextGameCompleted,
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
    setProgress((current) => ({
      ...current,
      score: Math.max(current.score, details.score),
      completedRooms: [...new Set([...current.completedRooms, 3])],
      currentRoom: 3,
      gameCompleted: true,
      gameStarted: true,
      unlockedRooms: [1, 2, 3],
    }))
    navigate('/game-complete')
  }, [navigate])

  const handleRoomOneEnter = useCallback(() => {
    setProgress((current) => ({
      ...current,
      currentRoom: 2,
      unlockedRooms: [...new Set([...current.unlockedRooms, 2])],
    }))
    navigate('/rooms/2')
  }, [navigate])

  const handleRoomTwoEnter = useCallback(() => {
    setProgress((current) => ({
      ...current,
      currentRoom: 3,
      unlockedRooms: [...new Set([...current.unlockedRooms, 3])],
    }))
    navigate('/rooms/3')
  }, [navigate])

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
              className={`room-card ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-complete' : ''} ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}
              disabled={!isUnlocked}
              onClick={() => isUnlocked && navigate(room.path)}
            >
              <span className="card-kicker">ROOM {room.id}</span>
              <h3>{room.name}</h3>
              <div className="room-card-state">
                {isCompleted && <span>✓ COMPLETED</span>}
                {!isCompleted && isUnlocked && <span>🔓 UNLOCKED</span>}
                {!isCompleted && !isUnlocked && <span>🔒 LOCKED</span>}
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
          <header className="app-header compact">
            <div>
              <p className="eyebrow-header">ESCAPE ROOM ONLINE</p>
              <h1>Home</h1>
            </div>
          </header>

          <section className="home-panel">
            <div className="home-copy">
              <p className="eyebrow-header">MISSION BRIEF</p>
              <h2>Three rooms. One final escape.</h2>
              <p>
                Recover the missing message, unlock the interview chamber, and escape the final vault before time runs out.
              </p>
            </div>
            <div className="home-actions">
              <button className="primary-button" type="button" onClick={startGame}>
                {progress.gameStarted ? 'START OVER' : 'START GAME'}
              </button>
              {progress.gameStarted && (
                <button className="ghost-button" type="button" onClick={() => navigate(continueTarget)}>
                  CONTINUE GAME
                </button>
              )}
            </div>
          </section>

          <div className="summary-grid">
            <div className="summary-card">
              <span>ROOMS COMPLETED</span>
              <strong>{progress.completedRooms.length}/3</strong>
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
          onRoomComplete={handleRoomThreeComplete}
        />
      )
    }

    return <div>{roomsPage}</div>
  }

  return renderContent()
}

export default App
