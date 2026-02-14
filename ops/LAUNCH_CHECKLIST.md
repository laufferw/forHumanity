# v1 Launch Checklist

## Pre-launch

- [ ] Domain is configured and DNS resolves to target host
- [ ] TLS certificate is provisioned
- [ ] `.env.production` created from `.env.production.example`
- [ ] `JWT_SECRET` is strong and not default
- [ ] `CLIENT_ORIGIN` matches production URL
- [ ] Backups tested (see `ops/BACKUP_RECOVERY.md`)
- [ ] `./ops/preflight.sh` passes

## Launch

- [ ] Start stack:
  - `docker compose -f docker-compose.production.yml up -d --build`
- [ ] Seed admin user:
  - `docker compose -f docker-compose.production.yml exec backend npm run seed:admin`
- [ ] Verify endpoints:
  - `/api/health`
  - `/api/metrics`
- [ ] Verify critical user flows:
  - register/login
  - submit request
  - admin status update + assignment

## Post-launch (first 24h)

- [ ] Watch logs for repeated 5xx errors
- [ ] Check metrics request/error counters
- [ ] Validate backup workflow generated artifact
- [ ] Record any incidents and improvements in ops notes
