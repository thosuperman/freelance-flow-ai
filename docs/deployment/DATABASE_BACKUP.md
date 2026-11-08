# Database, migrations and backups

PostgreSQL 16 runs in the `db` container with its data in the `freelanceflow_pgdata` Docker volume. It is on an internal-only Docker network: no host port and no internet access. Memory settings are tuned for 2 GB (`shared_buffers=128MB`, `max_connections=40`, container limit 512 MB). The app connects with `connection_limit=5`.

## Migrations

Every release runs `prisma migrate deploy` as a one-off `migrate` container ([deploy/release.sh](../../deploy/release.sh)) after taking a backup. `migrate deploy` only applies committed migration files. It never resets data, and `prisma migrate reset` / `db push` are never used in production.

To migrate by hand:

```bash
cd /opt/freelanceflow
docker compose -f compose.prod.yml --env-file .env.production run --rm migrate
```

**Rollback guidance:** migrations are forward-only. To undo a schema change, write a new migration that reverses it. Keep migrations backward compatible (add, don't drop or rename in the same release) so [rollback.sh](../../deploy/rollback.sh) can run the previous image against the new schema. If a migration damaged data, restore the backup that `release.sh` took right before it.

## Backups

[deploy/backup.sh](../../deploy/backup.sh) writes `pg_dump --format=custom` files to `/opt/freelanceflow/backups`:

- Daily at 03:15 UTC (cron), and before every release.
- Files are mode `600` in a `700` directory owned by `ubuntu`.
- Kept for 7 days (`RETENTION_DAYS`).
- They stay on the instance disk. No paid snapshots or S3 are used.

Backups contain everything in the database, including client names, emails and conversations pasted into projects. Don't copy them anywhere public. To take one off the server:

```bash
scp -i ~/.ssh/freelanceflow-prod ubuntu@184.195.111.183:/opt/freelanceflow/backups/<file>.dump .
```

**Limitation:** backups live on the same disk as the database, so they protect against bad migrations and mistakes, not against losing the instance. For that, copy a dump off the server, or enable Lightsail snapshots (paid; needs approval).

## Restore

```bash
cd /opt/freelanceflow
ls -lt backups/
./restore.sh backups/freelanceflow-<timestamp>.dump --yes
```

`restore.sh` takes a safety backup, stops the app, runs `pg_restore --clean --if-exists`, and starts the app again.

## Verified

- A manual `./backup.sh` produced a 60 KB dump (2026-11-07).
- The `migrate` job applied `20261107122322_init` on the first release; a re-run is a no-op.
