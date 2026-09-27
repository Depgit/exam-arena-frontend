# Exam Arena — Frontend

React + Vite frontend for the Exam Arena backend, built from the API docs and LLD you provided.

## What's included

- **Auth**: register/login, JWT stored in `localStorage`, auto-attached to every request.
- **Role-based routing**: after login, `user` accounts land on `/app/*`, `admin` accounts land on `/admin/*`. Each area is route-guarded — a `user` can't reach `/admin/*` and vice versa.
- **User side** (`/app/*`):
  - Dashboard — subjects + your career stats
  - Ranked matchmaking — join/leave queue, live queue depth, auto-redirect into the match on `match_start`
  - Friend match — create a room (get a code) or join one by code
  - Live match — WebSocket-driven gameplay: questions, answer submission, live scoreboard, countdown timer, results screen
  - Practice mode — solo questions with instant right/wrong feedback and explanations
  - Leaderboard — by exam category
  - Profile — ratings + full statistics
- **Admin side** (`/admin/*`):
  - Overview
  - Create question (options editor, single/multi/integer types) → create as draft → publish
  - System stats

## One WebSocket connection

The backend enforces a single WS session per user. `WebSocketProvider` (`src/context/WebSocketContext.jsx`) opens exactly one socket app-wide once you're logged in, auto-reconnects on drop, and exposes a `subscribe(type, callback)` pub/sub so any page can listen for `match_start`, `score_update`, `time_update`, `match_end`, `match_failed`, `error` without opening a second connection.

## Setup

```bash
npm install
cp .env.example .env   # point at your backend if it's not on localhost:8080
npm run dev
```

Edit `.env`:
```
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

## Docker

From the repository root, `make docker-up` builds and starts Postgres, the Go API on `http://localhost:8080` and this UI on `http://localhost:3000` (`docker/Dockerfile.frontend`: Vite build → nginx with SPA fallback).

Vite bakes `VITE_*` values into the bundle at build time, so they are compose build args rather than runtime env. They default to `localhost:8080`; override them when the browser reaches the API somewhere else:

```bash
VITE_API_BASE_URL=http://192.168.1.10:8080 VITE_WS_BASE_URL=ws://192.168.1.10:8080 make docker-up
```

## Notes / things to wire up as your backend evolves

- **Topics**: the Create Question form loads the selected category's topics from `GET /api/v1/topics?exam_category_id=…` into a dropdown, and admins can add a missing topic inline (`POST /api/v1/admin/topics`) without leaving the form.
- `GET /api/v1/users/{id}/matches` is documented as a stub, so match history isn't wired into the Profile page yet.
- Admin accounts aren't created via the register form (the API doesn't expose a role field there) — seed/promote admin users on the backend, then just log in with those credentials here.
