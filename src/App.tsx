import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { getLeaderboard, getPlayerProgress, savePlayerProgress, type LeaderboardEntry } from './api'
import LoginPage from './LoginPage'
import RoomOne from './RoomOne'
import { Room3 } from './components/Room3'
import FinalRoom from './FinalRoom'
import roomThreeImage from './images/ROOM3.png'
import { RoomFive } from './components/RoomFive'
import PreferenceControls from './PreferenceControls'
import { usePreferences } from './preferencesContext'
import { translateRoomText } from './roomTranslations'

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
  { id: 4, name: 'THE MYSTERIOUS STUDY', path: '/rooms/4', description: 'Search the room to find hidden items and unlock the door.' },
  { id: 5, name: 'THE LAST LOCK', path: '/rooms/5', description: 'One final truth stands between you and freedom.' },
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

function normalizeProgress(parsed: Partial<GameProgress>): GameProgress {
  const savedCompleted = Array.isArray(parsed.completedRooms)
    ? parsed.completedRooms
      .filter(
        (room): room is number =>
          Number.isInteger(room) && ROOM_CONFIG.some((config) => config.id === room),
      )
    : []
  const completedRooms: number[] = []
  for (const room of ROOM_CONFIG) {
    if (!savedCompleted.includes(room.id)) break
    completedRooms.push(room.id)
  }
  const unlockedRooms = ROOM_CONFIG
    .slice(0, completedRooms.length + 1)
    .map((room) => room.id)
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
}

function loadProgress(username?: string): GameProgress {
  if (!username) return defaultProgress

  try {
    const profileKey = `${STORAGE_KEY}:${encodeURIComponent(username.toLocaleLowerCase())}`
    const saved = window.localStorage.getItem(profileKey)
    if (!saved) return defaultProgress
    return normalizeProgress(JSON.parse(saved) as Partial<GameProgress>)
  } catch {
    return defaultProgress
  }
}

function getContinueTarget(progress: GameProgress): string {
  if (progress.gameCompleted) return '/game-complete'
  return ROOM_CONFIG[progress.currentRoom - 1]?.path ?? '/'
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
  const { language } = usePreferences()
  const tr = (text: string) => translateRoomText(text, language)
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
    if (isCorrect) setScore((current) => current + 250)
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
        }} aria-label={`MAZORA ${tr('HOME')}`}>
          <span className="brand-mark">
            <img src="/images/mazora-logo-transparent.png" alt="MAZORA Escape Room Game Logo" />
          </span>
          <span>MAZORA</span>
        </a>
        <nav className="main-nav" aria-label={tr('Main navigation')}>
          <a href="/" onClick={(event) => {
            event.preventDefault()
            onBackHome?.()
          }}>{tr('Rooms')}</a>
          <a href="#room">{tr('Leaderboard')}</a>
          <a href="#room">{tr('How to play')}</a>
        </nav>
        <div className="player-chip">
          <span className="online-dot" />
          <span>{tr('PLAYER 01')}</span>
          <span className="player-avatar" aria-hidden="true">H</span>
        </div>
      </header>

      <section className="game-content" id="room">
        <div className="room-heading">
          <div>
            <a className="back-link" href="#room"><span aria-hidden="true">←</span> {tr('ALL ROOMS')}</a>
            <div className="title-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> {tr('ROOM 02')} <span className="eyebrow-dot">/</span> {tr('THE INTERVIEW')}</div>
                <h1>{tr('The Interview')}</h1>
                <p className="room-subtitle">{tr('Every answer brings you closer to the exit.')}</p>
              </div>
            </div>
          </div>
          <div className="room-status"><span className="status-dot" /> {tr('ROOM IN PROGRESS')}</div>
        </div>

        <div className="game-grid">
          <section className="office-scene" aria-label={tr('A mysterious interview room')}>
            <div className="scene-topline">
              <span><span className="live-indicator" /> {tr('LIVE SCENE')}</span>
              <span className="scene-coordinate">{tr('NIGHT SHIFT')} <span>·</span> 09:41 PM</span>
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
              <div className="person-label"><span className="label-dot" /> {tr('THE INTERVIEWER')}</div>
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
              <span>{tr('“Take your time. The right answer is already in you.”')}</span>
            </div>
            <div className="scene-floorshine" />
          </section>

          <aside className="room-sidebar">
            <div className="sidebar-panel">
              <div className="score-card">
                <span className="progress-label">{tr('TOTAL SCORE')}</span>
                <strong>{score.toLocaleString()} {tr('PTS')}</strong>
              </div>
              <div className="progress-track" aria-label={`${Math.round((correctCount / questions.length) * 100)}% ${language === 'ar' ? 'مكتمل' : 'complete'}`}>
                <span style={{ width: `${(correctCount / questions.length) * 100}%` }} />
              </div>
              <div className="step-list">
                {questions.map((item, index) => {
                  const isSolved = index < correctCount
                  const isCurrent = index === questionIndex && !complete
                  return (
                    <div className={`step-item${isSolved ? ' is-solved' : ''}${isCurrent ? ' is-current' : ''}`} key={item.category}>
                      <span className="step-icon">{isSolved ? '✓' : String(index + 1).padStart(2, '0')}</span>
                      <span className="step-name">{tr(item.category)}</span>
                      <span className="step-state">{tr(isSolved ? 'SOLVED' : isCurrent ? 'IN PLAY' : 'LOCKED')}</span>
                    </div>
                  )
                })}
              </div>
              <div className="divider" />
              <div className="password-title"><span>▣</span> {tr('PASSWORD FRAGMENTS')}</div>
              <p className="password-caption">{tr('Collect every fragment to unlock the door.')}</p>
              <div className="password-slots" aria-label={`${tr('Password collected:')} ${password || tr('none yet')}`}>
                {questions.map((item, index) => (
                  <span className={`password-slot${index < fragments.length ? ' is-filled' : ''}`} key={item.fragment}>
                    {fragments[index] ?? '•••'}
                  </span>
                ))}
              </div>
              <div className="room-tip"><span className="tip-icon">✧</span><span>{tr('Think clearly. A great answer is honest, thoughtful, and specific.')}</span></div>
            </div>
          </aside>
        </div>

        <section className="question-card" aria-live="polite">
          {!complete ? (
            <>
              <div className="question-main">
                <div className="question-meta">
                  <span className="question-number">{tr('QUESTION')} {String(questionIndex + 1).padStart(2, '0')}</span>
                  <span className="meta-divider" />
                  <span className="question-category">{tr(question.category)}</span>
                </div>
                <h2>{tr(question.prompt)}</h2>
                <div className="answer-list" role="group" aria-label={tr('Choose your answer')}>
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
                        <span className="choice-text">{tr(choice.text)}</span>
                        <span className="choice-check">{isCorrect ? '✓' : isWrong ? '×' : '↗'}</span>
                      </button>
                    )
                  })}
                </div>
                {feedback === 'incorrect' && (
                  <p className="feedback feedback-error"><span>↻</span> {tr('Not quite. Try another response, or use a hint to rethink what the interviewer is looking for.')}</p>
                )}
                {feedback === 'correct' && (
                  <p className="feedback feedback-success"><span>✦</span> {tr('That’s a thoughtful answer. You found a password fragment:')} <strong>{question.fragment}</strong></p>
                )}
              </div>
              <div className="question-footer">
                <button className="hint-button" type="button" onClick={revealHint} aria-expanded={showHint}>
                  <span className="bulb-icon">✧</span> {tr(showHint ? 'HIDE HINT' : 'NEED A HINT?')}
                </button>
                {showHint && <p className="hint-message">{tr(question.hint)}</p>}
                <div className="footer-actions">
                  {!answered ? (
                    <button className="primary-button" type="button" onClick={submitAnswer} disabled={selectedChoice === null}>
                      {tr('SUBMIT ANSWER')} <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="primary-button" type="button" onClick={continueGame}>
                      {tr(questionIndex === questions.length - 1 ? 'UNLOCK THE EXIT' : 'NEXT QUESTION')} <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="completion-panel">
              <span className="completion-spark">✦</span>
              <div className="question-meta"><span className="question-number">{tr('ROOM COMPLETE')}</span></div>
              <h2>{tr('You nailed the interview.')}</h2>
              <p>{tr('You collected every fragment and unlocked the next room.')}</p>
              <div className="completion-password"><span>{tr('EXIT CODE')}</span><strong>{questions.map((item) => item.fragment).join('')}</strong><span className="completion-unlocked">{tr('ROOM 03 UNLOCKED')} ✓</span></div>
              <button className="primary-button" type="button" onClick={onEnterRoomThree ?? (() => undefined)}>{tr('ENTER ROOM 03')} <span aria-hidden="true">→</span></button>
            </div>
          )}
        </section>
        <footer className="game-footer">
          <span>MAZORA <span className="footer-separator">/</span> {tr('ROOM 02')}</span>
          <span><span className="footer-lock">▣</span> {tr('ROOM 02')} · {tr('THE INTERVIEW')}</span>
        </footer>
      </section>
    </main>
  )
}

function App() {
  const { t, language } = usePreferences()
  const [player, setPlayer] = useState<PlayerSession | null>(() => loadPlayer())
  const [progress, setProgress] = useState<GameProgress>(() => loadProgress(player?.username))
  const [requestedRoute, setRequestedRoute] = useState(() => window.location.pathname || '/')
  const [storageWarning, setStorageWarning] = useState('')
  const [hydratedUsername, setHydratedUsername] = useState<string | null>(null)
  const [isRetryingCloudSync, setIsRetryingCloudSync] = useState(false)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [leaderboardError, setLeaderboardError] = useState('')
  const playerKey = player?.username.toLocaleLowerCase() ?? null
  const roomMatch = requestedRoute.match(/^\/rooms\/([1-5])(?:\/|$)/)
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
      '/login': 'MAZORA | Login',
      '/': 'MAZORA | Home',
      '/rooms': 'MAZORA | Mission Control',
      '/leaderboard': 'MAZORA | Leaderboard',
      '/game-complete': 'MAZORA — Final Escape',
      '/rooms/5': 'MAZORA — Final Room',
    }

    const roomMatch = route.match(/^\/rooms\/([1-5])(?:\/|$)/)
    if (roomMatch) {
      document.title = `MAZORA — Room 0${roomMatch[1]}`
      return
    }

    document.title = titleByRoute[route] ?? 'MAZORA'
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

  useEffect(() => {
    if (!playerKey) return

    let active = true
    getPlayerProgress(playerKey)
      .then((remoteProgress) => {
        if (!active) return
        if (remoteProgress) setProgress(normalizeProgress(remoteProgress))
        setHydratedUsername(playerKey)
      })
      .catch((error: unknown) => {
        console.error('Could not load cloud game progress.', error)
        if (!active) return
        const reason = error instanceof Error ? `: ${error.message}` : ''
        setStorageWarning(`Cloud sync is unavailable${reason}. Progress is being kept on this device.`)
        setHydratedUsername(playerKey)
      })

    return () => {
      active = false
    }
  }, [playerKey])

  useEffect(() => {
    if (!player || !playerKey || hydratedUsername !== playerKey) return

    const saveTimer = window.setTimeout(() => {
      savePlayerProgress(playerKey, player.username, progress)
        .then(() => {
          setStorageWarning((current) =>
            current.startsWith('Cloud sync is unavailable') ? '' : current,
          )
        })
        .catch((error: unknown) => {
          console.error('Could not save cloud game progress.', error)
          const reason = error instanceof Error ? `: ${error.message}` : ''
          setStorageWarning(`Cloud sync is unavailable${reason}. Progress is being kept on this device.`)
        })
    }, 500)

    return () => window.clearTimeout(saveTimer)
  }, [hydratedUsername, player, playerKey, progress])

  useEffect(() => {
    if (route !== '/leaderboard') return

    let active = true
    const latestProgress = player && playerKey
      ? savePlayerProgress(playerKey, player.username, progress)
      : Promise.resolve()
    latestProgress
      .then(() => getLeaderboard())
      .then((entries) => {
        if (active) {
          setLeaderboardEntries(entries)
          setLeaderboardError('')
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load the leaderboard.', error)
        if (active) {
          setLeaderboardError(
            error instanceof Error
              ? error.message
              : 'Leaderboard is currently unavailable. Please try again later.',
          )
        }
      })

    return () => {
      active = false
    }
  }, [player, playerKey, progress, route])

  const continueTarget = useMemo(() => getContinueTarget(progress), [progress])

  const completeRoom = useCallback((room: number, finalScore: number, usedHints: number) => {
    setProgress((current) => {
      const roomIndex = ROOM_CONFIG.findIndex((config) => config.id === room)
      if (roomIndex < 0) return current
      const previousRoom = ROOM_CONFIG[roomIndex - 1]
      if (previousRoom && !current.completedRooms.includes(previousRoom.id)) return current
      if (current.completedRooms.includes(room)) return current

      const completedRooms = current.completedRooms.includes(room)
        ? current.completedRooms
        : [...current.completedRooms, room]

      const unlockedRooms = ROOM_CONFIG
        .slice(0, Math.min(completedRooms.length + 1, ROOM_CONFIG.length))
        .map((config) => config.id)

      return {
        ...current,
        currentRoom: Math.min(roomIndex + 2, ROOM_CONFIG.length),
        completedRooms,
        unlockedRooms,
        score: Math.max(finalScore, current.score),
        hintsUsed: current.hintsUsed + usedHints,
        gameCompleted: completedRooms.length === ROOM_CONFIG.length,
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
  }, [completeRoom])

  const handleLogin = useCallback((username: string) => {
    const nextPlayer = { username }
    try {
      window.localStorage.setItem(PLAYER_KEY, JSON.stringify(nextPlayer))
      setProgress(loadProgress(username))
      setHydratedUsername(null)
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
      setHydratedUsername(null)
      setPlayer(null)
      navigate('/login')
    } catch (error) {
      console.error('Could not clear the local player session.', error)
      setStorageWarning('Could not sign out. Check your browser storage settings.')
    }
  }, [navigate])

  const handleRetryCloudSync = useCallback(async () => {
    if (!player || !playerKey) return

    setIsRetryingCloudSync(true)
    try {
      await savePlayerProgress(playerKey, player.username, progress)
      setStorageWarning('')
    } catch (error) {
      console.error('Could not retry cloud progress sync.', error)
      const reason = error instanceof Error ? `: ${error.message}` : ''
      setStorageWarning(`Cloud sync is still unavailable${reason}. Progress is being kept on this device.`)
    } finally {
      setIsRetryingCloudSync(false)
    }
  }, [player, playerKey, progress])

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

  // const handleRoomFourComplete = useCallback((details: { score: number; hintsUsed: number }) => {
  //   completeRoom(4, details.score, details.hintsUsed)
  // }, [completeRoom])

    const handleRoomFourEnter = useCallback(() => {
    if (!progress.completedRooms.includes(4)) {
      navigate('/')
      return
    }
    navigate('/rooms/5')
  }, [navigate, progress.completedRooms])

  const handleRoomFiveComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    completeRoom(5, details.score, details.hintsUsed)
    navigate('/game-complete')
  }, [completeRoom, navigate])

  // const handleFinishCampaign = useCallback(() => {
  //   if (!progress.completedRooms.includes(5)) {
  //     navigate('/')
  //     return
  //   }
  //   navigate('/game-complete')
  // }, [navigate, progress.completedRooms])

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

  const localizedRoomNames = [
    t('home.room1'),
    t('home.room2'),
    t('home.room3'),
    t('home.room4'),
    t('home.room5'),
  ]
  const localizedRoomDescriptions = [
    t('home.room1Description'),
    t('home.room2Description'),
    t('home.room3Description'),
    t('home.room4Description'),
    t('home.room5Description'),
  ]

  const roomsPage = (
    <div className="dashboard-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow-header">MAZORA</p>
          <h1>{translateRoomText('Global mission control', language)}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={() => navigate('/')}>
            {translateRoomText('HOME', language)}
          </button>
          <button className="primary-button small" type="button" onClick={() => navigate(continueTarget)}>
            {translateRoomText('CONTINUE GAME', language)}
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow-header">{translateRoomText('CURRENT STATUS', language)}</p>
          <h2>{translateRoomText('Room progression and campaign summary', language)}</h2>
        </div>
        <div className="status-badge">{translateRoomText(progress.gameCompleted ? 'COMPLETED' : 'IN PROGRESS', language)}</div>
      </section>

      <div className="room-grid">
        {ROOM_CONFIG.map((room, index) => {
          const isCompleted = progress.completedRooms.includes(room.id)
          const isUnlocked = progress.unlockedRooms.includes(room.id)
          const isCurrent = progress.currentRoom === index + 1 && !isCompleted
          const previousRoom = ROOM_CONFIG[index - 1]

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
              aria-label={`${translateRoomText(`ROOM 0${room.id}`, language)}: ${localizedRoomNames[index]}. ${isCompleted ? t('home.completed') : isUnlocked ? t('home.unlocked') : `${t('home.locked')}. ${t('home.unlockInstruction')} ${previousRoom?.id} ${language === 'ar' ? 'لفتحها.' : 'to unlock.'}`}`}
            >
              <span className="room-card-art" aria-hidden="true" />
              <span className="card-kicker">{translateRoomText(`ROOM 0${room.id}`, language)}</span>
              <h3>{localizedRoomNames[index]}</h3>
              <p className="room-card-description">{localizedRoomDescriptions[index]}</p>
              <div className="room-card-state">
                {isCompleted && <span>✓ {translateRoomText('COMPLETED', language)}</span>}
                {!isCompleted && isUnlocked && <span>◇ {translateRoomText('UNLOCKED', language)} <b>{translateRoomText('GO TO ROOM', language)} {room.id} →</b></span>}
                {!isCompleted && !isUnlocked && <span>⌑ {translateRoomText('LOCKED', language)} — {translateRoomText('COMPLETE ROOM', language)} {previousRoom?.id} {translateRoomText('TO UNLOCK', language)}</span>}
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
              <img className="home-brand-mark" src="/images/mazora-logo-transparent.png" alt="MAZORA Escape Room Game Logo" />
              <div>
                <p className="eyebrow-header">{t('home.eyebrow')}</p>
                <h1>{t('home.welcome')}</h1>
              </div>
            </div>
            <div className="home-account">
              <span className="home-player">{translateRoomText('AGENT', language)} <strong>{player?.username}</strong></span>
              <button className="ghost-button" type="button" onClick={handleLogout}>{t('home.signOut')}</button>
            </div>
          </header>

          <section className="home-panel">
            <div className="home-copy">
              <p className="eyebrow-header">{t('home.brief')} <span className="brief-marker">/ {t('home.rooms')}</span></p>
              <h2>{t('home.oneWayOutFirst')}<br />{t('home.oneWayOutSecond')}</h2>
              <p>{t('home.description')}</p>
            </div>
            <div className="home-actions">
              <button className="primary-button" type="button" onClick={() => navigate('/rooms/1')}>
                {t('home.enterRoom')} <span aria-hidden="true">→</span>
              </button>
              {progress.gameStarted && (
                <button className="ghost-button" type="button" onClick={() => navigate(continueTarget)}>
                  {t('home.continueGame')}
                </button>
              )}
              <button className="home-restart-link" type="button" onClick={startGame}>
                {progress.gameStarted ? t('home.restart') : t('home.newInvestigation')}
              </button>
            </div>
          </section>

          {storageWarning && (
            <div className="storage-warning" role="alert">
              <span>{storageWarning}</span>
              <button type="button" onClick={handleRetryCloudSync} disabled={isRetryingCloudSync}>
                {translateRoomText(isRetryingCloudSync ? 'RETRYING…' : 'RETRY CLOUD SYNC', language)}
              </button>
            </div>
          )}

          <section className="progression-section" aria-labelledby="progression-title">
            <div className="progression-heading">
              <div>
                <p className="eyebrow-header">{t('home.sequence')}</p>
                <h2 id="progression-title">{t('home.path')}</h2>
              </div>
              <span className="progression-count">{progress.completedRooms.length} / {ROOM_CONFIG.length} {t('home.cleared')}</span>
            </div>
            <div className="room-grid home-room-grid">
              {ROOM_CONFIG.map((room, index) => {
                const isCompleted = progress.completedRooms.includes(room.id)
                const isUnlocked = progress.unlockedRooms.includes(room.id)
                const isCurrent = progress.currentRoom === index + 1 && !isCompleted
                const previousRoom = ROOM_CONFIG[index - 1]
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
                    aria-label={`${translateRoomText(`ROOM 0${room.id}`, language)}: ${localizedRoomNames[index]}. ${isCompleted ? t('home.completed') : isUnlocked ? t('home.unlocked') : `${t('home.locked')}. ${t('home.unlockInstruction')} ${previousRoom?.id} ${language === 'ar' ? 'لفتحها.' : 'to unlock.'}`}`}
                  >
                    <span className="room-card-art" aria-hidden="true" />
                    <span className="room-card-topline"><span>{translateRoomText(`ROOM 0${room.id}`, language)}</span><i>{isCompleted ? '✓' : isUnlocked ? '◇' : '⌑'}</i></span>
                    <span className="room-card-copy">
                      <strong>{localizedRoomNames[index]}</strong>
                      <span>{localizedRoomDescriptions[index]}</span>
                    </span>
                    <span className={`room-card-state ${isUnlocked ? 'state-open' : 'state-locked'}`}>
                      {isCompleted
                        ? `✓ ${t('home.completed')}`
                        : isUnlocked
                          ? <>{t('home.unlocked')} <b>{t('home.goToRoom')} {room.id} <i aria-hidden="true">→</i></b></>
                          : <>⌑ {t('home.locked')} <small>{t('home.unlockInstruction')} {previousRoom?.id} {language === 'ar' ? 'لفتحها.' : 'to unlock.'}</small></>}
                    </span>
                    {index < ROOM_CONFIG.length - 1 && <span className="room-connector" aria-hidden="true">→</span>}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="summary-grid">
            <div className="summary-card">
              <span>{t('home.roomsCompleted')}</span>
              <strong>{progress.completedRooms.length}/{ROOM_CONFIG.length}</strong>
            </div>
            <div className="summary-card">
              <span>{t('home.score')}</span>
              <strong>{progress.score.toLocaleString()} {translateRoomText('PTS', language)}</strong>
            </div>
            <div className="summary-card">
              <span>{t('home.hintsUsed')}</span>
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
            <p className="eyebrow-header">{translateRoomText('ALL ROOMS COMPLETE', language)}</p>
            <h1>{translateRoomText('YOU ESCAPED!', language)}</h1>
            <div className="final-score-box">
              <span>{translateRoomText('FINAL SCORE', language)}</span>
              <strong>{progress.score.toLocaleString()}</strong>
            </div>
            <div className="final-meta">
              <span>{translateRoomText('ROOMS COMPLETED:', language)} {progress.completedRooms.length}</span>
              <span>{translateRoomText('HINTS USED:', language)} {progress.hintsUsed}</span>
            </div>
            <div className="final-actions">
              <button className="primary-button" type="button" onClick={() => navigate('/leaderboard')}>
                {translateRoomText('VIEW LEADERBOARD', language)}
              </button>
              <button className="ghost-button" type="button" onClick={() => navigate('/rooms')}>
                {translateRoomText('VIEW ROOMS', language)}
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
            <p className="eyebrow-header">{translateRoomText('Leaderboard', language)}</p>
            <h1>{translateRoomText('Top operators', language)}</h1>
            {leaderboardError && <p className="storage-warning" role="alert">{leaderboardError}</p>}
            <ol className="leaderboard-list">
              {leaderboardEntries.map((entry, index) => (
                <li key={entry.name}>
                  <span>#{index + 1}</span>
                  <strong>{entry.name}</strong>
                  <em>{entry.score.toLocaleString()} PTS</em>
                </li>
              ))}
            </ol>
            {!leaderboardError && leaderboardEntries.length === 0 && (
              <p>{translateRoomText('No completed runs are on the leaderboard yet.', language)}</p>
            )}
            <button className="primary-button" type="button" onClick={() => navigate('/')}>
              {translateRoomText('BACK HOME', language)}
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
        <RoomFive
          initialScore={progress.score}
          onRoomComplete={handleRoomFourComplete}
          onEnterFinalRoom={handleRoomFourEnter}
          onBackHome={() => navigate('/')}
        />
      )
    }

    if (route.startsWith('/rooms/5')) {
      if (!progress.unlockedRooms.includes(5)) return null
      return (
        <FinalRoom
          initialScore={progress.score}
          onComplete={handleRoomFiveComplete}
        />
      )
    }

    return <div>{roomsPage}</div>
  }

  if (!player) {
    return (
      <>
        <PreferenceControls />
        <LoginPage onLogin={handleLogin} />
      </>
    )
  }

  return (
    <>
      <PreferenceControls />
      {renderContent()}
    </>
  )
}

export default App
