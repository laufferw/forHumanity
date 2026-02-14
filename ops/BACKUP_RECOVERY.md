# Backup & Recovery

## Prerequisites

- MongoDB Database Tools installed (`mongodump`, `mongorestore`)
- `MONGODB_URI` set for target environment

## Create backup

```bash
cd backend
MONGODB_URI='mongodb://localhost:27017/forHumanity' ./scripts/backupMongo.sh
```

Backups are written to `backups/forHumanity-<timestamp>.tgz`.

## Restore backup

```bash
cd backend
MONGODB_URI='mongodb://localhost:27017/forHumanity' ./scripts/restoreMongo.sh ../backups/forHumanity-<timestamp>.tgz
```

> Restore uses `--drop` and will replace existing collections.

## Recommended cadence

- Daily backup retained 7 days
- Weekly backup retained 8 weeks
- Monthly backup retained 12 months

## Verification checklist

1. Ensure backup file exists and non-zero size
2. Run restore into non-production DB for verification
3. Validate key flows (`/api/health`, login, request submission)
4. Record backup test date in ops notes
