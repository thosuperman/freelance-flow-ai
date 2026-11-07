import { expect, test } from "@playwright/test";

test("protected routes redirect to sign-in", async ({ page }) => {
  await page.goto("/app/projects");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp%2Fprojects/);
});

test("invalid portal links show not found", async ({ page }) => {
  const res = await page.goto("/portal/this-token-does-not-exist-aaaaaaaaaaaaaaaaaaaaaaa");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("sign up, onboard, create project, submit milestone, client accepts, request payment", async ({ page, browser }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Sam Carter");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/app\/onboarding/);
  await page.getByLabel("Business name").fill("Carter Design");
  await page.getByLabel("Hourly rate (optional)").fill("60");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/app\/new/);

  await page.getByRole("button", { name: "Formal email brief" }).click();
  await page.getByRole("button", { name: "Analyse with AI" }).click();
  await expect(page.getByLabel("Client name")).toHaveValue("Daniel Okafor");
  await page.getByRole("button", { name: "Accept all remaining" }).click();
  await page.getByRole("button", { name: "Confirm project" }).first().click();
  await page.waitForURL(/tab=proposal/);

  await page.getByTestId("draft-proposal-ai").click();
  await expect(page.getByLabel("Overview")).not.toHaveValue("");
  await page.getByTestId("send-proposal").click();
  await page.getByTestId("confirm-send-proposal").click();
  const portal = await page.getByTestId("open-portal").getAttribute("href");

  const client = await browser.newContext();
  const cp = await client.newPage();
  await cp.goto(`${portal}/proposal`);
  await cp.getByLabel(/I approve version 1/).check();
  await cp.getByTestId("approve-proposal").click();
  await cp.waitForURL(new RegExp(`${portal}$`));

  // Freelancer submits the final delivery milestone.
  await page.goto(page.url().split("?")[0]!);
  const last = page.getByTestId("milestone").last();
  await last.getByRole("button", { name: "Submit for review" }).click();
  await page.getByLabel("Delivery note (optional)").fill("Final files are in the shared folder.");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(last).toContainText("Submitted");
  await expect(last.getByTestId("request-payment")).toHaveCount(0);

  // Client accepts the delivery in the portal.
  await cp.goto(portal!);
  const review = cp.getByTestId("portal-milestone-review");
  await expect(review).toContainText("Final files are in the shared folder.");
  await review.getByTestId("accept-delivery").click();
  await expect(cp.getByTestId("portal-milestone-review")).toHaveCount(0);

  // Now the milestone is payable.
  await page.reload();
  await expect(last).toContainText("Client approved");
  await last.getByTestId("request-payment").click();
  await page.getByTestId("confirm-payment-request").click();
  await expect(last).toContainText("Payment pending");
  await client.close();
});
