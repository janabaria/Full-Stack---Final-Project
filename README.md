# MAZORA

A cinematic, five-room React escape-room game. Players sign in with Supabase Auth, solve each room in sequence, and can collaborate through team chat and shared progress over Socket.IO.

The original MAZORA logo is stored at [`public/images/mazora-logo.png`](./public/images/mazora-logo.png). The app uses [`public/images/mazora-logo-transparent.png`](./public/images/mazora-logo-transparent.png), with its dark outer background removed, on the login page, home page, navigation headers, and browser icon.

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

- `/login` appears before Home when there is no active Supabase Auth session.
- Home shows the five-room progression in order: Rooms 1–3, the Mysterious Study as Room 4 (`/rooms/4`), then the Last Lock as Room 5 (`/rooms/5`).
- Each room remains unavailable until the previous room in the campaign is completed; attempts to open a locked room URL return to Home.
- Completing the Last Lock opens the final escape screen at `/game-complete`.
- Supabase persists player sessions; a browser-local progress copy is retained as an offline fallback, keyed by account email.

## Supabase backend setup

1. Create a Supabase project and enable email/password authentication in the Supabase dashboard.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy `.env.example` to `.env`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_SUPABASE_ANON_KEY` from the project settings. `VITE_SUPABASE_URL` can be set explicitly for the frontend; when omitted, Vite uses `SUPABASE_URL`. The Supabase anon/publishable key is intended for browser use; keep the service-role key server-only.
4. Run `npm run dev:server` and `npm run dev` in separate terminals. Vite proxies `/api` and Socket.IO traffic to Express.

The Express + Socket.IO backend provides:

- `GET /api/health` — backend health check.
- `GET /api/progress/:email` and `PUT /api/progress/:email` — load and save the signed-in player's campaign progress and score. Both endpoints require a valid Supabase access token and only accept the authenticated account's email.
- `GET /api/leaderboard` — list the top 10 completed runs.
- Socket.IO events `team:create`, `team:join`, `quick-match:join`, `quick-match:cancel`, `room:state:update`, `chat:send`, and `puzzle:solved` — create/join a six-character co-op team, find a Quick Match partner, synchronize room progress/inventory/score, and exchange chat/system messages. Socket handshakes are verified against Supabase Auth.

Choose Solo or Team Multiplayer from Home before entering a room. Team mode lets you create a room and share its six-character code, join a code, or find a Quick Match partner. The selected mode/team code is retained in browser storage and team players share progress and chat within the current game room. Chat history is stored in `public.messages`; live co-op state is held in the Socket.IO server process, while each player's campaign progress is reloaded from their saved progress after reconnecting. In-memory shared inventory and Quick Match queues are cleared if the server restarts.

## Game audio

The audio layer is in `src/audio/`. It synthesizes original room-specific ambient music and UI/success/failure/victory effects with the Web Audio API, so no external audio files or third-party music licenses are required. Room moods and note patterns can be adjusted in `audioEngine.ts`; replace the generated voices there when licensed audio assets are ready. Audio begins after the player's first click/key interaction to comply with browser autoplay rules. Music, effects, and master volume settings are stored on the device.

## Authentication and security

Supabase Auth handles account creation and sign-in. The browser uses only the project's public anon/publishable key; Express verifies access tokens before progress reads/writes and Socket.IO connections. `player_progress` and `messages` have row-level security enabled. Express uses the service-role key only on the server to access these tables; never expose that key to browser code.

The room puzzle logic still runs in the browser, so multiplayer state synchronization is for co-op UX rather than authoritative anti-cheat validation. For competitive/public leaderboard deployments, move puzzle validation and score calculation to trusted server-side logic and key progress rows directly to the verified Supabase user ID.
