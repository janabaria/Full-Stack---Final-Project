import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { getLeaderboard, getPlayerProgress, savePlayerProgress, type LeaderboardEntry } from './api'
import LoginPage from './LoginPage'
import RoomOne from './RoomOne'
import { Room3 } from './components/Room3'
import FinalRoom from './FinalRoom'
import roomThreeImage from './images/ROOM3.png'
import { RoomFive } from './components/RoomFive'
import AudioControls from './audio/AudioControls'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useI18n } from './useI18n'
import { authenticateLocalPlayer } from './localAuth'
import {
  playFailureSound,
  playRecordCelebration,
  playSuccessSound,
  playUiSound,
  playVictorySound,
  setMusicTrack,
  unlockAudio,
} from './audio/audioEngine'

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

function getLocalizedStorageWarning(message: string, t: (text: string, values?: Record<string, string | number>) => string) {
  const unavailable = message.match(/^Cloud sync (is|is still) unavailable(.*)\. Progress is being kept on this device\.$/)
  if (!unavailable) return t(message)
  const key = unavailable[1] === 'still'
    ? 'Cloud sync is still unavailable{reason}. Progress is being kept on this device.'
    : 'Cloud sync is unavailable{reason}. Progress is being kept on this device.'
  return t(key, { reason: unavailable[2] })
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
  const { t } = useI18n()
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
        }} aria-label={t('Escape Room Online home')}>
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>ESCAPE<span className="brand-light">ROOM</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="/" onClick={(event) => {
            event.preventDefault()
            onBackHome?.()
          }}>{t('Rooms')}</a>
          <a href="#room">{t('Leaderboard')}</a>
          <a href="#room">{t('How to play')}</a>
        </nav>
        <div className="player-chip">
          <span className="online-dot" />
          <span>{t('PLAYER 01')}</span>
          <span className="player-avatar" aria-hidden="true">H</span>
        </div>
      </header>

      <section className="game-content" id="room">
        <div className="room-heading">
          <div>
            <a className="back-link" href="#room"><span aria-hidden="true">←</span> {t('← ALL ROOMS')}</a>
            <div className="title-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> {t('ROOM 02')} <span className="eyebrow-dot">/</span> {t('THE INTERVIEW')}</div>
                <h1>{t('THE INTERVIEW')}</h1>
                <p className="room-subtitle">{t('Every answer brings you closer to the exit.')}</p>
              </div>
            </div>
          </div>
          <div className="room-status"><span className="status-dot" /> {t('ROOM IN PROGRESS')}</div>
        </div>

        <div className="game-grid">
          <section className="office-scene" aria-label={t('A mysterious interview room')}>
            <div className="scene-topline">
              <span><span className="live-indicator" /> {t('LIVE SCENE')}</span>
              <span className="scene-coordinate">{t('NIGHT SHIFT')} <span>·</span> 09:41 PM</span>
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
              <div className="person-label"><span className="label-dot" /> {t('THE INTERVIEWER')}</div>
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
              <span>{t('“Take your time. The right answer is already in you.”')}</span>
            </div>
            <div className="scene-floorshine" />
          </section>

          <aside className="room-sidebar">
            <div className="sidebar-panel">
              <div className="score-card">
                <span className="progress-label">{t('TOTAL SCORE')}</span>
                <strong>{score.toLocaleString()} {t('PTS')}</strong>
              </div>
              <div className="progress-track" aria-label={t('{percent}% complete', { percent: Math.round((correctCount / questions.length) * 100) })}>
                <span style={{ width: `${(correctCount / questions.length) * 100}%` }} />
              </div>
              <div className="step-list">
                {questions.map((item, index) => {
                  const isSolved = index < correctCount
                  const isCurrent = index === questionIndex && !complete
                  return (
                    <div className={`step-item${isSolved ? ' is-solved' : ''}${isCurrent ? ' is-current' : ''}`} key={item.category}>
                      <span className="step-icon">{isSolved ? '✓' : String(index + 1).padStart(2, '0')}</span>
                      <span className="step-name">{t(item.category)}</span>
                      <span className="step-state">{t(isSolved ? 'SOLVED' : isCurrent ? 'IN PLAY' : 'LOCKED')}</span>
                    </div>
                  )
                })}
              </div>
              <div className="divider" />
              <div className="password-title"><span>▣</span> {t('PASSWORD FRAGMENTS')}</div>
              <p className="password-caption">{t('Collect every fragment to unlock the door.')}</p>
              <div className="password-slots" aria-label={t('Password collected: {password}', { password: password || t('none yet') })}>
                {questions.map((item, index) => (
                  <span className={`password-slot${index < fragments.length ? ' is-filled' : ''}`} key={item.fragment}>
                    {fragments[index] ?? '•••'}
                  </span>
                ))}
              </div>
              <div className="room-tip"><span className="tip-icon">✧</span><span>{t('Think clearly. A great answer is honest, thoughtful, and specific.')}</span></div>
            </div>
          </aside>
        </div>

        <section className="question-card" aria-live="polite">
          {!complete ? (
            <>
              <div className="question-main">
                <div className="question-meta">
                  <span className="question-number">{t('QUESTION')} {String(questionIndex + 1).padStart(2, '0')}</span>
                  <span className="meta-divider" />
                  <span className="question-category">{t(question.category)}</span>
                </div>
                <h2>{t(question.prompt)}</h2>
                <div className="answer-list" role="group" aria-label={t('CHOOSE YOUR ANSWER')}>
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
                        <span className="choice-text">{t(choice.text)}</span>
                        <span className="choice-check">{isCorrect ? '✓' : isWrong ? '×' : '↗'}</span>
                      </button>
                    )
                  })}
                </div>
                {feedback === 'incorrect' && (
                  <p className="feedback feedback-error"><span>↻</span> {t('Not quite. Try another response, or use a hint to rethink what the interviewer is looking for.')}</p>
                )}
                {feedback === 'correct' && (
                  <p className="feedback feedback-success"><span>✦</span> {t('That’s a thoughtful answer. You found a password fragment:')} <strong>{question.fragment}</strong></p>
                )}
              </div>
              <div className="question-footer">
                <button className="hint-button" type="button" onClick={revealHint} aria-expanded={showHint}>
                  <span className="bulb-icon">✧</span> {t(showHint ? 'HIDE HINT' : 'NEED A HINT?')}
                </button>
                {showHint && <p className="hint-message">{t(question.hint)}</p>}
                <div className="footer-actions">
                  {!answered ? (
                    <button className="primary-button" type="button" onClick={submitAnswer} disabled={selectedChoice === null}>
                      {t('SUBMIT ANSWER')} <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="primary-button" type="button" onClick={continueGame}>
                      {t(questionIndex === questions.length - 1 ? 'UNLOCK THE EXIT' : 'NEXT QUESTION')} <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="completion-panel">
              <span className="completion-spark">✦</span>
              <div className="question-meta"><span className="question-number">{t('ROOM COMPLETE')}</span></div>
              <h2>{t('You nailed the interview.')}</h2>
              <p>{t('You collected every fragment and unlocked the next room.')}</p>
              <div className="completion-password"><span>{t('EXIT CODE')}</span><strong>{questions.map((item) => item.fragment).join('')}</strong><span className="completion-unlocked">{t('ROOM 03 UNLOCKED ✓')}</span></div>
              <button className="primary-button" type="button" onClick={onEnterRoomThree ?? (() => undefined)}>{t('ENTER ROOM 03')} <span aria-hidden="true">→</span></button>
            </div>
          )}
        </section>
        <footer className="game-footer">
          <span>ESCAPE ROOM ONLINE <span className="footer-separator">/</span> {t('ROOM 02')}</span>
          <span><span className="footer-lock">▣</span> {t('ROOM 02 · THE INTERVIEW')}</span>
        </footer>
      </section>
    </main>
  )
}

function App() {
  const { t } = useI18n()
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
      '/login': t('Escape Room Online | Login'),
      '/': t('Escape Room Online | Home'),
      '/rooms': t('Escape Room Online | Mission Control'),
      '/leaderboard': t('Escape Room Online | Leaderboard'),
      '/game-complete': t('Escape Room Online — Final Escape'),
      '/rooms/5': t('Escape Room Online — Final Room'),
    }

    const roomMatch = route.match(/^\/rooms\/([1-5])(?:\/|$)/)
    if (roomMatch) {
      document.title = t('Escape Room Online — Room {room}', { room: roomMatch[1] })
      return
    }

    document.title = titleByRoute[route] ?? t('Escape Room Online')
  }, [route, t])

  useEffect(() => {
    const roomMatch = route.match(/^\/rooms\/([1-5])(?:\/|$)/)
    const trackByRoute = {
      '/login': 'home',
      '/': 'home',
      '/rooms': 'home',
      '/rooms/1': 'room-1',
      '/rooms/2': 'room-2',
      '/rooms/3': 'room-3',
      '/rooms/4': 'room-4',
      '/rooms/5': 'room-5',
      '/game-complete': 'victory',
      '/leaderboard': 'home',
    } as const
    const track = roomMatch
      ? trackByRoute[`/rooms/${roomMatch[1]}` as keyof typeof trackByRoute]
      : trackByRoute[route as keyof typeof trackByRoute] ?? 'home'
    setMusicTrack(track)
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
    playSuccessSound()
    completeRoom(1, details.score, details.hintsUsed)
  }, [completeRoom])

  const handleRoomTwoComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    playSuccessSound()
    completeRoom(2, details.score, details.hintsUsed)
  }, [completeRoom])

  const handleRoomThreeComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    playSuccessSound()
    completeRoom(3, details.score, details.hintsUsed)
  }, [completeRoom])


    const handleRoomFourComplete = useCallback((details: { score: number; hintsUsed: number }) => {
    playSuccessSound()
    completeRoom(4, details.score, details.hintsUsed)
  }, [completeRoom])

    const handleRoomGameOver = useCallback(() => {
      playFailureSound()
    }, [])

  const handleLogin = useCallback(async (username: string, password: string) => {
    const nextPlayer = { username }
    try {
      await authenticateLocalPlayer(username, password)
      window.localStorage.setItem(PLAYER_KEY, JSON.stringify(nextPlayer))
      setProgress(loadProgress(username))
      setHydratedUsername(null)
      setStorageWarning('')
      setPlayer(nextPlayer)
      navigate('/')
    } catch (error) {
      if (error instanceof Error) throw error
      console.error('Could not create the local player session.', error)
      throw new Error('Your session could not be saved. Check your browser storage and try again.')
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
    playVictorySound()
    const previousBestKey = `escape-room-high-score:${playerKey ?? 'guest'}`
    let previousBest = 0
    try {
      previousBest = Number(window.localStorage.getItem(previousBestKey)) || 0
      window.localStorage.setItem(previousBestKey, String(Math.max(previousBest, details.score)))
    } catch (error) {
      console.error('Could not update the local high score.', error)
    }

    getLeaderboard()
      .then((entries) => {
        const leaderboardBest = entries[0]?.score ?? 0
        if (details.score > Math.max(previousBest, leaderboardBest)) {
          playRecordCelebration()
        }
      })
      .catch((error: unknown) => {
        console.error('Could not check the leaderboard record.', error)
        if (details.score > previousBest) playRecordCelebration()
      })

    completeRoom(5, details.score, details.hintsUsed)
    navigate('/game-complete')
  }, [completeRoom, navigate, playerKey])

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

  const roomsPage = (
    <div className="dashboard-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow-header">ESCAPE ROOM ONLINE</p>
          <h1>{t('Global mission control')}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={() => navigate('/')}>
            {t('HOME')}
          </button>
          <button className="primary-button small" type="button" onClick={() => navigate(continueTarget)}>
            {t('CONTINUE GAME')}
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow-header">{t('CURRENT STATUS')}</p>
          <h2>{t('Room progression and campaign summary')}</h2>
        </div>
        <div className="status-badge">{t(progress.gameCompleted ? 'COMPLETED' : 'IN PROGRESS')}</div>
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
              aria-label={t('ROOM {room}: {name}. {status}', {
                room: room.id,
                name: t(room.name),
                status: t(isCompleted ? 'COMPLETED' : isUnlocked ? 'UNLOCKED' : 'LOCKED'),
              })}
            >
              <span className="room-card-art" aria-hidden="true" />
              <span className="card-kicker">{t('ROOM 0{room}', { room: room.id })}</span>
              <h3>{t(room.name)}</h3>
              <p className="room-card-description">{t(room.description)}</p>
              <div className="room-card-state">
                {isCompleted && <span>{t('✓ COMPLETED')}</span>}
                {!isCompleted && isUnlocked && <span>◇ {t('UNLOCKED')} <b>{t('GO TO ROOM {room}', { room: room.id })} →</b></span>}
                {!isCompleted && !isUnlocked && <span>{t('⌑ LOCKED — COMPLETE ROOM {previous} TO UNLOCK', { previous: previousRoom?.id ?? '' })}</span>}
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
                <p className="eyebrow-header">{t('YOUR INVESTIGATION BEGINS')}</p>
                <h1>{t('Escape Room Online')}</h1>
              </div>
            </div>
            <div className="home-account">
              <span className="home-player">{t('AGENT')} <strong>{player?.username}</strong></span>
              <button className="ghost-button" type="button" onClick={handleLogout}>{t('SIGN OUT')}</button>
            </div>
          </header>

          <section className="home-panel">
            <div className="home-copy">
              <p className="eyebrow-header">{t('MISSION BRIEF')} <span className="brief-marker">/ {t('05 ROOMS')}</span></p>
              <h2>{t('Solve the puzzles,')}<br />{t('unlock the rooms.')}</h2>
              <p>
                {t('Solve the puzzles, unlock the rooms, and escape before time runs out.')}
              </p>
            </div>
            <div className="home-actions">
              <button className="primary-button" type="button" onClick={() => navigate('/rooms/1')}>
                {t('GO TO ROOM 1')} <span aria-hidden="true">→</span>
              </button>
              {progress.gameStarted && (
                <button className="ghost-button" type="button" onClick={() => navigate(continueTarget)}>
                  {t('CONTINUE GAME')}
                </button>
              )}
              <button className="home-restart-link" type="button" onClick={startGame}>
                {t(progress.gameStarted ? 'RESTART CAMPAIGN' : 'NEW INVESTIGATION')}
              </button>
            </div>
          </section>

          {storageWarning && (
            <div className="storage-warning" role="alert">
              <span>{getLocalizedStorageWarning(storageWarning, t)}</span>
              <button type="button" onClick={handleRetryCloudSync} disabled={isRetryingCloudSync}>
                {t(isRetryingCloudSync ? 'RETRYING…' : 'RETRY CLOUD SYNC')}
              </button>
            </div>
          )}

          <section className="progression-section" aria-labelledby="progression-title">
            <div className="progression-heading">
              <div>
                <p className="eyebrow-header">{t('THE ESCAPE SEQUENCE')}</p>
                <h2 id="progression-title">{t('Your path through the rooms')}</h2>
              </div>
              <span className="progression-count">{t('{count} / {total} CLEARED', { count: progress.completedRooms.length, total: ROOM_CONFIG.length })}</span>
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
                    aria-label={t('ROOM {room}: {name}. {status}', {
                      room: room.id,
                      name: t(room.name),
                      status: t(isCompleted ? 'COMPLETED' : isUnlocked ? 'UNLOCKED' : 'LOCKED'),
                    })}
                  >
                    <span className="room-card-art" aria-hidden="true" />
                    <span className="room-card-topline"><span>{t('ROOM 0{room}', { room: room.id })}</span><i>{isCompleted ? '✓' : isUnlocked ? '◇' : '⌑'}</i></span>
                    <span className="room-card-copy">
                      <strong>{t(room.name)}</strong>
                      <span>{t(room.description)}</span>
                    </span>
                    <span className={`room-card-state ${isUnlocked ? 'state-open' : 'state-locked'}`}>
                      {isCompleted
                        ? t('✓ COMPLETED')
                        : isUnlocked
                          ? <>{t('◇ UNLOCKED')} <b>{t('GO TO ROOM {room}', { room: room.id })} <i aria-hidden="true">→</i></b></>
                          : <>⌑ {t('LOCKED')} <small>{t('Complete Room {previous} to unlock.', { previous: previousRoom?.id ?? '' })}</small></>}
                    </span>
                    {index < ROOM_CONFIG.length - 1 && <span className="room-connector" aria-hidden="true">→</span>}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="summary-grid">
            <div className="summary-card">
              <span>{t('ROOMS COMPLETED')}</span>
              <strong>{progress.completedRooms.length}/{ROOM_CONFIG.length}</strong>
            </div>
            <div className="summary-card">
              <span>{t('SCORE')}</span>
              <strong>{progress.score.toLocaleString()} {t('PTS')}</strong>
            </div>
            <div className="summary-card">
              <span>{t('HINTS USED')}</span>
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
            <p className="eyebrow-header">{t('ALL ROOMS COMPLETE')}</p>
            <h1>{t('YOU ESCAPED!')}</h1>
            <div className="final-score-box">
              <span>{t('FINAL SCORE')}</span>
              <strong>{progress.score.toLocaleString()}</strong>
            </div>
            <div className="final-meta">
              <span>{t('ROOMS COMPLETED')}: {progress.completedRooms.length}</span>
              <span>{t('HINTS USED')}: {progress.hintsUsed}</span>
            </div>
            <div className="final-actions">
              <button className="primary-button" type="button" onClick={() => navigate('/leaderboard')}>
                {t('VIEW LEADERBOARD')}
              </button>
              <button className="ghost-button" type="button" onClick={() => navigate('/rooms')}>
                {t('VIEW ROOMS')}
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
            <p className="eyebrow-header">{t('LEADERBOARD')}</p>
            <h1>{t('Top operators')}</h1>
            {leaderboardError && <p className="storage-warning" role="alert">{leaderboardError}</p>}
            <ol className="leaderboard-list">
              {leaderboardEntries.map((entry, index) => (
                <li key={entry.name}>
                  <span>#{index + 1}</span>
                  <strong>{entry.name}</strong>
                  <em>{entry.score.toLocaleString()} {t('PTS')}</em>
                </li>
              ))}
            </ol>
            {!leaderboardError && leaderboardEntries.length === 0 && (
              <p>{t('No completed runs are on the leaderboard yet.')}</p>
            )}
            <button className="primary-button" type="button" onClick={() => navigate('/')}>
              {t('BACK HOME')}
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
          onGameOver={handleRoomGameOver}
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
          onGameOver={handleRoomGameOver}
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
          onGameOver={handleRoomGameOver}
        />
      )
    }

    if (route.startsWith('/rooms/5')) {
      if (!progress.unlockedRooms.includes(5)) return null
      return (
        <FinalRoom
          initialScore={progress.score}
          onComplete={handleRoomFiveComplete}
          onGameOver={handleRoomGameOver}
        />
      )
    }

    return <div>{roomsPage}</div>
  }

  return (
    <div
      className="app-audio-root"
      onPointerDownCapture={() => { unlockAudio() }}
      onKeyDownCapture={() => { unlockAudio() }}
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest('button, a')) {
          playUiSound()
        }
      }}
    >
      <LanguageSwitcher />
      {!player ? <LoginPage onLogin={handleLogin} /> : renderContent()}
      <AudioControls />
    </div>
  )
}

export default App
