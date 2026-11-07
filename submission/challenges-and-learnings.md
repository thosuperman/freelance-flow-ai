# Challenges and learnings

## Technical challenges

1. **Exactly-once payment recording.** PayPal can tell us a capture happened in up to four ways: the capture response, a GET order after a timeout, `CHECKOUT.ORDER.APPROVED`, and `PAYMENT.CAPTURE.*` webhooks. All of them go through one `recordCapture` function that locks the payment request row, checks amount, currency and reference, and relies on a unique capture id. Duplicates become no-ops.
2. **Double payment across browser windows.** Two approved PayPal orders for the same request are possible. A capture lock taken under a row lock guarantees only one is ever captured. We wrote a concurrent test to prove it.
3. **Immutable agreements.** Approval re-hashes the stored snapshot *and* rebuilds it from live data. Both must match the hash the client saw, so a tampered row or a race with an edit is rejected.
4. **Explainable scope detection.** Reference-tagged scope (D#, E#, C#, A#) plus server-side filtering of non-existent references turns a black-box judgment into an auditable one.
5. **AI that can't touch money.** The model returns hours, never prices. Percentages become amounts in decimal arithmetic with deterministic rounding, including zero-decimal currencies such as JPY.
6. **Untrusted input.** Client messages may contain prompt injection. They are wrapped as untrusted data, the model has no tools, and every value is validated by code.

## Product learnings

- Freelancers don't want "AI invoices". They want protection: a clear record of what was agreed and a calm, professional way to say "that's extra".
- Forcing a decision on each AI assumption feels like friction for about ten seconds and then like a safety net.
- Being explicit about what is simulated builds more trust with judges and users than hiding it.
