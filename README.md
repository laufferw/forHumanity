# forHumanity

forHumanity is a community support app for submitting and tracking blanket delivery requests.

## How it works

1. **Anyone** can submit a request at `/request`: a name, phone, address or landmark, optional
   notes, and optionally their current GPS location. No account needed.
2. **Admins** see every request on `/admin`, filter by status, and assign each one to a volunteer.
   The Users tab manages roles and account status (suspending someone logs them out immediately).
3. **Volunteers** register on `/login`. New accounts are **pending** until an admin approves them
   on the Users tab; pending volunteers can track their own requests but can't be assigned
   deliveries. Approved volunteers see their deliveries on `/assignments`, with tap-to-call phone
   numbers and map links, and mark each one started and delivered.
4. Admins and volunteers can **sort requests by distance** from their current location (requests
   with GPS coordinates first). Suspending or deleting a volunteer puts their open deliveries back
   in the queue.
5. Logged-in users can track and cancel requests they submitted on `/my-requests`.

## Monorepo layout

- `backend/` — Node + Express + MongoDB API
- `frontend/` — React app (Vite)

## Quick start

Requires Node 22 and a local MongoDB (for example `docker run -d -p 27017:27017 mongo:7`).

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 2) Create an admin

```bash
cd backend
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Change-this-1!' npm run seed:admin
```

### 3) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3000`. The frontend calls the API at `REACT_APP_API_URL`.

## Scripts

### Backend

- `npm run dev` — run server with nodemon
- `npm start` — run server
- `npm test` — backend route tests
- `npm run seed:admin` — create/update an admin account
- `npm run backup:mongo` — create compressed Mongo backup
- `npm run restore:mongo -- <archive.tgz>` — restore Mongo backup

### Frontend

- `npm start` — Vite dev server on port 3000
- `npm run build` — production build into `frontend/build`
- `npm test` — unit tests (Vitest)

## Browser end-to-end tests

`e2e/` drives the real app in Chromium (Playwright): the backend against a throwaway
`forHumanity-e2e` database, and the production frontend build. CI runs it on every PR.

```bash
docker run -d -p 27017:27017 mongo:7          # if MongoDB isn't already running
(cd frontend && REACT_APP_API_URL=http://localhost:5055/api npm run build)
cd e2e
npm install
npx playwright install chromium               # first time only
npm test
```

The suite resets the `forHumanity-e2e` database and seeds its own admin before each run, and
starts the backend on port 5055 and the frontend on port 3055.

## Bootstrap an admin account

`npm run seed:admin` (from `backend/`, or inside the backend container) creates the admin, or resets
an existing account's password and promotes it. It reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
optionally `ADMIN_NAME`.

## Production hardening defaults

Backend now includes:
- `helmet` security headers
- API rate limiting (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`), plus a tighter per-IP limit on
  public request submissions (`REQUEST_RATE_LIMIT_WINDOW_MS`, `REQUEST_RATE_LIMIT_MAX`, default
  10/hour) and a honeypot field on the request form
- `TRUST_PROXY` is the number of reverse proxies in front of the backend (never "trust all"),
  so clients can't spoof their IP to dodge rate limits
- login lockout controls (`MAX_FAILED_LOGIN_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `FAILED_ATTEMPT_TTL_MINUTES`)
- configurable auth token TTL (`AUTH_TOKEN_TTL`)
- stronger password policy (upper/lower/number/special)
- stricter production startup validation for `JWT_SECRET`
- health endpoint: `GET /api/health`
- metrics endpoint: `GET /api/metrics` (requires `x-metrics-token: $METRICS_TOKEN`; disabled in production when unset)
- request and error correlation IDs (`x-request-id`, `errorId`)

## Staging deployment (Docker Compose)

1. Copy env file:

```bash
cp .env.staging.example .env.staging
```

2. Start stack:

```bash
docker compose -f docker-compose.staging.yml up -d --build
```

3. Open app: `http://localhost:8080`

4. Seed admin in running backend container:

```bash
docker compose -f docker-compose.staging.yml exec backend npm run seed:admin
```

5. Stop stack:

```bash
docker compose -f docker-compose.staging.yml down
```

## Production deployment (Docker Compose)

1. Copy env file:

```bash
cp .env.production.example .env.production
```

2. Start production stack:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

3. Seed admin user:

```bash
docker compose -f docker-compose.production.yml exec backend npm run seed:admin
```

4. Use reverse proxy sample at `deploy/nginx.reverse-proxy.example.conf`

## Ops

- Incident response guide: `ops/INCIDENT_RUNBOOK.md`
- Backup/recovery guide: `ops/BACKUP_RECOVERY.md`
- Launch checklist: `ops/LAUNCH_CHECKLIST.md`
- Smoke test script: `ops/smoke_test.sh`
- Scheduled/manual backup workflow: `.github/workflows/mongo-backup.yml`
- Scheduled uptime checks: `.github/workflows/uptime-check.yml`
- Env sanity check: `ops/check_env.sh`
- Release preflight: `ops/preflight.sh`

## Release process

1. Update `CHANGELOG.md`
2. Ensure `.env.staging` is present and valid
3. Run:

```bash
./ops/preflight.sh
```

4. If green, deploy/restart staging/prod per your runbook

## Post-launch automation

Run smoke test manually:

```bash
./ops/smoke_test.sh https://your-domain.example
```

Set repository secrets `PRODUCTION_BASE_URL` and `METRICS_TOKEN` to enable scheduled uptime checks. Export `METRICS_TOKEN` before running the smoke test.

## Routes

- `/` — home
- `/request` — request form (public)
- `/login` — log in or register as a volunteer
- `/my-requests` — requests you submitted while logged in
- `/assignments` — deliveries assigned to you
- `/admin` — admin only: stats, request triage and assignment, user management
