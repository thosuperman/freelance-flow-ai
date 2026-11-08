# Domain and HTTPS

## DNS

`hayaix.tech` is a Route 53 public hosted zone in the `hayaitech` AWS account (its nameservers are `awsdns`), so DNS was changed with the AWS CLI. The domain itself is registered outside Route 53 Domains.

One record was added by [deploy/provision.sh](../../deploy/provision.sh) with `UPSERT` on that single name. No existing records (root, `www`, `kiseki`, mail, DKIM, DMARC, CAA) were modified.

```text
freelanceflow.hayaix.tech.  300  IN  A  184.195.111.183
```

Check it:

```bash
dig +short freelanceflow.hayaix.tech
```

## Certificates

[Caddy](../../deploy/Caddyfile) obtains and renews the certificate automatically (HTTP-01/TLS-ALPN challenges on ports 80/443). Certificates are stored in the `caddy_data` volume, so restarts don't re-issue them.

`hayaix.tech` has a CAA record that only allows `letsencrypt.org`. Caddy's default issuer is Let's Encrypt, so issuance works. A different issuer (for example an AWS-issued certificate) would be refused unless the CAA record is extended.

Verified on 2026-11-07:

| Check | Result |
| --- | --- |
| Certificate | `CN=freelanceflow.hayaix.tech`, issuer Let's Encrypt `YE2`, valid until 2027-02-05 |
| HTTP → HTTPS | `308 Permanent Redirect` to `https://freelanceflow.hayaix.tech/` |
| HTTP/3 | Advertised (`alt-svc: h3`) |
| HSTS | `max-age=63072000; includeSubDomains` (sent by the app) |
| Mixed content | None: no `http:` resources on the page |
| Cookies | Better Auth uses secure cookies because `APP_URL` is `https://`; the session cookie is HttpOnly (not readable from page scripts) |
| Auth and portal links | Built from `APP_URL=https://freelanceflow.hayaix.tech` |

```bash
echo | openssl s_client -connect freelanceflow.hayaix.tech:443 -servername freelanceflow.hayaix.tech 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
curl -sI http://freelanceflow.hayaix.tech/
```

## Client IP addresses

Caddy replaces `X-Forwarded-For` from untrusted clients with the real peer address and also sets `X-Real-IP`. The app's per-IP limits (demo creation, sign-in) therefore can't be bypassed by sending a fake header.
