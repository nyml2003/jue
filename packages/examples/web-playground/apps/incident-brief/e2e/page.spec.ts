import { expect, test } from "@playwright/test";

test("incident-brief app renders in the browser", async ({ page }) => {
  await page.goto("/apps/incident-brief/dist/");
  await expect(page.locator("body")).toContainText("API latency brief");
  await expect(page.locator("body")).toContainText("Escalation remains open while p95 stays above 900 ms.");
  await expect(page.locator("body")).toContainText("Current mitigation");
});

