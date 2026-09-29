import { test, expect } from '@playwright/test';

test('reviewed formulas render with the bundled math library and stay inside the card', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('./#view=study&node=c9-shm&tab=understand');
  const formula = page.locator('.node-detail .formula');
  await expect(formula.locator('.katex')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('link[href="./assets/vendor/katex/katex.min.css"]')).toHaveCount(1);
});
