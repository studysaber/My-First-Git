import { test, expect } from '@playwright/test';

test('mobile opens on the current knowledge point without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const heading = page.locator('#detail-content h2');
  await expect(heading).toBeInViewport();
  await expect(page.locator('.detail-summary')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a shared experiment link keeps the lab wider than the route sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
  await expect(page.locator('.view-status')).toContainText('速学路线');
  const graph = await page.locator('.graph-panel').boundingBox();
  const detail = await page.locator('.detail-panel').boundingBox();
  expect(detail.width).toBeGreaterThan(graph.width * 1.7);
  await expect(page.locator('.simulation-card')).toBeVisible();
});
