import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Server } from 'socket.io'

const app = express()
const server = createServer(app)
const roomOrder = [1, 2, 3, 4, 5]
const port = Number(process.env.PORT) || 3001
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const clientPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
let supabase
let supabaseConfigError = ''

app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '32kb' }))

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 16_384,
})
const activeTeams = new Set()
const sharedRoomStates = new Map()
const quickMatchQueues = new Map()
const teamMembers = new Map()
const teamRaces = new Map()

function createTeamCode() {
  let teamCode
  do {
    teamCode = randomBytes(4).toString('hex').slice(0, 6).toUpperCase()
  } while (activeTeams.has(teamCode))
  activeTeams.add(teamCode)
  return teamCode
}

function removeFromQuickMatchQueue(socketId) {
  for (const [roomNumber, socketIds] of quickMatchQueues) {
    const waiting = socketIds.filter((id) => id !== socketId)
    if (waiting.length) quickMatchQueues.set(roomNumber, waiting)
    else quickMatchQueues.delete(roomNumber)
  }
}

function getTeamSharedState(teamCode) {
  let state = null
  for (const roomNumber of roomOrder) {
    state = mergeSharedRoomState(
      state,
      sharedRoomStates.get(`team-${teamCode}-room-${roomNumber}`) ?? null,
    )
  }
  return state
}

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    supabaseConfigError = 'SUPABASE_URL is missing from the server environment.'
    return null
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    supabaseConfigError = 'SUPABASE_URL is invalid. Use the HTTPS Project URL from Supabase, not a database connection string.'
    return null
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    supabaseConfigError = 'SUPABASE_URL must be the HTTPS Project URL ending in .supabase.co.'
    return null
  }

  if (!serviceRoleKey) {
    supabaseConfigError = 'SUPABASE_SERVICE_ROLE_KEY is missing from the server environment.'
    return null
  }

  if (!supabase) {
    try {
      supabase = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    } catch {
      supabaseConfigError = 'Supabase client configuration is invalid. Check the Project URL and server service-role key.'
      return null
    }
  }

  supabaseConfigError = ''
  return supabase
}

function normalizedUsername(value) {
  if (typeof value !== 'string') return null
  const username = value.trim().toLocaleLowerCase()
  return username.length > 0 && username.length <= 80 ? username : null
}

function validateProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const { currentRoom, completedRooms, score, hintsUsed, gameStarted } = value
  const integerInRange = (number, min, max) =>
    Number.isSafeInteger(number) && number >= min && number <= max

  if (!integerInRange(score, 0, 10_000_000)) return null
  if (!integerInRange(hintsUsed, 0, 100_000)) return null
  if (!integerInRange(currentRoom, 1, roomOrder.length)) return null
  if (typeof gameStarted !== 'boolean' || !Array.isArray(completedRooms)) return null

  const completed = [...new Set(completedRooms)]
  if (
    completed.some((room) => !roomOrder.includes(room)) ||
    completed.length !== completedRooms.length
  ) {
    return null
  }

  completed.sort((left, right) => roomOrder.indexOf(left) - roomOrder.indexOf(right))
  if (completed.some((room, index) => room !== roomOrder[index])) return null

  const unlockedRooms = Array.from(
    { length: Math.min(completed.length + 1, roomOrder.length) },
    (_, index) => roomOrder[index],
  )

  if (currentRoom > unlockedRooms.length) return null

  return {
    currentRoom,
    completedRooms: completed,
    unlockedRooms,
    score,
    hintsUsed,
    gameStarted,
    gameCompleted: completed.length === roomOrder.length,
  }
}

function requireDatabase(res) {
  const database = getSupabase()
  if (!database) {
    res.status(503).json({ error: supabaseConfigError })
    return null
  }
  return database
}

async function authenticateToken(token) {
  const database = getSupabase()
  if (!database || typeof token !== 'string' || !token) return null
  const { data, error } = await database.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

async function requireAuthenticatedUser(req, res, next) {
  const authorization = req.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const user = await authenticateToken(token)
  if (!user) {
    if (!getSupabase()) {
      res.status(503).json({ error: supabaseConfigError })
      return
    }
    res.status(401).json({ error: 'A valid Supabase access token is required.' })
    return
  }
  req.authUser = user
  next()
}

function userProgressIdentity(req, res) {
  const username = normalizedUsername(req.params.username)
  const authenticatedEmail = normalizedUsername(req.authUser?.email)
  if (!username || !authenticatedEmail) {
    res.status(400).json({ error: 'A valid account email is required.' })
    return null
  }
  if (username !== authenticatedEmail) {
    res.status(403).json({ error: 'You can only access progress for your signed-in account.' })
    return null
  }
  return username
}

function validTeamCode(value) {
  return typeof value === 'string' && /^[A-Z0-9]{6}$/.test(value)
}

function validatedSharedState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { currentRoom, completedRooms, score, inventory } = value
  if (!Number.isSafeInteger(currentRoom) || currentRoom < 1 || currentRoom > roomOrder.length) return null
  if (!Number.isSafeInteger(score) || score < 0 || score > 10_000_000) return null
  if (!Array.isArray(completedRooms) || completedRooms.length > roomOrder.length) return null
  if (
    completedRooms.some((room, index) => !roomOrder.includes(room) || (index > 0 && room <= completedRooms[index - 1])) ||
    completedRooms.some((room, index) => room !== roomOrder[index])
  ) return null
  if (!Array.isArray(inventory) || inventory.length > 100) return null
  if (inventory.some((item) => typeof item !== 'string' || item.length > 120)) return null

  return {
    currentRoom,
    completedRooms,
    score,
    inventory: [...new Set(inventory)],
  }
}

function mergeSharedRoomState(currentState, nextState) {
  if (!currentState) return nextState
  return {
    currentRoom: Math.max(currentState.currentRoom, nextState.currentRoom),
    completedRooms: roomOrder.filter((room) =>
      currentState.completedRooms.includes(room) || nextState.completedRooms.includes(room)),
    score: Math.max(currentState.score, nextState.score),
    inventory: [...new Set([...currentState.inventory, ...nextState.inventory])],
  }
}

function getPlayerName(user) {
  const metadataName = user.user_metadata?.username
  const candidate = typeof metadataName === 'string' ? metadataName.trim() : ''
  return (candidate || user.email?.split('@')[0] || 'Player').slice(0, 80)
}

function getTeamRoster(teamCode) {
  const members = teamMembers.get(teamCode)
  const race = teamRaces.get(teamCode)
  if (!members) return []
  return [...members.values()]
    .filter((member) => member.connections.size > 0)
    .map((member) => {
      const playerRace = race?.players.get(member.userId)
      return {
        userId: member.userId,
        username: member.username,
        currentRoom: [...member.connections.values()].filter(Number.isSafeInteger).pop() ?? null,
        score: playerRace?.score ?? 0,
        completedRooms: playerRace?.completedRooms ?? [],
      }
    })
}

function publishTeamRoster(teamCode) {
  io.to(`team-${teamCode}`).emit('team:roster', getTeamRoster(teamCode))
  const race = teamRaces.get(teamCode)
  if (race) {
    io.to(`team-${teamCode}`).emit('team:scoreboard', getTeamRaceStandings(teamCode, true))
  }
}

function getTeamRaceStandings(teamCode, activeOnly = false) {
  const race = teamRaces.get(teamCode)
  if (!race) return []
  const activeUserIds = new Set(getTeamRoster(teamCode).map((member) => member.userId))
  return [...race.players.values()]
    .filter((player) => !activeOnly || activeUserIds.has(player.userId))
    .map((player) => ({
      userId: player.userId,
      username: player.username,
      score: player.score,
      completedRooms: [...player.completedRooms],
      elapsedMs: player.finishedAt
        ? player.finishedAt - race.startedAt
        : race.startedAt ? Date.now() - race.startedAt : 0,
      finished: player.completedRooms.length === roomOrder.length,
    }))
    .sort((left, right) => right.score - left.score || left.elapsedMs - right.elapsedMs)
}

function updateTeamRace(teamCode, user) {
  let race = teamRaces.get(teamCode)
  if (!race) {
    race = { startedAt: 0, leaderboardPublished: false, players: new Map() }
    teamRaces.set(teamCode, race)
  }
  let player = race.players.get(user.id)
  if (!player) {
    player = {
      userId: user.id,
      username: getPlayerName(user),
      score: 0,
      completedRooms: [],
      finishedAt: 0,
    }
    race.players.set(user.id, player)
  }
  return { race, player }
}

function startTeamRace(teamCode) {
  let race = teamRaces.get(teamCode)
  if (!race) {
    race = { startedAt: 0, leaderboardPublished: false, players: new Map() }
    teamRaces.set(teamCode, race)
  }
  if (!race.startedAt) race.startedAt = Date.now()
  for (const member of teamMembers.get(teamCode)?.values() ?? []) {
    const player = race.players.get(member.userId)
    if (!player) {
      race.players.set(member.userId, {
        userId: member.userId,
        username: member.username,
        score: 0,
        completedRooms: [],
        finishedAt: 0,
      })
    }
  }
  publishTeamRoster(teamCode)
}

function addSocketToTeam(socket, teamCode, roomNumber = null) {
  const previousTeamCode = socket.data.teamCode
  if (previousTeamCode && previousTeamCode !== teamCode) {
    if (socket.data.roomId) socket.leave(socket.data.roomId)
    socket.leave(`team-${previousTeamCode}`)
    const previousMembers = teamMembers.get(previousTeamCode)
    const previousMember = previousMembers?.get(socket.data.user.id)
    previousMember?.connections.delete(socket.id)
    publishTeamRoster(previousTeamCode)
  }

  let members = teamMembers.get(teamCode)
  if (!members) {
    members = new Map()
    teamMembers.set(teamCode, members)
  }
  let member = members.get(socket.data.user.id)
  const isNewMember = !member
  if (!member) {
    member = {
      userId: socket.data.user.id,
      username: getPlayerName(socket.data.user),
      connections: new Map(),
    }
    members.set(socket.data.user.id, member)
  }
  member.connections.set(socket.id, roomNumber)
  socket.data.teamCode = teamCode
  socket.join(`team-${teamCode}`)
  updateTeamRace(teamCode, socket.data.user)
  if (isNewMember) {
    io.to(`team-${teamCode}`).emit('team:notice', {
      id: randomUUID(),
      message: `${member.username} joined the team!`,
      created_at: new Date().toISOString(),
    })
  }
  publishTeamRoster(teamCode)
}

async function saveMessage(database, row) {
  const { error } = await database.from('messages').insert({
    id: row.id,
    room_id: row.room_id,
    username: row.username,
    message: row.message,
    created_at: row.created_at,
  })
  if (error) console.error('Supabase chat message save failed:', error.message)
}

async function joinTeamRoom(socket, teamCode, roomNumber) {
  if (!validTeamCode(teamCode) || !activeTeams.has(teamCode)) {
    throw new Error('That team code is invalid or its team is not active.')
  }
  if (!Number.isSafeInteger(roomNumber) || !roomOrder.includes(roomNumber)) {
    throw new Error('Choose a valid game room (1–5).')
  }

  addSocketToTeam(socket, teamCode, roomNumber)
  const roomId = `team-${teamCode}-room-${roomNumber}`
  if (socket.data.roomId) await socket.leave(socket.data.roomId)
  socket.data.roomId = roomId
  socket.data.teamCode = teamCode
  socket.data.roomNumber = roomNumber
  await socket.join(roomId)

  const database = getSupabase()
  let messages = []
  if (database) {
    try {
      const { data, error } = await database
        .from('messages')
        .select('id, room_id, username, message, created_at')
        .in('room_id', [roomId, `team-${teamCode}`])
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) console.error('Supabase chat history read failed:', error.message)
      else messages = (data ?? []).reverse()
    } catch (error) {
      console.error('Supabase chat history read failed:', error)
      socket.emit('chat:error', { message: 'Chat history could not be loaded.' })
    }
  }

  socket.emit('room:joined', {
    roomId,
    state: getTeamSharedState(teamCode) ?? {
      currentRoom: roomNumber,
      completedRooms: [],
      score: 0,
      inventory: [],
    },
    messages,
  })
  return roomId
}

io.use(async (socket, next) => {
  try {
    const user = await authenticateToken(socket.handshake.auth?.token)
    if (!user) {
      next(new Error('A valid Supabase login is required.'))
      return
    }
    socket.data.user = user
    next()
  } catch (error) {
    console.error('Socket authentication failed:', error)
    next(new Error('Could not authenticate the Socket.IO connection.'))
  }
})

io.on('connection', (socket) => {
  socket.on('team:create', () => {
    const teamCode = createTeamCode()
    addSocketToTeam(socket, teamCode)
    socket.emit('team:created', { teamCode })
  })

  socket.on('quick-match:join', (payload) => {
    const roomNumber = payload && typeof payload === 'object' ? payload.roomNumber : null
    if (!Number.isSafeInteger(roomNumber) || !roomOrder.includes(roomNumber)) {
      socket.emit('team:error', { message: 'Choose a valid game room (1–5) for Quick Match.' })
      return
    }
    removeFromQuickMatchQueue(socket.id)
    const waiting = quickMatchQueues.get(roomNumber) ?? []
    const waitingId = waiting.find((id) => id !== socket.id && io.sockets.sockets.has(id))
    if (!waitingId) {
      quickMatchQueues.set(roomNumber, [...waiting.filter((id) => id !== socket.id), socket.id])
      socket.emit('quick-match:waiting', { message: 'Searching for another agent in this room…' })
      return
    }

    const queue = waiting.filter((id) => id !== waitingId && id !== socket.id)
    if (queue.length) quickMatchQueues.set(roomNumber, queue)
    else quickMatchQueues.delete(roomNumber)
    const teamCode = createTeamCode()
    const match = io.sockets.sockets.get(waitingId)
    if (match) addSocketToTeam(match, teamCode)
    addSocketToTeam(socket, teamCode)
    match?.emit('quick-match:matched', { teamCode })
    socket.emit('quick-match:matched', { teamCode })
  })

  socket.on('quick-match:cancel', () => {
    removeFromQuickMatchQueue(socket.id)
  })

  socket.on('team:join', async (payload) => {
    const teamCode = payload && typeof payload === 'object' ? payload.teamCode : null
    const roomNumber = payload && typeof payload === 'object' ? payload.roomNumber : null
    try {
      await joinTeamRoom(socket, teamCode, roomNumber)
    } catch (error) {
      socket.emit('team:error', {
        message: error instanceof Error ? error.message : 'Could not join the team room.',
      })
    }
  })

  socket.on('game:enter', async (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') return
    const teamCode = payload && typeof payload === 'object' ? payload.teamCode : null
    const roomNumber = payload && typeof payload === 'object' ? payload.roomNumber : null
    try {
      const roomId = await joinTeamRoom(socket, teamCode, roomNumber)
      if (roomNumber === 1) startTeamRace(teamCode)
      io.to(`team-${teamCode}`).emit('navigate_room', {
        roomNumber,
        teamCode,
        username: getPlayerName(socket.data.user),
        state: getTeamSharedState(teamCode),
      })
      io.to(`team-${teamCode}`).emit('team:notice', {
        id: randomUUID(),
        message: `${getPlayerName(socket.data.user)} entered Room ${roomNumber}.`,
        created_at: new Date().toISOString(),
      })
      acknowledge({ roomId })
    } catch (error) {
      acknowledge({
        error: error instanceof Error ? error.message : 'Could not enter the selected team room.',
      })
    }
  })

  socket.on('room:state:update', (rawState) => {
    const roomId = socket.data.roomId
    const nextState = validatedSharedState(rawState)
    if (!roomId || !nextState) {
      socket.emit('team:error', { message: 'The shared game state was invalid.' })
      return
    }
    const mergedState = mergeSharedRoomState(sharedRoomStates.get(roomId), nextState)
    sharedRoomStates.set(roomId, mergedState)
    io.to(`team-${socket.data.teamCode}`).emit('room:state', mergedState)
  })

  socket.on('chat:send', async (payload) => {
    const message = payload && typeof payload === 'object' ? payload.message : null
    const roomId = socket.data.roomId
    const database = getSupabase()
    if (!roomId || !database) {
      socket.emit('chat:error', { message: 'Join an active team before sending messages.' })
      return
    }
    if (typeof message !== 'string' || !message.trim() || message.trim().length > 500) {
      socket.emit('chat:error', { message: 'Messages must contain 1–500 characters.' })
      return
    }
    const row = {
      id: randomUUID(),
      room_id: roomId,
      username: getPlayerName(socket.data.user),
      message: message.trim(),
      created_at: new Date().toISOString(),
    }
    try {
      await saveMessage(database, row)
      io.to(roomId).emit('chat:message', row)
    } catch (error) {
      console.error('Could not persist or deliver a team chat message:', error)
      socket.emit('chat:error', { message: 'Could not send your message. Please try again.' })
    }
  })

  socket.on('puzzle:solved', async (payload) => {
    const roomNumber = payload && typeof payload === 'object' ? payload.roomNumber : null
    const rawState = payload && typeof payload === 'object' ? payload.state : null
    const playerScore = payload && typeof payload === 'object' ? payload.playerScore : null
    const roomId = socket.data.roomId
    if (!roomId || roomNumber !== socket.data.roomNumber) return
    const nextState = validatedSharedState(rawState)
    if (
      !nextState ||
      !nextState.completedRooms.includes(roomNumber) ||
      !Number.isSafeInteger(playerScore) ||
      playerScore < 0 ||
      playerScore > 10_000_000
    ) {
      socket.emit('team:error', { message: 'The solved puzzle state was invalid.' })
      return
    }
    const mergedState = mergeSharedRoomState(sharedRoomStates.get(roomId), nextState)
    sharedRoomStates.set(roomId, mergedState)
    io.to(`team-${socket.data.teamCode}`).emit('room:state', mergedState)
    const { race, player } = updateTeamRace(socket.data.teamCode, socket.data.user)
    player.username = getPlayerName(socket.data.user)
    player.score = Math.max(player.score, playerScore)
    const puzzleWasAlreadySolved = player.completedRooms.includes(roomNumber)
    if (!player.completedRooms.includes(roomNumber)) {
      player.completedRooms = roomOrder.filter((room) =>
        player.completedRooms.includes(room) || room === roomNumber)
    }
    if (roomNumber === roomOrder[roomOrder.length - 1] &&
      player.completedRooms.length === roomOrder.length && !player.finishedAt) {
      player.finishedAt = Date.now()
    }
    publishTeamRoster(socket.data.teamCode)
    const standings = getTeamRaceStandings(socket.data.teamCode, true)
    const everyoneFinished = race.startedAt > 0 &&
      standings.length > 0 &&
      standings.every((standing) => standing.finished)
    if (everyoneFinished && !race.leaderboardPublished) {
      race.leaderboardPublished = true
      io.to(`team-${socket.data.teamCode}`).emit('team:leaderboard', standings)
    }
    if (!puzzleWasAlreadySolved) {
      const database = getSupabase()
      const username = getPlayerName(socket.data.user)
      const row = {
        id: randomUUID(),
        room_id: `team-${socket.data.teamCode}`,
        username: 'SYSTEM',
        message: `${username} solved Room ${roomNumber}!`,
        created_at: new Date().toISOString(),
        system: true,
      }
      try {
        if (database) await saveMessage(database, row)
        io.to(`team-${socket.data.teamCode}`).emit('chat:message', row)
      } catch (error) {
        console.error('Could not persist or deliver the puzzle notification:', error)
        io.to(`team-${socket.data.teamCode}`).emit('chat:message', row)
      }
    }
  })

  socket.on('disconnect', () => {
    removeFromQuickMatchQueue(socket.id)
    const teamCode = socket.data.teamCode
    const members = teamCode ? teamMembers.get(teamCode) : null
    const member = members?.get(socket.data.user.id)
    member?.connections.delete(socket.id)
    if (teamCode) publishTeamRoster(teamCode)
  })
})

app.get('/api/health', (_req, res) => {
  const database = getSupabase()
  res.json({
    status: 'ok',
    supabaseConfigured: Boolean(database),
    ...(database ? {} : { configurationError: supabaseConfigError }),
  })
})

app.get('/api/progress/:username', requireAuthenticatedUser, async (req, res) => {
  const username = userProgressIdentity(req, res)
  if (!username) return

  const database = requireDatabase(res)
  if (!database) return

  const { data, error } = await database
    .from('player_progress')
    .select('progress')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    console.error('Supabase progress read failed:', error.message)
    return res.status(500).json({ error: 'Could not load player progress.' })
  }

  return res.json({ progress: data?.progress ?? null })
})

app.put('/api/progress/:username', requireAuthenticatedUser, async (req, res) => {
  const username = userProgressIdentity(req, res)
  if (!username) return

  const progress = validateProgress(req.body?.progress)
  if (!progress) return res.status(400).json({ error: 'The supplied game progress is invalid.' })
  const displayName =
    typeof req.body?.displayName === 'string'
      ? req.body.displayName.trim().slice(0, 80) || username
      : username

  const database = requireDatabase(res)
  if (!database) return

  const { error } = await database.from('player_progress').upsert(
    {
      username,
      display_name: displayName,
      progress,
      score: progress.score,
      completed_rooms: progress.completedRooms,
      hints_used: progress.hintsUsed,
      current_room: progress.currentRoom,
      game_completed: progress.gameCompleted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'username' },
  )

  if (error) {
    console.error('Supabase progress save failed:', error.message)
    return res.status(500).json({ error: 'Could not save player progress.' })
  }

  return res.json({ progress })
})

app.get('/api/leaderboard', async (_req, res) => {
  const database = requireDatabase(res)
  if (!database) return

  const { data, error } = await database
    .from('player_progress')
    .select('display_name, score, updated_at')
    .eq('game_completed', true)
    .order('score', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(10)

  if (error) {
    console.error('Supabase leaderboard read failed:', error.message)
    return res.status(500).json({
      error: 'Could not load the leaderboard. Check the server logs and confirm supabase/schema.sql has been applied.',
    })
  }

  return res.json({
    entries: (data ?? []).map((entry) => ({
      name: entry.display_name,
      score: entry.score,
    })),
  })
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' })
})

app.use(express.static(clientPath))
app.use((_req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'))
})

app.use((error, _req, res, _next) => {
  const status = error.status === 400 ? 400 : 500
  if (status === 500) console.error('Unhandled server error:', error)
  res.status(status).json({
    error: status === 400 ? 'Malformed JSON request body.' : 'An unexpected server error occurred.',
  })
})

server.listen(port, () => {
  console.log(`MAZORA API listening on http://localhost:${port}`)
})
