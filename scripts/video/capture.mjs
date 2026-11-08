// Records the real FreelanceFlow AI demo on a deployment, one video per story segment.
// The PayPal Sandbox payment is made by a human in their own browser: when the script reaches the
// payment page it prints the client's payment link and waits until the app reports the payment
// as PAID (verified with PayPal by the server), then records the receipt and the rest of the story.
//
//   node scripts/video/capture.mjs
//
// Output: submission/video/raw/<segment>.webm and submission/video/raw/events.json
import { chromium } from "@playwright/test";
import { mkdir, writeFile, rename, rm } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "https://freelanceflow.hayaix.tech";
const RAW = "submission/video/raw";
const W = 1536, H = 864;
const AI = 150_000;
await rm(RAW, { recursive: true, force: true });
await mkdir(RAW, { recursive: true });

const browser = await chromium.launch();
const newCtx = () => browser.newContext({ baseURL: BASE, viewport: { width: W, height: H }, recordVideo: { dir: `${RAW}/tmp`, size: { width: W, height: H } } });
const freelancer = await newCtx();
const client = await newCtx();
const events = {};
let current = null;

async function segment(name, ctx, fn) {
  const page = await ctx.newPage();
  const t0 = Date.now();
  const mark = (label) => (events[name].marks[label] = (Date.now() - t0) / 1000);
  events[name] = { marks: {} };
  current = name;
  console.log(`▶ ${name}`);
  await fn(page, mark);
  mark("end");
  const video = page.video();
  await page.close();
  await rename(await video.path(), `${RAW}/${name}.webm`);
  await writeFile(`${RAW}/events.json`, JSON.stringify(events, null, 2));
}
const pause = (p, s) => p.waitForTimeout(s * 1000);
const smoothScroll = (p, y) => p.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
const scrollTo = async (p, locator, block = "start") => {
  await locator.evaluate((el, block) => el.scrollIntoView({ behavior: "smooth", block }), block);
  await pause(p, 1.2);
};

let projectUrl, portalPath, payPath, prId;

// 1. Landing
await segment("01-landing", freelancer, async (p) => {
  await p.goto("/");
  await pause(p, 4);
  await smoothScroll(p, 420);
  await pause(p, 4);
  await smoothScroll(p, 0);
  await pause(p, 2);
});

// 2. AI project creation
await segment("02-ai-project", freelancer, async (p, mark) => {
  // The deployment limits new demo workspaces per network per hour; retry until a slot is free.
  for (let attempt = 1; ; attempt++) {
    await p.goto("/demo");
    await pause(p, 1);
    await p.getByTestId("start-demo").click();
    try {
      await p.waitForURL(/\/app\/new/, { timeout: 20_000 });
      break;
    } catch {
      if (attempt >= 30) throw new Error("Could not start a demo workspace (rate limit)");
      console.log(`  demo start refused (attempt ${attempt}); retrying in 2 minutes`);
      await pause(p, 120);
    }
  }
  mark("started");
  await pause(p, 3);
  mark("analyse");
  await p.getByRole("button", { name: "Analyse with AI" }).click();
  await p.getByRole("heading", { name: "Review the draft project" }).waitFor({ timeout: AI });
  mark("ai-done");
  await pause(p, 3);
  await p.getByLabel("Client name").fill("Jordan Lee");
  await p.getByLabel("Client email").fill("jordan@example.com");
  await scrollTo(p, p.getByText("Milestones").first(), "center");
  await pause(p, 4);
  await p.getByRole("button", { name: "Accept all remaining" }).click();
  await pause(p, 2);
  await smoothScroll(p, 0);
  await pause(p, 1.5);
  await p.getByRole("button", { name: "Confirm project" }).first().click();
  await p.waitForURL(/\/app\/projects\/[a-z0-9]+\?tab=proposal/, { timeout: AI });
  projectUrl = p.url().split("?")[0];
  await pause(p, 1.5);
});

// 3. Proposal (freelancer)
await segment("03-proposal", freelancer, async (p, mark) => {
  await p.goto(`${projectUrl}?tab=proposal`);
  await pause(p, 2);
  mark("draft");
  await p.getByTestId("draft-proposal-ai").click();
  await p.waitForFunction(() => (document.querySelector("textarea")?.value ?? "").length > 40, null, { timeout: AI });
  mark("draft-done");
  await pause(p, 2);
  await scrollTo(p, p.getByTestId("send-proposal"), "center");
  await p.getByTestId("send-proposal").click();
  await pause(p, 2);
  await p.getByTestId("confirm-send-proposal").click();
  await p.getByText("Awaiting decision").waitFor();
  portalPath = await p.getByTestId("open-portal").getAttribute("href");
  await smoothScroll(p, 0);
  await pause(p, 2);
});

// 4. Client approval (client portal, separate browser profile)
await segment("04-client-approval", client, async (p) => {
  await p.goto(portalPath);
  await pause(p, 2);
  await p.getByTestId("review-proposal").click();
  await pause(p, 3);
  await scrollTo(p, p.getByTestId("proposal-total"), "center");
  await pause(p, 2);
  await p.getByLabel(/I approve version 1/).check();
  await pause(p, 1.5);
  await p.getByTestId("approve-proposal").click();
  await p.getByTestId("portal-financials").waitFor();
  await pause(p, 2.5);
});

// 5. Payment request (freelancer) and PayPal checkout (client)
await segment("05-request-payment", freelancer, async (p) => {
  await p.goto(projectUrl);
  await pause(p, 1.5);
  const deposit = p.getByTestId("milestone").filter({ hasText: "Upfront deposit" });
  await scrollTo(p, deposit, "center");
  await deposit.getByTestId("request-payment").click();
  await pause(p, 1.5);
  await p.getByTestId("confirm-payment-request").click();
  await deposit.getByText("Payment pending").waitFor();
  await pause(p, 2);
});

await segment("06-paypal-checkout", client, async (p, mark) => {
  await p.goto(portalPath);
  await pause(p, 1.5);
  const link = p.getByTestId("pay-now");
  payPath = await link.getAttribute("href");
  prId = payPath.split("/").pop();
  await link.click();
  await p.frameLocator('iframe[name^="__zoid__paypal_buttons"]').locator("body").waitFor({ timeout: 60_000 });
  // Never record the shared Sandbox password.
  await p.evaluate(() => {
    const dds = document.querySelectorAll('[data-testid="sandbox-buyer"] dd.font-mono');
    if (dds[1]) dds[1].textContent = "••••••••";
  });
  await pause(p, 6);
  mark("buttons");
});

console.log("\n================ ACTION NEEDED ================");
console.log("Pay the $450 deposit in YOUR browser, logging in with the PayPal Sandbox buyer:");
console.log(`  ${BASE}${payPath}`);
console.log("Waiting for the server to report the payment as PAID (up to 40 minutes)…");
console.log("===============================================\n");
const statusUrl = `${BASE}/api/portal/${portalPath.split("/").pop()}/payments/${prId}/status`;
let paid = false;
for (let i = 0; i < 480 && !paid; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  try {
    const r = await fetch(statusUrl);
    const j = await r.json();
    if (j.status === "PAID") paid = true;
    else if (i % 12 === 0) console.log(`  status: ${j.status}`);
  } catch {}
}
if (!paid) {
  console.log("Payment not completed in time; stopping after part 1.");
  await freelancer.close(); await client.close(); await browser.close();
  await rm(`${RAW}/tmp`, { recursive: true, force: true });
  process.exit(2);
}
console.log("✓ PAID (verified by the server with PayPal). Recording part 2.");
events.payment = { paidAt: new Date().toISOString(), paymentRequestId: prId };

// 7. Receipt (client) and project financials (freelancer)
await segment("07-receipt", client, async (p) => {
  await p.goto(`${portalPath}/receipt/${prId}`);
  await p.getByTestId("receipt").waitFor();
  await pause(p, 6);
});
await segment("08-paid-financials", freelancer, async (p) => {
  await p.goto(projectUrl);
  await p.getByTestId("project-financials").waitFor();
  await pause(p, 5);
});

// 9. AI scope check and change request
await segment("09-scope-check", freelancer, async (p, mark) => {
  await p.goto(`${projectUrl}?tab=scope`);
  await pause(p, 1.5);
  await p.getByRole("button", { name: "Insert example request" }).click();
  await pause(p, 2.5);
  mark("check");
  await p.getByTestId("run-scope-check").click();
  await p.getByTestId("scope-classification").waitFor({ timeout: AI });
  mark("check-done");
  await pause(p, 1);
  await scrollTo(p, p.getByTestId("scope-classification"), "start");
  await pause(p, 6);
  await scrollTo(p, p.getByTestId("scope-refs"), "center");
  await pause(p, 4);
  const price = p.getByLabel("Additional price (USD)");
  await scrollTo(p, price, "center");
  await price.fill("300.00");
  await pause(p, 3);
  await p.getByTestId("send-change-request").click();
  await p.getByTestId("change-request").filter({ hasText: "Awaiting client" }).waitFor();
  await pause(p, 2);
});

// 10. Client approves the change
await segment("10-change-approval", client, async (p) => {
  await p.goto(portalPath);
  const cr = p.getByTestId("portal-change-request");
  await scrollTo(p, cr, "center");
  await pause(p, 2.5);
  await cr.getByLabel(/I approve this additional work/).check();
  await pause(p, 1);
  await cr.getByTestId("approve-change-request").click();
  await p.getByTestId("portal-financials").waitFor();
  await smoothScroll(p, 0);
  await pause(p, 3);
});

// 11. Updated financials, timeline, analytics
await segment("11-final-financials", freelancer, async (p) => {
  await p.goto(projectUrl);
  await p.getByTestId("project-financials").waitFor();
  await pause(p, 6);
});
await segment("12-timeline", freelancer, async (p, mark) => {
  await p.goto(`${projectUrl}?tab=timeline`);
  await p.getByTestId("smart-timeline").getByText("CR #").first().waitFor({ timeout: 90_000 });
  mark("ready");
  await scrollTo(p, p.getByTestId("smart-timeline"), "center");
  await pause(p, 5);
});
await segment("13-insights", freelancer, async (p, mark) => {
  await p.goto("/app/insights");
  await p.getByTestId("financial-studio").getByText("Totals by currency").waitFor({ timeout: 90_000 });
  mark("ready");
  await scrollTo(p, p.getByTestId("financial-studio"), "start");
  await pause(p, 5);
});
await segment("14-dashboard", freelancer, async (p) => {
  await p.goto("/app");
  await pause(p, 6);
});

await freelancer.close();
await client.close();
await browser.close();
await rm(`${RAW}/tmp`, { recursive: true, force: true });
await writeFile(`${RAW}/events.json`, JSON.stringify(events, null, 2));
console.log("DONE");
