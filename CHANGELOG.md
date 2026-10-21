# Changelog

All notable changes to forHumanity will be documented in this file.

## [Unreleased]

### Security
- `GET /api/requests/:id` is limited to admins, the requester, and the assigned volunteer
- `PUT /api/requests/:id/status` is limited to admins and the assigned volunteer; requesters may only cancel
- `POST /api/requests` takes `userId` from the auth token instead of the request body
- Auth middleware loads role and status from the database, so demoted or suspended users lose access immediately
- Login no longer reveals account status before the password is verified
- `/api/metrics` requires `METRICS_TOKEN` (disabled in production when unset); route metrics use route patterns
- Upgrade bcrypt to v6 and override qs to clear production `npm audit` findings

### Added
- Volunteer Assignments page: start and complete deliveries, tap-to-call, map links
- Admin dashboard: status filter, full request list with assign/status/delete, and a Users tab
  for roles, account status, and removal
- Request form: optional current-location capture, prefill for logged-in users, and a required
  data-sharing notice
- My requests: status, dates, and cancelling open requests
- `GET /api/requests/assigned` and `?status=` filtering on `GET /api/requests`
- Volunteer approval: new registrations are `pending` until an admin approves them (Approve
  button and "Awaiting approval" count on the admin dashboard). Pending users can sign in and
  track their own requests but can't be assigned deliveries
- "Sort by distance from me" on the admin request list and volunteer assignments
- Per-IP limit on public request submissions (default 10/hour) and a honeypot field

### Changed
- Frontend builds with Vite and tests with Vitest instead of Create React App (deprecated);
  `REACT_APP_API_URL` still works
- Frontend validates the stored session on load and logs out when the token is rejected
- `/api/health` returns 503 when the database is down; production exits if MongoDB is unreachable
  at startup
- `TRUST_PROXY` is a hop count; `true` is treated as one hop instead of trusting every proxy
- Admin access requires an active account, not just the admin role
- Suspending, deactivating, or deleting a volunteer returns their open assignments to the
  unassigned pending queue; delivered and cancelled requests keep their history

### Fixed
- Submitting a request without coordinates failed with a geo-index error
- Validation errors returned 500 instead of 400 with the reason
- Emails with TLDs longer than three letters (e.g. `.info`) were rejected
- Production compose: add the Mongo healthcheck the backend depends on

## [0.17.0] - 2026-02-14

### Added
- Post-launch automation package:
  - smoke test script (`ops/smoke_test.sh`)
  - scheduled uptime workflow (`.github/workflows/uptime-check.yml`)
  - incident issue template (`.github/ISSUE_TEMPLATE/incident_report.yml`)

## [0.16.0] - 2026-02-14

### Added
- v1 launch package:
  - production compose stack (`docker-compose.production.yml`)
  - production env template (`.env.production.example`)
  - reverse-proxy sample config (`deploy/nginx.reverse-proxy.example.conf`)
  - launch-day checklist (`ops/LAUNCH_CHECKLIST.md`)

## [0.15.0] - 2026-02-14

### Added
- Release readiness tooling:
  - env sanity checker (`ops/check_env.sh`)
  - one-command preflight (`ops/preflight.sh`)
- Initial changelog tracking

## [0.14.0] - 2026-02-14

### Fixed
- Lockout map TTL cleanup to prevent unbounded memory growth
- Safer numeric env parsing for lockout controls

## [0.13.0] - 2026-02-14

### Added
- Auth/session hardening:
  - stronger password policy
  - login lockout controls
  - session refresh endpoint

## [0.12.0] - 2026-02-14

### Added
- Backup and recovery readiness:
  - Mongo backup/restore scripts
  - scheduled backup workflow
  - backup runbook

## [0.11.0] - 2026-02-14

### Added
- Observability primitives:
  - request IDs and error IDs
  - metrics endpoint
  - incident runbook
