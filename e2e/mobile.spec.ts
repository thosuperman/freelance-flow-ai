import { expect, test } from "@playwright/test";

test("landing, demo and AI creation work on a phone-sized screen without horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("From conversation to contract");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.goto("/demo");
  await page.getByTestId("start-demo").click();
  await page.waitForURL(/\/app\/new/);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await page.getByRole("button", { name: "Analyse with AI" }).click();
  await expect(page.getByRole("heading", { name: "Review the draft project" })).toBeVisible();
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow2).toBeLessThanOrEqual(1);
});
