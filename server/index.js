import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const app = express()
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

app.get('/api/health', (_req, res) => {
  const database = getSupabase()
  res.json({
    status: 'ok',
    supabaseConfigured: Boolean(database),
    ...(database ? {} : { configurationError: supabaseConfigError }),
  })
})

app.get('/api/progress/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username)
  if (!username) return res.status(400).json({ error: 'A valid username is required.' })

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

app.put('/api/progress/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username)
  if (!username) return res.status(400).json({ error: 'A valid username is required.' })

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

app.listen(port, () => {
  console.log(`Escape Room API listening on http://localhost:${port}`)
})
