# Submission blockers

As of 2026-11-08. Deadline: **Nov 12, 2026, 12:00 PM PT (Nov 13, 05:00 JST)**.

## B1: No demo video (P0, mandatory)

- **Missing:** a public YouTube video under 3 minutes showing the app working.
- **Why it matters:** required by Official Rules §4. Judges score "Presentation" from it, and judging may rely on the video alone.
- **Action:** record using `submission/demo-script.md` on https://freelanceflow.hayaix.tech. Do one real Sandbox payment on camera. Use no copyrighted music. Upload to YouTube as **Public**, open the link logged out to confirm it plays, and paste it into the form.
- **Claude can fix it:** no. **You must:** yes.

## B2: Licence not visible on GitHub yet (P0, mandatory)

- **Missing:** the MIT `LICENSE` exists only on the local branch `chore/submission-readiness`.
- **Why it matters:** the rules require an open-source licence that is detectable and visible in the repository's About section.
- **Action:** merge the branch's PR into `main`, then confirm that https://github.com/thosuperman/freelance-flow-ai shows "MIT license" in About. If you prefer a different OSI licence, replace the file before merging.
- **Claude can fix it:** yes, once you approve the merge. **You must:** approve the PR merge.

## B3: No PayPal Sandbox buyer login for judges (P0)

- **Missing:** a Sandbox buyer account judges can use in the PayPal popup.
- **Why it matters:** the rules ask entrants to provide any "sandbox login details necessary to run and test". Without them, judges cannot complete the payment step.
- **Action:** developer.paypal.com → Testing Tools → Sandbox Accounts → create a new **Personal** account just for judges (not the one you use) → copy its email and password into the "Testing instructions" block of `FINAL_SUBMISSION.md` and the Devpost form.
- **Claude can fix it:** no (creating accounts and handling passwords is yours to do). **You must:** yes.

## B4: Production payment through the SDK gateway not yet verified (P1)

- **Missing:** a completed Sandbox capture on production since PayPal Orders moved to the APIMatic-generated SDK.
- **Why it matters:** if it failed, judges and the video would hit an error at the most important step.
- **Action:**
  1. Start a demo on production, request the deposit, and pay with the Sandbox buyer.
  2. Then tell me so I can check the capture, the webhook and the dashboard.
  3. If it fails, set `PAYPAL_ORDERS_CLIENT=rest` on the server; that switches back to the REST path already verified with a real capture.
- **Claude can fix it:** I can verify and switch the setting. **You must:** do the PayPal login and approval.

## B5: Keep the demo running through judging (P1)

- **Missing:** nothing yet. This is an ongoing responsibility.
- **Why it matters:** judges must be able to test until Dec 15, 2026.
- **Action:**
  - Keep the Lightsail instance running.
  - Keep Anthropic API credit sufficient (usage is capped at 400 AI calls/day plus 800 AG Studio turns/day).
  - Don't delete the PayPal Sandbox app or the production webhook.
- **Claude can fix it:** no. **You must:** yes.

## B6: Devpost form not reviewed (P1)

- **Missing:** confirmation of the form's required fields and any custom questions.
- **Action:**
  1. Open "Enter a Submission".
  2. Paste from `FINAL_SUBMISSION.md`, add the thumbnail and screenshots, select the prize categories, and add teammates if any.
  3. Save the draft, then submit before the deadline.
- **Claude can fix it:** no (submitting needs your account). **You must:** yes.

## Optional (not blocking)

- Add a description and website to the GitHub repository's About section: `gh repo edit thosuperman/freelance-flow-ai --description "AI scoping, client approvals and PayPal payments for freelancers" --homepage https://freelanceflow.hayaix.tech`. This changes public metadata, so I haven't run it.
- AG Grid prize strength: a custom AG Studio widget would better match what the sponsor highlights.
