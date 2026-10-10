import { getSupabaseClient } from './supabaseClient'

export type GameProgress = {
  currentRoom: number
  completedRooms: number[]
  unlockedRooms: number[]
  score: number
  hintsUsed: number
  gameStarted: boolean
  gameCompleted: boolean
}

export type LeaderboardEntry = {
  name: string
  score: number
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')

  if (path.startsWith('/api/progress/')) {
    const { data, error } = await getSupabaseClient().auth.getSession()
    if (error) {
      throw new Error(`Could not get your Supabase session: ${error.message}`)
    }
    if (!data.session?.access_token) {
      throw new Error('Sign in with Supabase before accessing player progress.')
    }
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(result?.error ?? `API request failed (${response.status}).`)
  }

  return response.json() as Promise<T>
}

export async function getPlayerProgress(username: string): Promise<GameProgress | null> {
  const result = await request<{ progress: GameProgress | null }>(
    `/api/progress/${encodeURIComponent(username)}`,
  )
  return result.progress
}

export async function savePlayerProgress(
  username: string,
  displayName: string,
  progress: GameProgress,
): Promise<void> {
  await request<{ progress: GameProgress }>(
    `/api/progress/${encodeURIComponent(username)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ displayName, progress }),
    },
  )
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const result = await request<{ entries: LeaderboardEntry[] }>('/api/leaderboard')
  return result.entries
}
