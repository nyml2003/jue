import { expect, test } from "@playwright/test";

test("virtual-list-lab updates the window while reusing DOM cells", async ({ page }) => {
  await page.goto("/apps/virtual-list-lab/dist/");
  await expect(page.locator("body")).toContainText("Virtual List Lab");
  await expect(page.locator(".virtual-row__label")).toHaveText(["Row 0", "Row 1", "Row 2", "Row 3", "Row 4"]);
  expect(await page.locator(".virtual-row").evaluateAll(rows => rows.map(row => row.getAttribute("data-reuse-id"))))
    .toEqual(["0", "1", "2", "3", "4"]);

  await page.locator(".virtual-lab-viewport").evaluate(node => {
    const viewport = node as HTMLElement;
    viewport.scrollTop = 48 * 4;
    viewport.dispatchEvent(new Event("scroll"));
  });

  await expect(page.locator(".virtual-row__label")).toHaveText(["Row 3", "Row 4", "Row 5", "Row 6", "Row 7"]);
  expect(await page.locator(".virtual-row").evaluateAll(rows => rows.map(row => row.getAttribute("data-reuse-id"))))
    .toEqual(["0", "1", "2", "3", "4"]);
});
