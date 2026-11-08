# Release checklist and definition-of-done status

Status as of 2026-11-07 (local build). ✅ = done and verified locally · ⏳ = pending (reason given) · ❌ = not done.

| Definition of done | Status | Evidence / notes |
| --- | --- | --- |
| Freelancer can create an account | ✅ | Better Auth email/password; E2E `auth-and-milestones.spec.ts` |
| Create a project using real AI | ✅ | Verified live 2026-11-07 with `claude-sonnet-5-5`: extraction and proposal drafting stored as `provider = anthropic` |
| Generated project is editable | ✅ | Review screen and Edit terms; E2E |
| Proposal can be sent to a client | ✅ | Immutable versions; E2E + integration |
| Client can review and approve | ✅ | Portal; approval record with hash; tamper test |
| Milestone can generate a payment request | ✅ | Eligibility rules; E2E + integration |
| Client completes a genuine PayPal Sandbox transaction | ✅ | Verified live 2026-11-07: order `2TY00931XK2249302`, capture `4L223070M78934542`, USD 450.00 `COMPLETED` (sandbox buyer account) |
| Backend verifies and persists the payment | ✅ | Capture confirmed with `GET /v2/payments/captures/{id}`; one `PaymentTransaction` (`CAPTURE_RESPONSE`); both webhooks signature-verified and `PROCESSED` |
| Dashboard updates from stored financial data | ✅ | E2E asserts $1,800 / $450 / $1,350 |
| AI detects a meaningful scope change | ✅ | Live Claude: booking request flagged out of scope (high confidence), citing D1, D2, E8; price from 6 h × rate |
| Freelancer creates a change request | ✅ | E2E |
| Client approves the change request | ✅ | E2E + integration |
| Financial totals update accurately | ✅ | Unit + integration + E2E |
| Authorization boundaries enforced | ✅ | Integration tests (cross-user, cross-project tokens, revoked tokens) |
| Core automated tests pass | ✅ | 101 Vitest (unit + integration) and 5 Playwright E2E (desktop + mobile, incl. timeline and AG Studio), all passing (2026-11-08) |
| Works on desktop and mobile | ✅ | Responsive layouts; mobile E2E checks no horizontal overflow |
| Deployable using documented steps | ✅ | Live at https://freelanceflow.hayaix.tech (AWS Lightsail us-east-1) via `deploy/deploy.sh`; see `docs/deployment/` |
| Devpost materials prepared | ✅ | `submission/` (video and screenshots still to be recorded) |

## Before the public demo

- [x] Set `ANTHROPIC_API_KEY`, run the demo, confirm no "Simulated AI" badges and `AIAnalysis.provider = anthropic` (2026-11-07, local)
- [x] Configure PayPal Sandbox app + webhook; complete the manual verification and note the capture ID here: `4L223070M78934542` (2026-11-07, local via ngrok)
- [ ] Repeat the Sandbox checkout on the deployed URL (update the webhook URL to the deployed domain first)
- [x] Deploy to AWS Lightsail; `prisma migrate deploy` runs in every release; `/api/health` OK (2026-11-08)
- [x] Set `CRON_SECRET`; hourly cleanup cron on the server returns `{"deleted":0}` (2026-11-07)
- [ ] Run `npm run typecheck && npm run lint && npm test && npm run test:e2e`
- [ ] Record video and screenshots from the deployed environment
