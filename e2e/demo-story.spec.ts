import { expect, test, type Page } from "@playwright/test";

/**
 * The complete hackathon demo story, driven through the real UI:
 * conversation → AI project → proposal → client approval → $450 deposit → scope change $300 → totals.
 * PayPal runs in PAYPAL_MODE=mock (simulated gateway) — this is not a live Sandbox transaction.
 */

async function startDemo(page: Page) {
  await page.goto("/demo");
  await page.getByTestId("start-demo").click();
  await page.waitForURL(/\/app\/new/);
}

test("full demo story: conversation to paid deposit and approved change request", async ({ page, context }) => {
  await startDemo(page);

  // 1–3. Load example, run AI extraction, review generated scope.
  await expect(page.getByLabel("Client conversation")).toHaveValue(/landing page/);
  await page.getByRole("button", { name: "Analyse with AI" }).click();
  await expect(page.getByRole("heading", { name: "Review the draft project" })).toBeVisible();
  await expect(page.getByLabel("Project title")).toHaveValue("Business Landing Page");
  await expect(page.getByLabel("Milestone 1 amount")).toHaveValue("450.00");
  await expect(page.getByLabel("Milestone 2 amount")).toHaveValue("1050.00");
  await expect(page.getByTestId("reconciliation")).toContainText("matches project value");

  // Confirm is blocked until every AI assumption is reviewed.
  const confirm = page.getByRole("button", { name: "Confirm project" }).first();
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Client name").fill("Jordan Lee");
  await page.getByLabel("Client email").fill("jordan@example.com");
  await page.getByRole("button", { name: "Accept all remaining" }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.waitForURL(/\/app\/projects\/[a-z0-9]+\?tab=proposal/);

  // 4. Draft proposal with AI and send it.
  await page.getByTestId("draft-proposal-ai").click();
  await expect(page.getByLabel("Overview")).toHaveValue(/Jordan Lee/);
  await page.getByTestId("send-proposal").click();
  await page.getByTestId("confirm-send-proposal").click();
  await expect(page.getByText("Awaiting decision")).toBeVisible();
  const portalPath = await page.getByTestId("open-portal").getAttribute("href");
  expect(portalPath).toMatch(/^\/portal\/[A-Za-z0-9_-]{40,}$/);

  // 5. Client portal (separate browser context → no freelancer session).
  const client = await context.browser()!.newContext();
  const cp = await client.newPage();
  await cp.goto(portalPath!);
  await cp.getByTestId("review-proposal").click();
  await expect(cp.getByTestId("proposal-total")).toHaveText("$1,500.00");
  await cp.getByLabel(/I approve version 1/).check();
  await cp.getByTestId("approve-proposal").click();
  await expect(cp.getByTestId("portal-financials")).toContainText("$1,500.00");

  // 6. Freelancer requests the deposit; client pays through (simulated) PayPal.
  await page.goto(page.url().split("?")[0]!);
  await expect(page.getByTestId("project-financials")).toContainText("Approved proposal");
  await page.getByTestId("milestone").filter({ hasText: "Upfront deposit" }).getByTestId("request-payment").click();
  await page.getByTestId("confirm-payment-request").click();
  await expect(page.getByTestId("milestone").filter({ hasText: "Upfront deposit" })).toContainText("Payment pending");

  await cp.goto(portalPath!);
  await cp.getByTestId("pay-now").click();
  await expect(cp.getByTestId("mock-checkout")).toContainText("Simulated PayPal checkout");
  await cp.getByTestId("mock-pay").click();
  await cp.waitForURL(/\/receipt\//);
  await expect(cp.getByTestId("receipt")).toContainText("$450.00");
  await expect(cp.getByTestId("receipt")).toContainText("Simulated PayPal");

  // 7–8. Scope change detected by AI; change request generated with price from hourly rate.
  await page.goto(`${page.url().split("?")[0]}?tab=scope`);
  await page.getByRole("button", { name: "Insert example request" }).click();
  await page.getByTestId("run-scope-check").click();
  await expect(page.getByTestId("scope-classification")).toHaveText("Outside approved scope");
  await expect(page.locator('[data-testid="scope-refs"] [data-cited="true"]').first()).toBeVisible();
  await expect(page.getByLabel("Additional price (USD)")).toHaveValue("300.00");
  await page.getByTestId("send-change-request").click();
  await expect(page.getByTestId("change-request")).toContainText("Awaiting client");

  // 9. Client approves the change request.
  await cp.goto(portalPath!);
  const crCard = cp.getByTestId("portal-change-request");
  await expect(crCard).toContainText("$300.00");
  await crCard.getByLabel(/I approve this additional work/).check();
  await crCard.getByTestId("approve-change-request").click();
  await expect(cp.getByTestId("portal-financials")).toContainText("$1,350.00");

  // 10. Freelancer sees updated totals from persisted records.
  await page.goto(page.url().split("?")[0]!);
  const fin = page.getByTestId("project-financials");
  await expect(fin).toContainText("$1,500.00");
  await expect(fin).toContainText("$300.00");
  await expect(fin).toContainText("$1,800.00");
  await expect(fin).toContainText("$450.00");
  await expect(fin).toContainText("$1,350.00");

  await page.goto("/app");
  const totals = page.getByTestId("dashboard-totals-USD");
  await expect(totals).toContainText("$1,800.00");
  await expect(totals).toContainText("$450.00");
  await expect(totals).toContainText("$1,350.00");

  await page.goto("/app/payments");
  await expect(page.getByTestId("payment-history-row")).toHaveCount(1);
  await client.close();
});
