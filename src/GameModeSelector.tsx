import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getSupabaseClient } from './supabaseClient'
import './GameModeSelector.css'

export type GameMode = 'solo' | 'team'

export type GameSessionConfig = {
  mode: GameMode
  roomId: string
  teamCode: string
}

type GameModeSelectorProps = {
  value: GameSessionConfig
  roomNumber: number
  onChange: (value: GameSessionConfig) => void
  onRegisterRoomEntry: (enter: ((roomNumber: number) => Promise<void>) | null) => void
  onTeamNavigate: (roomNumber: number, state: SharedRoomState | null) => void
  onSharedState: (state: SharedRoomState) => void
  onTeamLeaderboard: (entries: TeamLeaderboardEntry[]) => void
  onTeamNotice: (message: string) => void
}

export type SharedRoomState = {
  currentRoom: number
  completedRooms: number[]
  score: number
  inventory: string[]
}

export type TeamLeaderboardEntry = {
  userId: string
  username: string
  score: number
  completedRooms: number[]
  elapsedMs: number
  finished: boolean
}

type ServerToClientEvents = {
  'team:created': (data: { teamCode: string }) => void
  'team:error': (data: { message: string }) => void
  'room:joined': () => void
  'quick-match:waiting': (data: { message: string }) => void
  'quick-match:matched': (data: { teamCode: string }) => void
  'team:scoreboard': (entries: TeamLeaderboardEntry[]) => void
  'team:leaderboard': (entries: TeamLeaderboardEntry[]) => void
  'team:notice': (notice: { id: string; message: string; created_at: string }) => void
  'room:state': (state: SharedRoomState) => void
  'navigate_room': (data: { roomNumber: number; state: SharedRoomState | null }) => void
}

type ClientToServerEvents = {
  'team:create': () => void
  'team:join': (data: { teamCode: string; roomNumber: number }) => void
  'game:enter': (
    data: { teamCode: string; roomNumber: number },
    acknowledge: (result: { roomId?: string; error?: string }) => void,
  ) => void
  'quick-match:join': (data: { roomNumber: number }) => void
  'quick-match:cancel': () => void
}

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin

export default function GameModeSelector({
  value,
  roomNumber,
  onChange,
  onRegisterRoomEntry,
  onTeamNavigate,
  onSharedState,
  onTeamLeaderboard,
  onTeamNotice,
}: GameModeSelectorProps) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const [connected, setConnected] = useState(false)
  const [teamCode, setTeamCode] = useState('')
  const [pending, setPending] = useState<'join' | 'quick' | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const pendingCode = useRef('')
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const teamCodeRef = useRef(value.teamCode)
  const roomNumberRef = useRef(roomNumber)

  useEffect(() => {
    teamCodeRef.current = value.teamCode
    roomNumberRef.current = roomNumber
  }, [roomNumber, value.teamCode])

  const enterTeamRoom = useCallback(async (targetRoom: number) => {
    if (!value.teamCode) throw new Error('Create or join a team before entering a room.')
    const activeSocket = socketRef.current
    if (!activeSocket?.connected) throw new Error('The team connection is not ready. Try again in a moment.')

    const roomId = await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Joining the selected team room timed out. Please try again.'))
      }, 8000)
      activeSocket.emit('game:enter', {
        teamCode: value.teamCode,
        roomNumber: targetRoom,
      }, (result) => {
        window.clearTimeout(timeout)
        if (result.error || !result.roomId) {
          reject(new Error(result.error ?? 'Could not enter the selected team room.'))
          return
        }
        resolve(result.roomId)
      })
    })
    onChange({ mode: 'team', teamCode: value.teamCode, roomId })
  }, [onChange, value.teamCode])

  useEffect(() => {
    if (value.mode !== 'team') return
    let active = true
    let nextSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
    let authCleanup = () => {}

    void getSupabaseClient().auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) {
        setError(`Could not get your login session: ${sessionError.message}`)
        return
      }
      if (!data.session) {
        setError('Sign in again to create or join a team.')
        return
      }

      nextSocket = io(socketUrl, { autoConnect: false, auth: { token: data.session.access_token } })
      socketRef.current = nextSocket
      nextSocket.on('connect', () => {
        setConnected(true)
        setError('')
        if (teamCodeRef.current) {
          nextSocket?.emit('team:join', {
            teamCode: teamCodeRef.current,
            roomNumber: roomNumberRef.current,
          })
        }
      })
      nextSocket.on('disconnect', () => setConnected(false))
      nextSocket.on('room:state', (state) => onSharedState(state))
      nextSocket.on('navigate_room', ({ roomNumber: targetRoom, state }) => {
        onTeamNavigate(targetRoom, state)
      })
      nextSocket.on('team:leaderboard', onTeamLeaderboard)
      nextSocket.on('team:notice', ({ message }) => onTeamNotice(message))
      nextSocket.on('connect_error', (connectError) => {
        setConnected(false)
        setError(`Team connection failed: ${connectError.message}`)
      })
      nextSocket.on('team:created', ({ teamCode: createdCode }) => {
        setPending(null)
        setStatus(`Team ${createdCode} is ready. Share the code with your teammates.`)
        onChange({ mode: 'team', teamCode: createdCode, roomId: `team-${createdCode}-room-${roomNumber}` })
      })
      nextSocket.on('team:error', ({ message }) => {
        pendingCode.current = ''
        setPending(null)
        setStatus('')
        setError(message)
      })
      nextSocket.on('room:joined', () => {
        if (!pendingCode.current) return
        const joinedCode = pendingCode.current
        pendingCode.current = ''
        setPending(null)
        setError('')
        setStatus(`Joined team ${joinedCode}.`)
        onChange({ mode: 'team', teamCode: joinedCode, roomId: `team-${joinedCode}-room-${roomNumber}` })
      })
      nextSocket.on('quick-match:waiting', ({ message }) => {
        setPending('quick')
        setStatus(message)
      })
      nextSocket.on('quick-match:matched', ({ teamCode: matchedCode }) => {
        setPending(null)
        setError('')
        setStatus(`Quick match found. Team code: ${matchedCode}`)
        onChange({ mode: 'team', teamCode: matchedCode, roomId: `team-${matchedCode}-room-${roomNumber}` })
      })
      nextSocket.connect()
      setSocket(nextSocket)

      const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
        if (!session) {
          nextSocket?.disconnect()
          setConnected(false)
          return
        }
        if (nextSocket) {
          nextSocket.auth = { token: session.access_token }
          if (nextSocket.connected) {
            nextSocket.disconnect()
            nextSocket.connect()
          }
        }
      })
      authCleanup = () => subscription.unsubscribe()
    }).catch((sessionError: unknown) => {
      if (active) setError(sessionError instanceof Error ? sessionError.message : 'Could not connect to team services.')
    })

    return () => {
      active = false
      authCleanup()
      nextSocket?.disconnect()
      if (socketRef.current === nextSocket) socketRef.current = null
    }
  }, [onChange, onSharedState, onTeamLeaderboard, onTeamNavigate, onTeamNotice, roomNumber, value.mode])

  useEffect(() => {
    if (value.mode !== 'team') {
      onRegisterRoomEntry(null)
      return
    }
    onRegisterRoomEntry(enterTeamRoom)
    return () => onRegisterRoomEntry(null)
  }, [enterTeamRoom, onRegisterRoomEntry, value.mode])

  function selectMode(mode: GameMode) {
    socket?.emit('quick-match:cancel')
    pendingCode.current = ''
    setPending(null)
    setStatus('')
    setError('')
    onChange({ mode, teamCode: '', roomId: mode === 'team' ? '' : 'solo' })
  }

  function createTeam() {
    if (!socket?.connected) {
      setError('Connect to the game server before creating a team.')
      return
    }
    setError('')
    setStatus('Creating a team…')
    socket.emit('team:create')
  }

  function joinTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = teamCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError('Enter a valid 6-character team code.')
      return
    }
    if (!socket?.connected) {
      setError('Connect to the game server before joining a team.')
      return
    }
    setError('')
    setStatus(`Joining team ${code}…`)
    setPending('join')
    pendingCode.current = code
    socket.emit('team:join', { teamCode: code, roomNumber })
  }

  function quickMatch() {
    if (!socket?.connected) {
      setError('Connect to the game server before starting Quick Match.')
      return
    }
    setError('')
    setStatus('Finding another agent…')
    setPending('quick')
    socket.emit('quick-match:join', { roomNumber })
  }

  function cancelQuickMatch() {
    socket?.emit('quick-match:cancel')
    setPending(null)
    setStatus('Quick match cancelled.')
  }

  return (
    <section className="game-mode-card" aria-labelledby="game-mode-heading">
      <div className="game-mode-heading">
        <div>
          <p className="eyebrow-header">CHOOSE YOUR EXPERIENCE</p>
          <h2 id="game-mode-heading">How do you want to play?</h2>
        </div>
        <span className={`game-mode-connection${connected ? ' is-connected' : ''}`}>
          <i /> {value.mode === 'solo' ? 'SOCKET SYNC OFF' : connected ? 'SERVER ONLINE' : 'CONNECTING'}
        </span>
      </div>
      <div className="game-mode-options">
        <button
          type="button"
          className={`game-mode-option${value.mode === 'solo' ? ' is-selected' : ''}`}
          onClick={() => selectMode('solo')}
          aria-pressed={value.mode === 'solo'}
        >
          <span className="game-mode-option-icon" aria-hidden="true">◈</span>
          <span><strong>Solo mode</strong><small>Solve every room at your own pace.</small></span>
          <i aria-hidden="true">{value.mode === 'solo' ? '✓' : ''}</i>
        </button>
        <button
          type="button"
          className={`game-mode-option${value.mode === 'team' ? ' is-selected' : ''}`}
          onClick={() => selectMode('team')}
          aria-pressed={value.mode === 'team'}
        >
          <span className="game-mode-option-icon" aria-hidden="true">♧</span>
          <span><strong>Team multiplayer</strong><small>Coordinate puzzles and share progress live.</small></span>
          <i aria-hidden="true">{value.mode === 'team' ? '✓' : ''}</i>
        </button>
      </div>
      {value.mode === 'team' && (
        <div className="game-mode-team-controls">
          <div className="game-mode-team-actions">
            <button type="button" onClick={createTeam} disabled={!connected || Boolean(pending)}>
              Create room
            </button>
            <button type="button" onClick={quickMatch} disabled={!connected || Boolean(pending)}>
              {pending === 'quick' ? 'Searching…' : 'Quick match'}
            </button>
            {pending === 'quick' && <button type="button" className="game-mode-cancel" onClick={cancelQuickMatch}>Cancel</button>}
          </div>
          <form className="game-mode-join" onSubmit={joinTeam}>
            <label htmlFor="home-team-code">Have a room code?</label>
            <div>
              <input
                id="home-team-code"
                value={teamCode}
                onChange={(event) => setTeamCode(event.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
                placeholder="ABC123"
              />
              <button type="submit" disabled={!connected || Boolean(pending)}>Join room</button>
            </div>
          </form>
          {value.teamCode && (
            <p className="game-mode-active-team">Active team: <strong>{value.teamCode}</strong></p>
          )}
          {status && <p className="game-mode-status" role="status">{status}</p>}
          {error && <p className="game-mode-error" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}
