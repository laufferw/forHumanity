# forHumanity Incident Runbook

## 1) Triage (first 5 minutes)

1. Check CI and recent deploy status.
2. Check backend health endpoint:
   - `GET /api/health`
3. Check metrics endpoint for request/error spikes:
   - `GET /api/metrics`
4. Capture failing `x-request-id` from client or API response headers.

## 2) Containment

- If outage is deployment-related, roll back to last known good release.
- If load spike is causing instability, reduce traffic (temporary rate limits, maintenance mode at proxy).
- If database is degraded, verify Mongo service health and resource usage first.

## 3) Diagnosis

- Search logs for `requestId` and/or `errorId`.
- Confirm whether failures are isolated to route/method or system-wide.
- Validate env config (JWT secret, DB URI, client origin, proxy trust).

## 4) Recovery

- Deploy fix or rollback.
- Re-check:
  - `/api/health` returns `status: ok`
  - `/api/metrics` error growth stabilizes
  - key user flows (login, request submit, admin updates)

## 5) Post-incident

- Write brief timeline + root cause + fix.
- Add a regression test if code-related.
- Update this runbook if response steps were missing.
