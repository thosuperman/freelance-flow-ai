# Recording notes

- **Tool:** Playwright (Chromium, headless) with `recordVideo`, viewport 1536×864, one video per story segment (`scripts/video/capture.mjs`). The app footage is scaled to 1632×918 inside the 1920×1080 frame, with a label strip on top and a caption strip below, so captions never cover the UI.
- **Environment:** production, https://freelanceflow.hayaix.tech, a fresh demo workspace (fictional client "Jordan Lee"), live Claude (`claude-sonnet-5-5`), PayPal Sandbox.
- **Freelancer and client:** recorded in two separate browser profiles, like two real people.
- **The payment (honest scope):**
  - Signing in to PayPal needs a human, so the recording stopped at the payment page.
  - The project owner opened the same client payment link in their own browser, logged in with the PayPal Sandbox buyer, and approved $450.
  - The script waited until the app's status endpoint reported **PAID** (the server verifies the capture with PayPal), then recorded the receipt.
  - The PayPal login window itself is therefore not in the video.
  - Capture `0NR741936P3696537` was independently confirmed with PayPal's API: COMPLETED, USD 450.00, `custom_id` = the payment request. Production stored it once, and the signature-verified `PAYMENT.CAPTURE.COMPLETED` webhook was processed.
- **AI output:** whatever Claude returned in this run. The scope check's price suggestion was hours × rate; the freelancer then typed **$300.00** into the price field, which the app allows. All later totals are the app's own calculations.
- **Secrets:** the Sandbox buyer password on the payment page was masked before recording. No API keys or merchant details appear.
- **Rebuilding:** `node scripts/video/capture.mjs` (needs a person for the PayPal step), then `python3 scripts/video/build.py`.
