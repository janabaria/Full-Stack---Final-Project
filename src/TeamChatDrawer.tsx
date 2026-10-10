import { useEffect, useRef, useState, type FormEvent } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getSupabaseClient } from './supabaseClient'
import './TeamChatDrawer.css'

export type SharedRoomState = {
  currentRoom: number
  completedRooms: number[]
  score: number
  inventory: string[]
}

type ChatMessage = {
  id: string
  room_id: string
  username: string
  message: string
  created_at: string
  system?: boolean
}

type TeamChatDrawerProps = {
  roomNumber: number
  playerName: string
  mode: 'solo' | 'team'
  teamCode: string
  progress: SharedRoomState
  onSharedState: (state: SharedRoomState) => void
  onRegisterPuzzleSolved: (send: ((room: number, state: SharedRoomState) => void) | null) => void
}

type ServerToClientEvents = {
  'team:error': (data: { message: string }) => void
  'room:joined': (data: { state: SharedRoomState; messages: ChatMessage[] }) => void
  'room:state': (state: SharedRoomState) => void
  'chat:message': (message: ChatMessage) => void
  'chat:error': (data: { message: string }) => void
}

type ClientToServerEvents = {
  'team:join': (data: { teamCode: string; roomNumber: number }) => void
  'room:state:update': (state: SharedRoomState) => void
  'chat:send': (data: { message: string }) => void
  'puzzle:solved': (data: { roomNumber: number; state: SharedRoomState }) => void
}

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin
function isSharedRoomState(value: unknown): value is SharedRoomState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return Number.isInteger(state.currentRoom) &&
    Number(state.currentRoom) >= 1 &&
    Number(state.currentRoom) <= 5 &&
    Array.isArray(state.completedRooms) &&
    state.completedRooms.every((room) => Number.isInteger(room) && Number(room) >= 1 && Number(room) <= 5) &&
    Number.isSafeInteger(state.score) &&
    Number(state.score) >= 0 &&
    Array.isArray(state.inventory) &&
    state.inventory.length <= 100 &&
    state.inventory.every((item) => typeof item === 'string' && item.length <= 120)
}

export default function TeamChatDrawer({
  roomNumber,
  playerName,
  mode,
  teamCode,
  progress,
  onSharedState,
  onRegisterPuzzleSolved,
}: TeamChatDrawerProps) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const lastReceivedState = useRef('')

  useEffect(() => {
    if (mode !== 'team' || !teamCode) return
    let active = true
    let nextSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
    let authSubscriptionCleanup = () => {}

    void getSupabaseClient().auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) {
        setError(`Could not get your login session: ${sessionError.message}`)
        return
      }
      const token = data.session?.access_token
      if (!token) {
        setError('Sign in with Supabase to use team chat.')
        return
      }

      nextSocket = io(socketUrl, { autoConnect: false, auth: { token } })
      nextSocket.on('connect', () => {
        setConnected(true)
        setError('')
      })
      nextSocket.on('disconnect', () => setConnected(false))
      nextSocket.on('connect_error', (connectError) => {
        setConnected(false)
        setError(`Team connection failed: ${connectError.message}`)
      })
      nextSocket.on('team:error', ({ message }) => setError(message))
      nextSocket.on('room:joined', ({ state, messages: history }) => {
        if (!isSharedRoomState(state)) {
          setError('The server returned an invalid shared game state.')
          return
        }
        lastReceivedState.current = JSON.stringify(state)
        setMessages(history.map((message) => ({ ...message, system: message.username === 'SYSTEM' })))
        onSharedState(state)
      })
      nextSocket.on('room:state', (state) => {
        if (!isSharedRoomState(state)) return
        lastReceivedState.current = JSON.stringify(state)
        onSharedState(state)
      })
      nextSocket.on('chat:message', (message) => {
        setMessages((current) => [...current.slice(-99), message])
      })
      nextSocket.on('chat:error', ({ message }) => setError(message))
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
      authSubscriptionCleanup = () => subscription.unsubscribe()
    }).catch((sessionError: unknown) => {
      if (active) setError(sessionError instanceof Error ? sessionError.message : 'Could not connect to team chat.')
    })

    return () => {
      active = false
      authSubscriptionCleanup()
      nextSocket?.disconnect()
    }
  }, [mode, onSharedState, roomNumber, teamCode])

  useEffect(() => {
    if (!connected || !socket?.connected || !teamCode) return
    socket.emit('team:join', { teamCode, roomNumber })
  }, [connected, roomNumber, socket, teamCode])

  useEffect(() => {
    if (!connected || !socket?.connected || !teamCode) return
    const state = {
      currentRoom: progress.currentRoom,
      completedRooms: progress.completedRooms,
      score: progress.score,
      inventory: progress.inventory,
    }
    const serialized = JSON.stringify(state)
    if (serialized === lastReceivedState.current) {
      lastReceivedState.current = ''
      return
    }
    socket.emit('room:state:update', state)
  }, [connected, progress, roomNumber, socket, teamCode])

  useEffect(() => {
    const sendPuzzleSolved = (solvedRoom: number, state: SharedRoomState) => {
      if (socket?.connected && teamCode && solvedRoom === roomNumber) {
        socket.emit('puzzle:solved', { roomNumber: solvedRoom, state })
      }
    }
    onRegisterPuzzleSolved(sendPuzzleSolved)
    return () => onRegisterPuzzleSolved(null)
  }, [onRegisterPuzzleSolved, roomNumber, socket, teamCode])

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || !teamCode || !socket?.connected) return
    socket.emit('chat:send', { message })
    setDraft('')
  }

  async function copyTeamCode() {
    try {
      await navigator.clipboard.writeText(teamCode)
    } catch (clipboardError) {
      setError(clipboardError instanceof Error ? `Could not copy team code: ${clipboardError.message}` : 'Could not copy the team code.')
    }
  }

  return (
    <aside className={`team-chat${open ? ' is-open' : ''}`} aria-label="Team chat">
      <button
        className="team-chat-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close team chat' : 'Open team chat'}
      >
        <span aria-hidden="true">✉</span>
        <span>TEAM CHAT</span>
        <i className={connected && mode === 'team' ? 'is-connected' : ''} aria-label={connected && mode === 'team' ? 'Connected' : 'Disconnected'} />
      </button>
      {open && (
        <section className="team-chat-panel">
          <header className="team-chat-header">
            <div>
              <span className="team-chat-kicker">MAZORA / CO-OP</span>
              <h2>Team channel</h2>
            </div>
            <button type="button" aria-label="Close team chat" onClick={() => setOpen(false)}>×</button>
          </header>
          {mode === 'solo' ? (
            <div className="team-chat-team-controls">
              <p>Team chat is available in Team Multiplayer mode. Choose a mode on the Home page to start a team session.</p>
            </div>
          ) : (
            <>
              <div className="team-chat-team-code">
                <span>TEAM CODE</span>
                <strong>{teamCode}</strong>
                <button type="button" onClick={() => void copyTeamCode()}>Copy</button>
              </div>
              <div className="team-chat-shared-state">
                <span>ROOM {String(roomNumber).padStart(2, '0')} / {progress.completedRooms.includes(roomNumber) ? 'SOLVED' : 'IN PLAY'}</span>
                <strong>{progress.score.toLocaleString()} PTS</strong>
                <small>Team inventory: {progress.inventory.length ? progress.inventory.join(', ') : 'Nothing collected yet'}</small>
              </div>
              <div className="team-chat-messages" aria-live="polite">
                {messages.length === 0 && <p className="team-chat-empty">No messages yet. Coordinate your escape.</p>}
                {messages.map((message) => (
                  <article className={`team-chat-message${message.system ? ' is-system' : ''}`} key={message.id}>
                    {!message.system && <strong>{message.username === playerName ? 'You' : message.username}</strong>}
                    <p>{message.message}</p>
                    <time dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </article>
                ))}
              </div>
              <form className="team-chat-compose" onSubmit={sendMessage}>
                <label className="visually-hidden" htmlFor="team-message">Message your team</label>
                <input
                  id="team-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={500}
                  placeholder="Send a message..."
                  disabled={!connected}
                />
                <button type="submit" disabled={!connected || !draft.trim()}>Send</button>
              </form>
            </>
          )}
          {error && <p className="team-chat-error" role="alert">{error}</p>}
          <footer className="team-chat-status">
            <i className={connected ? 'is-connected' : ''} />
            {mode === 'solo' ? 'Solo mode · team chat offline' : connected ? 'Secure connection' : 'Connecting…'}
          </footer>
        </section>
      )}
    </aside>
  )
}
