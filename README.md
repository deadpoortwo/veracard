# VeraCard

Full-stack VeraCard application built on the UniCard React 19 + Vite 6 + Node/SQLite + Dynamic SDK architecture, styled with the VeraCard champagne-gold obsidian glassmorphism UI and motion suite.

## Quick Start

```bash
npm install
npm run dev
```

- Frontend: `http://127.0.0.1:4173`
- API Server: `http://127.0.0.1:4174` (proxied at `/api`)
- Default language: **EN** (one-click switch to **中文** in the top-right auth bar or sidebar)

## Scripts

- `npm run dev` — Starts both the Node/SQLite API (`server/index.mjs`) and Vite dev server.
- `npm run api` — Starts only the API server.
- `npm run build` — Builds the client bundle (`dist/client`) and prepares Sites worker packaging (`dist/server/index.js`).
- `npm test` — Runs all API, auth, wallet encryption, Dynamic JWT, balance, and worker tests.

## Architecture Highlights

- **Auth & Wallet**: Supports Dynamic Embedded Wallets (`VITE_DYNAMIC_ENVIRONMENT_ID` in `.env.local`) with automatic fallback to client-encrypted `ethers` keystores stored in SQLite (`server/data/veracard.sqlite`) and HttpOnly `veracard_session` cookies.
- **Live Balances**: Queries Dynamic balances or public/custom EVM RPCs (`BSC_RPC_URL` / `ETH_RPC_URL`). Missing or unqueried balances stay `—` (never fabricated).
- **UI & Motion**: Champagne-gold frosted glass surfaces, 3D floating Universal card, collapsible VisionOS pill sidebar, 0/1 digital rain + drifting coin ambient stage (automatically disabled under `prefers-reduced-motion`).
