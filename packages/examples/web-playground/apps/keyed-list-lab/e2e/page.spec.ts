import { expect, test } from "@playwright/test";

test("keyed-list-lab reconciles authored list templates in the browser", async ({ page }) => {
  await page.goto("/apps/keyed-list-lab/dist/");
  await expect(page.locator("body")).toContainText("Keyed List Lab");
  await expect(page.locator(".keyed-row__label")).toHaveText(["Alpha", "Bravo", "Charlie"]);

  await page.evaluate(() => {
    (globalThis as typeof globalThis & {
      __JUE_KEYED_LIST_LAB__?: { applyScenario(name: "reordered"): void };
    }).__JUE_KEYED_LIST_LAB__?.applyScenario("reordered");
  });
  await expect(page.locator(".keyed-row__label")).toHaveText(["Bravo", "Delta", "Alpha"]);

  await page.evaluate(() => {
    (globalThis as typeof globalThis & {
      __JUE_KEYED_LIST_LAB__?: { applyScenario(name: "trimmed"): void };
    }).__JUE_KEYED_LIST_LAB__?.applyScenario("trimmed");
  });
  await expect(page.locator(".keyed-row__label")).toHaveText(["Delta"]);
});
