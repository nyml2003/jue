import { expect, test } from "@playwright/test";

test("release-checklist app renders in the browser", async ({ page }) => {
  await page.goto("/apps/release-checklist/dist/");
  await expect(page.locator("body")).toContainText("Release Checklist");
  await expect(page.locator("body")).toContainText("Ready for rollout");
  await expect(page.locator("body")).toContainText("All blocking checks are green. Proceed with staged rollout.");
});

