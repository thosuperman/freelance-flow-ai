#!/usr/bin/env bash
# Builds submission/judge-package.zip for Devpost's private "Additional info" upload (limit 35 MB).
# Includes the filled-in JUDGE_CREDENTIALS.md only if you created it (it is git-ignored).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=submission/judge-package.zip
STAGE=$(mktemp -d)
mkdir -p "$STAGE/FreelanceFlow-AI-judges"
D="$STAGE/FreelanceFlow-AI-judges"
cat > "$D/START-HERE.txt" <<'TXT'
FreelanceFlow AI: materials for judges and organizers (private)

Live demo:   https://freelanceflow.hayaix.tech/demo  ->  "Try the full demo"
Source code: https://github.com/thosuperman/freelance-flow-ai (MIT)
Demo video:  on YouTube (link on the submission page)

1. JUDGE_DEMO_GUIDE.md: 3-minute test flow (PayPal Sandbox payment, AI scope check)
2. JUDGE_CREDENTIALS.md: PayPal Sandbox buyer logins (simulated money only), if included

No app login is needed. All payments use PayPal Sandbox; no real money moves.
TXT
cp submission/JUDGE_DEMO_GUIDE.md "$D/"
if [[ -f submission/JUDGE_CREDENTIALS.md ]]; then cp submission/JUDGE_CREDENTIALS.md "$D/"; echo "including JUDGE_CREDENTIALS.md"; else echo "note: submission/JUDGE_CREDENTIALS.md not found; credentials NOT included"; fi
rm -f "$OUT"
(cd "$STAGE" && zip -qr - FreelanceFlow-AI-judges) > "$OUT"
rm -rf "$STAGE"
printf '%s: %s\n' "$OUT" "$(du -h "$OUT" | cut -f1)"
unzip -l "$OUT" | sed -n "4,10p"
