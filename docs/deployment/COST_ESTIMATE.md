# Cost estimate

Prices checked with `aws lightsail get-bundles` in `us-east-1` on 2026-11-07.

| Item | Monthly cost | Notes |
| --- | --- | --- |
| Lightsail instance `small_3_0` | **USD 12.00** | 2 vCPU, 2 GB RAM, 60 GB SSD, 3 TB outbound transfer included |
| Static IPv4 | USD 0.00 | Free while attached to an instance. **Billed if left unattached**, so release it when deleting the instance |
| Data transfer | USD 0.00 | Expected usage is far below the 3 TB allowance |
| Route 53 | ~USD 0.00 extra | The `hayaix.tech` hosted zone already existed (its USD 0.50/month is not new). One added A record; query charges are negligible |
| TLS certificate | USD 0.00 | Let's Encrypt via Caddy |
| Backups | USD 0.00 | `pg_dump` files on the instance disk, 7-day retention. No paid snapshots |
| Monitoring | USD 0.00 | Docker health checks, cron script, OS tools |
| **Infrastructure total** | **≈ USD 12/month** | |

## Usage-based costs outside AWS

- **Claude API**: billed per token by Anthropic. `AI_DAILY_LIMIT=400` caps live AI calls site-wide per 24 hours; each demo workspace is also capped at 25 analyses and each user at 20 per 10 minutes.
- **PayPal Sandbox**: free; no real money moves.

## Not used (by design)

RDS, ECS/EKS/Fargate, load balancers, NAT gateways, CloudFront, ElastiCache, API Gateway, Lightsail snapshots, container registries, paid monitoring.

## If 2 GB stops being enough

Measured idle usage is ~620 MB with swap unused, so there is ample headroom for a demo. The next step up would be `medium_3_0` (4 GB, USD 24/month), which requires approval and is not planned.
