// Captures Devpost screenshots by walking the real demo story on a running deployment
// (live Claude, PayPal Sandbox). It stops at the PayPal popup: paying needs a human Sandbox login.
//
//   node scripts/capture-screenshots.mjs                      # https://freelanceflow.hayaix.tech
//   BASE_URL=http://localhost:3000 node scripts/capture-screenshots.mjs
//
// Output: submission/screenshots/*.png (1440×900) and submission/thumbnail.png (1500×1000).
import { chromium, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "https://freelanceflow.hayaix.tech";
const OUT = "submission/screenshots";
const AI = 120_000;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, baseURL: BASE });
const page = await ctx.newPage();
const shot = async (p, name, opts = {}) => {
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log("saved", name);
};

// 1. Landing
await page.goto("/");
await shot(page, "01-landing");

// 2–3. AI project creation and review
await page.goto("/demo");
await page.getByTestId("start-demo").click();
await page.waitForURL(/\/app\/new/);
await shot(page, "02-ai-project-creation");
await page.getByRole("button", { name: "Analyse with AI" }).click();
await page.getByRole("heading", { name: "Review the draft project" }).waitFor({ timeout: AI });
await page.getByLabel("Client name").fill("Jordan Lee");
await page.getByLabel("Client email").fill("jordan@example.com");
await shot(page, "03-ai-review");
await page.getByRole("button", { name: "Accept all remaining" }).click();
await page.getByRole("button", { name: "Confirm project" }).first().click();
await page.waitForURL(/\/app\/projects\/[a-z0-9]+\?tab=proposal/, { timeout: AI });
const projectUrl = page.url().split("?")[0];

// 4. Proposal drafted by AI, then sent
await page.getByTestId("draft-proposal-ai").click();
await page.getByLabel("Overview").filter({ hasText: /\S/ }).waitFor({ timeout: AI }).catch(() => {});
await page.waitForFunction(() => (document.querySelector("textarea")?.value ?? "").length > 40, null, { timeout: AI });
await page.getByTestId("send-proposal").click();
await page.getByTestId("confirm-send-proposal").click();
await page.getByText("Awaiting decision").waitFor();
await shot(page, "04-proposal-sent");
const portalPath = await page.getByTestId("open-portal").getAttribute("href");

// 5. Client portal approval (separate context = no freelancer session)
const clientCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: BASE });
const cp = await clientCtx.newPage();
await cp.goto(portalPath);
await cp.getByTestId("review-proposal").click();
await cp.getByLabel(/I approve version 1/).check();
await shot(cp, "05-client-approval");
await cp.getByTestId("approve-proposal").click();
await cp.getByTestId("portal-financials").waitFor();

// 6. Deposit request and PayPal Sandbox checkout page
await page.goto(projectUrl);
await page.getByTestId("milestone").filter({ hasText: "Upfront deposit" }).getByTestId("request-payment").click();
await page.getByTestId("confirm-payment-request").click();
await page.getByTestId("milestone").filter({ hasText: "Upfront deposit" }).getByText("Payment pending").waitFor();
await cp.goto(portalPath);
await cp.getByTestId("pay-now").click();
await cp.frameLocator('iframe[name^="__zoid__paypal_buttons"]').locator("body").waitFor({ timeout: 60_000 });
await cp.waitForTimeout(4000);
await shot(cp, "06-paypal-sandbox-checkout");

// 7–8. Scope check and change request
await page.goto(`${projectUrl}?tab=scope`);
await page.getByRole("button", { name: "Insert example request" }).click();
await page.getByTestId("run-scope-check").click();
await page.getByTestId("scope-classification").waitFor({ timeout: AI });
await shot(page, "07-scope-check", { fullPage: true });
await page.getByTestId("send-change-request").click();
await page.getByTestId("change-request").filter({ hasText: "Awaiting client" }).waitFor();
await cp.goto(portalPath);
const cr = cp.getByTestId("portal-change-request");
await cr.getByLabel(/I approve this additional work/).check();
await shot(cp, "08-client-change-approval");
await cr.getByTestId("approve-change-request").click();
await cp.getByTestId("portal-financials").waitFor();

// 9. Financial strip
await page.goto(projectUrl);
await shot(page, "09-project-financials");

// 10. Smart timeline (Bryntum)
await page.goto(`${projectUrl}?tab=timeline`);
await page.getByTestId("smart-timeline").getByText("CR #").first().waitFor({ timeout: 90_000 });
await page.getByTestId("smart-timeline").scrollIntoViewIfNeeded();
await shot(page, "10-smart-timeline");

// 11. Financial Intelligence (AG Studio)
await page.goto("/app/insights");
await page.getByTestId("financial-studio").getByText("Totals by currency").waitFor({ timeout: 90_000 });
await page.getByRole("button", { name: "How much additional revenue came from scope changes?" }).click();
await page.getByTestId("ask-finances-result").waitFor({ timeout: AI });
await shot(page, "11-financial-intelligence", { fullPage: true });

// 12. Dashboard
await page.goto("/app");
await shot(page, "12-dashboard");

// 13. Mobile client portal
const phone = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE });
const mp = await phone.newPage();
await mp.goto(portalPath);
await shot(mp, "13-mobile-portal");

// Thumbnail (3:2), rendered from HTML with the app's own mark
const thumb = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await thumb.setContent(`<!doctype html><html><body style="margin:0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="width:1500px;height:1000px;display:flex;flex-direction:column;justify-content:center;padding:0 120px;box-sizing:border-box;background:linear-gradient(135deg,#eef2ff 0%,#ffffff 55%,#f5f3ff 100%)">
  <div style="display:flex;align-items:center;gap:28px">
    <div style="width:120px;height:120px;border-radius:28px;background:linear-gradient(135deg,#6366f1,#4338ca);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 40px rgba(79,70,229,.35)">
      <svg viewBox="0 0 24 24" width="70" height="70" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9a4 4 0 0 1 0 8H8"/><path d="M11 12l-3 3 3 3"/></svg>
    </div>
    <div style="font-size:84px;font-weight:700;color:#111827;letter-spacing:-2px">FreelanceFlow <span style="color:#4f46e5">AI</span></div>
  </div>
  <div style="margin-top:56px;font-size:58px;font-weight:700;line-height:1.15;color:#111827">From conversation to contract.<br><span style="color:#4f46e5">From work to payment.</span></div>
  <div style="margin-top:40px;font-size:30px;color:#4b5563;line-height:1.45">AI scopes the deal and catches scope creep · clients approve · PayPal gets you paid</div>
</div></body></html>`);
await thumb.screenshot({ path: "submission/thumbnail.png" });
console.log("saved thumbnail");

await browser.close();
