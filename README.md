# BOUNDARYBID — Cricket Auction & Tournament Platform

A full-stack starter application for private/public cricket auctions, team purse management, live bidding, squad views, round-robin fixture generation and two scoring modes.

## Stack
- React + Vite frontend
- Express API + Socket.IO real-time events
- SQLite database (`better-sqlite3`)
- JWT authentication and bcrypt password hashing

## Requirements
- Node.js 20 or newer
- npm

## Run on Windows
Open **two terminals** in the `boundarybid` folder.

### Terminal 1 — backend
```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```
The API runs at `http://localhost:4000`.

### Terminal 2 — frontend
```powershell
cd client
npm install
npm run dev
```
Open `http://localhost:5173`.

If PowerShell does not recognize `Copy-Item`, create a copy of `.env.example` and rename it `.env` using File Explorer.

## First run walkthrough
1. Register an account.
2. Create a public or private auction room.
3. Register a second account in another browser/incognito window and join with the room code. Each account can own one team per room.
4. Add players. The dashboard has **Load sample players** for a quick test. For your real player pool, use the API endpoint described below or add a CSV importer in a future iteration.
5. Start the auction. Teams place bids from their own account. The backend checks the current bid and available purse.
6. The room host closes a lot to mark the highest bid sold and advances the queue. The host can end the auction and lock squads.
7. Generate a round-robin tournament and choose custom overs (1–50).
8. Open a fixture in Match Centre and select Simple scoring or Ball-by-ball scoring.

## Important API routes
All routes except `/api/health`, `/api/auth/register`, and `/api/auth/login` require `Authorization: Bearer <token>`.

- `POST /api/auth/register`, `POST /api/auth/login`
- `POST /api/rooms` — create a room
- `GET /api/rooms` — discover public rooms and your rooms
- `GET /api/rooms/:id` — room, teams, player pool, active lot and highest bid
- `POST /api/rooms/:id/join` — create your franchise
- `POST /api/rooms/:id/players` — host adds player records (`{ "players": [{ "name": "Player", "role": "Batter", "basePrice": 100 }] }`)
- `POST /api/rooms/:id/start` — host starts the auction
- `POST /api/rooms/:id/bid` — team places the next valid bid
- `POST /api/rooms/:id/close-player` — host closes current lot and advances
- `POST /api/rooms/:id/finish` — host ends auction
- `POST /api/rooms/:id/tournament` — host generates fixtures (`{ "overs": 16 }`)
- `GET /api/rooms/:id/matches`, `GET /api/rooms/:id/standings`
- `POST /api/matches/:id/score` — update score (simple or ball mode)

## Deployment notes
For a public deployment, host the client and API on services that support Node.js, set `VITE_API_URL` to the public API URL before building the client, and set `CLIENT_ORIGIN` to the deployed client URL on the server. Set a strong unique `JWT_SECRET`. Use persistent storage for the SQLite file. For multiple server instances, replace SQLite with PostgreSQL and use a Socket.IO adapter such as Redis.

## Current MVP boundaries
This is a working foundation, not a production-certified sports platform. The auction lot is closed by the room host; bid placement is independently performed by team accounts and validated on the server. The current tournament generator creates a single round-robin schedule. The standings update completed matches, but match completion/result entry, NRR, overs/roster constraints, auction timers/auto-close, player CSV import, password reset, email verification, rate limiting, admin moderation, and production-grade audit/recovery should be added before a large public launch. Ball-by-ball scoring records deliveries and updates innings totals; the scorer should be tested against your competition's detailed cricket rules before official use.
- `POST /api/matches/:id/complete` — host records the winning team and updates the league standings.
