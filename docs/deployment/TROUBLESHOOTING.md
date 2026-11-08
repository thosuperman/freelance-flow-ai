# Troubleshooting

All server commands assume:

```bash
ssh -i ~/.ssh/freelanceflow-prod ubuntu@184.195.111.183
cd /opt/freelanceflow
alias dc='docker compose -f compose.prod.yml --env-file .env.production'
```

## The site is down

1. `curl -sS https://freelanceflow.hayaix.tech/api/health`
2. On the server: `dc ps`. Every service should be `Up`, and `app`/`db` should be `(healthy)`.
3. `dc logs --tail 100 app` and `dc logs --tail 50 caddy`.
4. `dc up -d` starts anything that is stopped.
5. If a new release is broken: `./rollback.sh`.
6. If SSH doesn't connect, your IP probably changed: re-run `deploy/provision.sh` locally, or use the Lightsail browser console.

`monitor.sh` checks every 5 minutes and restarts the app if its health check fails. Read its log with `tail -n 50 monitor.log`.

## `/api/health` returns 503

The database is unreachable. Check `dc ps db` and `dc logs --tail 50 db`. If the disk is full (`df -h /`), run `docker system prune -f` and delete old backups.

## Certificate errors

- `dig +short freelanceflow.hayaix.tech` must return `184.195.111.183`.
- `dc logs caddy | grep -i -E 'error|acme'`.
- Ports 80 and 443 must be open in the Lightsail firewall.
- The `hayaix.tech` CAA record must still allow `letsencrypt.org`.

## Out of memory

Run `free -m` and `docker stats --no-stream`. The app is limited to 900 MB and PostgreSQL to 512 MB, and there is 2 GB of swap. If containers keep getting killed (`dmesg | grep -i oom`), lower `NODE_OPTIONS` or PostgreSQL's `shared_buffers`, or ask for approval to move to the 4 GB bundle.

## AI errors

- "The live AI has reached today's usage limit": `AI_DAILY_LIMIT` was hit. Raise it in `.env.production` and recreate the app (`dc up -d app`).
- "AI unavailable": check `dc logs app | grep -i ai` and the Anthropic key or quota.

## PayPal

- No buttons on the payment page: check that `/api/health` shows `"paypal":{"mode":"sandbox","configured":true}`.
- Payment stuck in "processing": open the receipt page; it reconciles with PayPal on load.
- Webhooks failing: check the delivery log for the production webhook in the PayPal developer dashboard. Production rejects events signed for the ngrok webhook ID, and that is expected.

## Database access

```bash
dc exec db psql -U freelanceflow -d freelanceflow
```
