import { expect, test } from "@playwright/test";

test("router-query-lab demonstrates router params, query tabs, and query cache reuse", async ({ page }) => {
  await page.goto("/apps/router-query-lab/dist/");
  await expect(page.locator("body")).toContainText("Router Query Lab");
  await expect(page.locator("body")).toContainText("Alpha checkout");
  await expect(page.locator("body")).toContainText("Escalation is still blocking launch.");
  await expect(page).toHaveURL(/projects\/alpha\?tab=overview$/);

  await page.getByRole("button", { name: "Activity tab" }).click();
  await expect(page.locator("body")).toContainText("The activity tab is a separate query key");
  await expect(page.locator("body")).toContainText("Activity feed looks healthy.");
  await expect(page).toHaveURL(/projects\/alpha\?tab=activity$/);

  await page.getByRole("button", { name: "Overview tab" }).click();
  await expect(page).toHaveURL(/projects\/alpha\?tab=overview$/);

  await page.getByRole("button", { name: "Bravo billing" }).click();
  await expect(page.locator("body")).toContainText("This route is clear to ship.");
  await expect(page.locator("body")).toContainText("bravo/overview loaded 1x.");
  await expect(page).toHaveURL(/projects\/bravo\?tab=overview$/);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator("body")).toContainText("Escalation is still blocking launch.");
  await expect(page.locator("body")).toContainText("alpha/overview loaded 1x.");
  await expect(page).toHaveURL(/projects\/alpha\?tab=overview$/);

  await page.getByRole("button", { name: "Invalidate cache" }).click();
  await expect(page.locator("body")).toContainText("alpha/overview marked stale.");
  await page.getByRole("button", { name: "Reload view" }).click();
  await expect(page.locator("body")).toContainText("alpha/overview loaded 2x.");
});
