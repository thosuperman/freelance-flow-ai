# Production report: FreelanceFlow AI demo video

| Item | Result |
| --- | --- |
| Final file | `submission/video/freelanceflow-demo-final.mp4` |
| Duration | **2:27** (147.07 s); limit 3:00 |
| Resolution / frame rate | 1920×1080, 30 fps |
| Codecs | H.264 (yuv420p, CRF 18) + AAC 192 kb/s stereo 48 kHz, `faststart` |
| Size | 16.4 MB |
| Narration | Apple system voice "Samantha" (macOS `say`), slowed to ~120 wpm with natural pauses, loudness-normalised (mean −19 dB, peak −4.5 dB, no clipping). No cloned or imitated human voice |
| Music | None |
| Captions | Burned in (rendered strip below the app, never covering UI) **and** `captions.srt` (28 cues) |
| Section labels | AI Project Creation · Client Approval · PayPal Sandbox Payment · AI Scope Protection · Financial Overview |
| Footage | Real Playwright recording of https://freelanceflow.hayaix.tech on 2026-11-08 (14 segments), in the order performed |
| Real AI shown | Yes: live Claude extraction, proposal draft and scope check during this recording |
| Real PayPal Sandbox payment | **Yes**: capture `0NR741936P3696537`, COMPLETED, USD 450.00, confirmed via PayPal's API; stored once on production; the signature-verified `PAYMENT.CAPTURE.COMPLETED` webhook was processed |
| Payment footage scope | Shown: payment page with PayPal Sandbox buttons, then the real receipt (capture ID, "PayPal Sandbox") and $450 received. **Not shown:** the PayPal login window. The buyer approved in a separate browser, and the narration doesn't claim otherwise |
| Amounts on screen | $1,500 contract; $450 / $1,050 milestones; $300 change (price typed by the freelancer; AI suggested hours × rate); $1,800 revised, $450 paid, $1,350 outstanding: all computed by the app |
| Secrets | Sandbox buyer password masked on the payment page; no API keys, client secrets or merchant details visible |

## Editing

- AI waiting time is shortened: a few seconds of the real "analysing" state are kept.
- Clips are sped up at most ×1.71 (proposal and approval section), slowed at most to 0.75×, or held on the last frame (dashboard before the end card).
- No frame content was altered.

## QA performed

- Format checked with `ffprobe`.
- Loudness checked with `volumedetect`; long silences checked with `silencedetect` (only the end-card tail).
- Frames reviewed at every section: readable UI, correct amounts, captions placed below the app, consistent fonts, end card.

## Known limitations

- The voice is a standard macOS voice. A premium voice (System Settings → Accessibility → Spoken Content → Manage Voices, e.g. "Ava (Premium)") or a licensed TTS service would sound more natural. Re-run `python3 scripts/video/build.py` after regenerating the narration WAVs.
- Captions are timed by sentence length within each narration segment, not word-aligned; drift is under about a second.

## Remaining manual steps

1. Watch the video once end to end.
2. Upload to YouTube as **Public** (or Unlisted, then switch to Public) and add `captions.srt` as English subtitles.
3. Open the link in a logged-out browser to confirm it plays, then paste the URL into Devpost.
