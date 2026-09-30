import { test, expect } from '@playwright/test';

test('reading directory replaces the tall route diagram and tasks follow the concept', async ({ page }) => {
  await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
  await expect(page.getByRole('navigation', { name: '学习目录' })).toBeVisible();
  await expect(page.locator('.reading-directory li button').first()).toBeVisible();
  await expect(page.locator('.route-only-graph')).not.toBeVisible();
  const title = await page.locator('.node-detail h2').boundingBox();
  const tabs = await page.getByRole('tablist').boundingBox();
  expect(tabs.y).toBeGreaterThan(title.y + title.height);
  await expect(page.locator('#advanced-filters')).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: '完整图谱', exact: true }).click();
  await expect(page.locator('.graph-canvas')).toBeVisible();
});

for (const width of [390, 320]) {
  test(`directory disclosure selects a full title and returns focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
    const toggle = page.getByRole('button', { name: '学习目录', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.node-detail h2')).toBeInViewport();
    await toggle.click();
    const item = page.locator('.reading-directory button[data-directory-node="c9-physical-pendulum"]');
    await expect(item).toHaveText('复摆的小振动');
    const box = await item.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await item.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.node-detail h2')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('learning progress disclosure reveals clipboard fallback', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
  await expect(page.locator('#learning-progress')).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: '分享此处' }).click();
  await expect(page.locator('#learning-progress')).toHaveAttribute('open', '');
  await expect(page.getByLabel('复制此链接')).toBeVisible();
});
