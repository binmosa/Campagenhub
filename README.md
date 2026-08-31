# CampaignHub

A web platform for managing campaign collaboration between brands and creators, with AI-assisted matching, ranking, and content generation powered by OpenRouter.

## Architecture — 2 deployable units

| Unit | Stack | Deploys to |
|---|---|---|
| `backend/` | NestJS + TypeORM + PostgreSQL | VPS via `docker compose` (with Caddy TLS proxy) |
| `frontend/` | React + Vite + HeroUI | Vercel |

AI features (smart match, applicant ranking, captions, pitches, contracts, predictions) call **OpenRouter** (`deepseek/deepseek-chat` by default — any OpenRouter model slug works via `LLM_MODEL`). There is **no local model inference**. When `OPENROUTER_API_KEY` is unset, every AI endpoint degrades gracefully to template fallbacks.

> Automatic social-post scraping (`/analyze-url`) is currently disabled; submissions fall back to manual verification.

---

## Local development

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL running locally

### 1. Configure
```bash
cp backend/.env.example backend/.env
# Fill in at least: DB_*, JWT_SECRET (openssl rand -base64 48),
# ENABLE_SEED=true + SEED_PASSWORD for test accounts,
# OPENROUTER_API_KEY to enable AI features.
```
The frontend needs no `.env` for local dev (it defaults to `http://<host>:3001/api`); `frontend/.env.example` documents `VITE_API_BASE_URL` for other setups.

### 2. Install & run
```bash
npm run install:all   # installs root, backend, frontend deps
npm start             # backend :3001 + frontend :5173 concurrently
```

Seeded test accounts (when `ENABLE_SEED=true`): `creator@test.com`, `brand@test.com`, `manager@test.com`, `superadmin@test.com` — password = `SEED_PASSWORD`.

---

## Deployment

### Backend → VPS (Docker)
```bash
# On the VPS, in the repo root:
cp backend/.env.example backend/.env   # fill production values:
#   JWT_SECRET, DB_PASSWORD, OPENROUTER_API_KEY,
#   CORS_ORIGINS=https://<your-vercel-domain>,
#   FRONTEND_URL=https://<your-vercel-domain>,
#   PUBLIC_URL=https://api.<your-domain>
ln -sf backend/.env .env               # lets docker-compose read DB_* and API_DOMAIN
echo 'API_DOMAIN=api.<your-domain>' >> backend/.env
docker compose up -d --build
```
- Point a DNS **A record** for `api.<your-domain>` at the VPS — Caddy provisions HTTPS automatically.
- Uploads persist in the `uploads` volume; Postgres data in `pgdata`.

### Frontend → Vercel
- Import the repo, set **Root Directory** to `frontend` (framework: Vite).
- Environment variables:
  - `VITE_API_BASE_URL=https://api.<your-domain>/api` (build-time)
- `frontend/vercel.json` already handles the SPA rewrite for client-side routing.

### AI → OpenRouter
- Create a key at [openrouter.ai](https://openrouter.ai), set `OPENROUTER_API_KEY` in `backend/.env`.
- Switch models any time via `LLM_MODEL` (e.g. `qwen/qwen-2.5-72b-instruct`) — no code change.

---

## Repository layout
- `backend/src/` — modular NestJS: auth, campaigns, applications, payments (Flutterwave/PayPal/Telebirr), payouts, messaging, telegram, tracking, uploads, and `ai/` (OpenRouter client + AI endpoints).
- `frontend/src/` — React app for Brand, Creator, Manager, and Admin roles.
- `docker-compose.yml` + `Caddyfile` + `backend/Dockerfile` — the VPS stack.

## Security notes
- All secrets live in gitignored `.env` files — `*.env.example` documents every variable.
- The server refuses to start without `JWT_SECRET`; seed accounts only exist when `ENABLE_SEED=true`.
