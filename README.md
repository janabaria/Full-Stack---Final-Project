# Escape Room Online

A cinematic, four-room React escape-room game. Players sign in to a local session, solve each room in sequence, and keep campaign progress between visits.

## Run locally

```sh
npm ci
copy .env.example .env
npm run dev:server
```

In a second terminal, start the Vite frontend:

```sh
npm run dev
```

Useful checks:

```sh
npm run build
npm run lint
```

## Game flow

- `/login` appears before Home when there is no local player session.
- Home shows the five-room progression in order: Rooms 1–3, the Mysterious Study as Room 4 (`/rooms/4`), then the Last Lock as Room 5 (`/rooms/5`).
- Each room remains unavailable until the previous room in the campaign is completed; attempts to open a locked room URL return to Home.
- Completing the Last Lock opens the final escape screen at `/game-complete`.
- Player session and progress are stored separately per username in browser `localStorage`.

## Supabase backend setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase project settings.
4. Keep the service-role key in `.env` on the server only. Never add it to a `VITE_*` variable or browser code.
5. Run `npm run dev:server` and `npm run dev` in separate terminals. The Vite development server proxies `/api` requests to Express.

The Express API provides:

- `GET /api/health` — backend health check.
- `GET /api/progress/:username` and `PUT /api/progress/:username` — load and save campaign progress and score.
- `GET /api/leaderboard` — list the top 10 completed runs.

Progress is still written to browser storage as a fallback. When the backend is available, it loads the server copy on sign-in and synchronizes changes after a brief delay. The leaderboard reads completed runs from Supabase.

## Game audio

The audio layer is in `src/audio/`. It synthesizes original room-specific ambient music and UI/success/failure/victory effects with the Web Audio API, so no external audio files or third-party music licenses are required. Room moods and note patterns can be adjusted in `audioEngine.ts`; replace the generated voices there when licensed audio assets are ready. Audio begins after the player's first click/key interaction to comply with browser autoplay rules. Music, effects, and master volume settings are stored on the device.

## Authentication and security

Sign-in remains a **local demo session**. The first sign-in for a username/email creates a device-local credential; subsequent sign-ins must match its password. Only a random salt and PBKDF2-SHA-256 password hash are stored in this browser, not the password itself. These local credentials do not sync across devices and are not a substitute for server authentication. The backend identifies saved data by normalized username, so users can still impersonate another username and alter scores in this demo setup. Server-side validation protects the database shape, but it does not prove who owns a score.

Before exposing this game publicly or treating the leaderboard as trusted, add real authentication (for example Supabase Auth), verify the user's access token in Express, key progress by the verified auth user ID, and enforce score/progression rules server-side. Row-level security is enabled on the table; the Express service-role key bypasses it and must remain private.
