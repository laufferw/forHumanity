# v1 Launch Checklist

Step-by-step instructions: [docs/DEPLOY.md](../docs/DEPLOY.md).

## Pre-launch

- [ ] Domain is configured and DNS resolves to target host
- [ ] TLS certificate is provisioned
- [ ] `.env.production` created from `.env.production.example`
- [ ] `JWT_SECRET` and `METRICS_TOKEN` are strong, random values
- [ ] `TRUST_PROXY=2`, `CLIENT_ORIGIN` and `APP_URL` set to the production URL
- [ ] SMTP configured (or deliberately left off)
- [ ] `CLIENT_ORIGIN` matches production URL
- [ ] Backups tested (see `ops/BACKUP_RECOVERY.md`)
- [ ] `./ops/preflight.sh` passes

## Launch

- [ ] Start stack:
  - `docker compose -f docker-compose.production.yml pull && docker compose -f docker-compose.production.yml up -d`
- [ ] Seed admin user:
  - `docker compose -f docker-compose.production.yml exec backend npm run seed:admin`
- [ ] Verify endpoints:
  - `/api/health`
  - `/api/metrics`
- [ ] Verify critical user flows:
  - submit request
  - register volunteer, approve as admin
  - assign, start, and deliver
  - notification emails arrive (if SMTP configured)

## Post-launch (first 24h)

- [ ] Watch logs for repeated 5xx errors
- [ ] Check metrics request/error counters
- [ ] Validate backup workflow generated artifact
- [ ] Record any incidents and improvements in ops notes
