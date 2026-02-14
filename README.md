# forHumanity

forHumanity is a community support app for submitting and tracking blanket delivery requests.

## Monorepo layout

- `backend/` — Node + Express + MongoDB API
- `frontend/` — React app

## Quick start

### 1) Backend

```bash
cd backend
cp .env.example .env 2>/dev/null || true
npm install
npm run dev
```

If `.env.example` does not exist inside backend, use the root `.env.example` values and create `backend/.env` manually:

```env
MONGODB_URI=mongodb://localhost:27017/forHumanity
JWT_SECRET=change-me
PORT=5000
CLIENT_ORIGIN=http://localhost:3000
```

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

Frontend defaults to `http://localhost:3000` and calls API at `REACT_APP_API_URL`.

## Scripts

### Backend

- `npm run dev` — run server with nodemon
- `npm start` — run server
- `npm test` — backend route tests
- `npm run seed:admin` — create/update an admin account
- `npm run backup:mongo` — create compressed Mongo backup
- `npm run restore:mongo -- <archive.tgz>` — restore Mongo backup

### Frontend

- `npm start` — start dev app
- `npm run build` — production build
- `npm test` — tests

## Bootstrap an admin account

From `backend/`:

```bash
export ADMIN_EMAIL=you@example.com
export ADMIN_PASSWORD='change-this-password'
export ADMIN_NAME='Ops Admin'
npm run seed:admin
```

Then log in with that account and open `/admin`.

## Production hardening defaults

Backend now includes:
- `helmet` security headers
- API rate limiting (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`)
- login lockout controls (`MAX_FAILED_LOGIN_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `FAILED_ATTEMPT_TTL_MINUTES`)
- configurable auth token TTL (`AUTH_TOKEN_TTL`)
- stronger password policy (upper/lower/number/special)
- stricter production startup validation for `JWT_SECRET`
- health endpoint: `GET /api/health`
- metrics endpoint: `GET /api/metrics`
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

Set repository secret `PRODUCTION_BASE_URL` to enable scheduled uptime checks.

## Current app shell

- Home page (`/`)
- Request form (`/request`)
- Login/register page (`/login`)
- My requests (`/my-requests`, requires login)
- Admin dashboard (`/admin`, admin role only)
  - live counts (users, total/pending/completed requests)
  - request status updates
  - request assignment to volunteers/admins
