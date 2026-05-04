import { expect, test } from "@playwright/test";

test("stream-lab turns button clicks into live guidance", async ({ page }) => {
  await page.goto("/apps/stream-lab/dist/");

  await expect(page.locator("body")).toContainText("Stream Lab");
  await expect(page.locator(".stream-lab-recommendation")).toContainText("Log the first moment to unlock a next-step suggestion.");

  await page.getByRole("button", { name: "Closed a blocker" }).click();

  await expect(page.locator(".stream-lab-metric-value--momentum")).toHaveText("3");
  await expect(page.locator(".stream-lab-status")).toHaveText("Steady delivery rhythm");
  await expect(page.locator(".stream-lab-recommendation")).toContainText("visible progress");

  await page.getByRole("button", { name: "Flagged risk" }).click();

  await expect(page.locator(".stream-lab-metric-value--risks")).toHaveText("1");
  await expect(page.locator(".stream-lab-recommendation")).toContainText("customer-facing note");
});
