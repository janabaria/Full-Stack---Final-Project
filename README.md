# Escape Room Online

A cinematic, four-room React escape-room game. Players sign in to a local session, solve each room in sequence, and keep campaign progress between visits.

## Run locally

```sh
npm ci
npm run dev
```

Useful checks:

```sh
npm run build
npm run lint
```

## Game flow

- `/login` appears before Home when there is no local player session.
- Home shows the four-room progression and keeps each room unavailable until the previous room is completed.
- Rooms are available at `/rooms/1` through `/rooms/4`; attempts to open a locked room URL return to Home.
- Completing Room 04 opens the final escape screen at `/game-complete`.
- Player session and progress are stored separately per username in browser `localStorage`.

## Authentication and persistence

There is no backend or database in this project. Sign-in is a **local demo session**: any non-empty username/email and password creates a session, and the password is not stored. The route guard prevents casual navigation to Home or locked rooms, but browser storage is controlled by the player and is not a security boundary. A production online game should use server-verified sessions and enforce room unlocks and progress on the backend.

The room-completion callbacks in `src/App.tsx` are the integration points for replacing local progress storage with API/database calls.
