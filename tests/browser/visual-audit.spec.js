import { test, expect } from '@playwright/test';

for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844], [320, 720]]) {
  test(`learning card stays readable at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#view=study&node=c9-shm&tab=understand');
    await expect(page.locator('.node-detail h2')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`understand-${width}.png`), fullPage: true });
  });
}

for (const [width, height] of [[1440, 1000], [390, 844]]) {
  test(`pendulum lab stays readable at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
    await expect(page.locator('.simulation-card')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`experiment-${width}.png`), fullPage: true });
  });
}

for (const [width, height] of [[1440, 1000], [390, 844]]) {
  test(`full graph overview stays legible at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#view=graph&node=c9-shm');
    await expect(page.locator('.chapter-title').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`graph-${width}.png`), fullPage: true });
  });
}
