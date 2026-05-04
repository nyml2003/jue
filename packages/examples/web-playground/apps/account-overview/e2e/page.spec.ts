import { expect, test } from "@playwright/test";

test("account-overview app renders in the browser", async ({ page }) => {
  await page.goto("/apps/account-overview/dist/");
  await expect(page.locator("body")).toContainText("Account Overview");
  await expect(page.locator("body")).toContainText("Healthy renewal posture");
  await expect(page.locator("body")).toContainText("Open invoices");
});

