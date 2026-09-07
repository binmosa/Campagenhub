# CampaignHub

A web platform for managing campaign collaboration between brands and creators, with AI-assisted matching, ranking, and content generation powered by OpenRouter.

## Architecture

| Unit | Stack |
|---|---|
| `backend/` | NestJS + TypeORM + PostgreSQL |
| `frontend/` | React + Vite + HeroUI |

Two supported deployments, both driven by the same `docker-compose.yml`:

| | Where it runs | API address |
|---|---|---|
| **One VPS (default)** | Postgres, API, built frontend and a Caddy edge, all on one machine and one domain | `/api` — same origin, so there is no CORS to configure |
| **Split** | API on the VPS, frontend on Vercel | `https://api.<domain>/api` |

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

### Everything on one VPS (default)

```bash
# On the VPS, in the repo root:
cp backend/.env.example backend/.env   # JWT_SECRET, FLW_SECRET_HASH, OPENROUTER_API_KEY, …
cp .env.example .env                   # APP_DOMAIN, DB_PASSWORD

docker compose up -d --build
```

- Point a DNS **A record** for `APP_DOMAIN` at the VPS *before* the first run — Caddy provisions HTTPS on the spot.
- Caddy serves the app on the apex and proxies `/api` and `/uploads` to the API. `CORS_ORIGINS`, `FRONTEND_URL` and `PUBLIC_URL` are derived from `APP_DOMAIN` by compose, so there is nothing to keep in sync.
- Uploads persist in the `uploads` volume; Postgres in `pgdata`.

**First boot only** — the schema does not exist yet, and auto-sync is off in production by design:

```bash
DB_SYNCHRONIZE=true docker compose run --rm backend node dist/main   # Ctrl-C once it says "successfully started"
docker compose up -d                                                 # then run normally
```

#### Building the frontend image

`@heroui-pro/react` installs from npm as a stub whose postinstall downloads the real bundle, and that download needs a **CI/CD licence key** (the token from `npx heroui-pro login` on a workstation is a different credential and is rejected). Two options:

```bash
# A — you have a CI/CD key: put it in ./heroui-ci-token.txt, then
docker compose up -d --build

# B — you don't: build the bundle where the licence already works (your machine)
cd frontend && VITE_API_BASE_URL=/api npm run build && cd ..
FRONTEND_DOCKERFILE=Dockerfile.prebuilt docker compose up -d --build
```

Option B ships `frontend/dist` as-is, so rebuild it whenever the frontend changes.

To try the stack on a laptop where ports 80/443 are taken:

```bash
docker compose -f docker-compose.yml -f docker-compose.smoketest.yml up -d   # → https://localhost:8443
```

### Split: API on the VPS, frontend on Vercel

- In `Caddyfile`, comment out the `{$APP_DOMAIN}` block and uncomment the `{$API_DOMAIN}` one; set `API_DOMAIN` in `.env` and drop the `frontend` service from the compose run (`docker compose up -d db backend caddy`).
- On Vercel: import the repo, **Root Directory** `frontend` (framework Vite), and set `VITE_API_BASE_URL=https://api.<your-domain>/api`. The production build fails without it rather than silently falling back to localhost.
- Set `CORS_ORIGINS=https://<your-vercel-domain>` in `backend/.env` — the same-origin shortcut does not apply here.
- `frontend/vercel.json` handles the SPA rewrite; `frontend/middleware.ts` does country routing at the edge. On the single-VPS stack that middleware does not run, and `GeoGate` applies the same rules client-side instead.

### AI → OpenRouter
- Create a key at [openrouter.ai](https://openrouter.ai), set `OPENROUTER_API_KEY` in `backend/.env`.
- Switch models any time via `LLM_MODEL` (e.g. `qwen/qwen-2.5-72b-instruct`) — no code change.

---

## Repository layout
- `backend/src/` — modular NestJS: auth, campaigns, applications, payments (Flutterwave/PayPal/Telebirr), payouts, messaging, telegram, tracking, uploads, and `ai/` (OpenRouter client + AI endpoints).
- `frontend/src/` — React app for Brand, Creator, Manager, and Admin roles.
- `docker-compose.yml` + `Caddyfile` + `backend/Dockerfile` + `frontend/Dockerfile` — the VPS stack.

## Security notes
- All secrets live in gitignored `.env` files — `*.env.example` documents every variable.
- The server refuses to start without `JWT_SECRET`; seed accounts only exist when `ENABLE_SEED=true`.
