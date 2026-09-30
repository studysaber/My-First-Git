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

for (const view of ['chapter', 'guide']) {
  for (const width of [1440, 320]) {
    test(`directory selection leaves ${view} for visible reading at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`./#view=${view}&node=c9-simple-pendulum&tab=understand`);
      if (width === 320) await page.getByRole('button', { name: '学习目录', exact: true }).click();
      await page.locator('[data-directory-node="c9-physical-pendulum"]').click();
      await expect(page.locator('.node-detail h2')).toHaveText('复摆的小振动');
      await expect(page.locator('.node-detail h2')).toBeVisible();
      await expect(page.locator('.node-detail h2')).toBeFocused();
      await expect(page).toHaveURL(/view=study/);
      await expect(page).toHaveURL(/node=c9-physical-pendulum/);
      await expect(page).toHaveURL(/tab=understand/);
      if (width === 320) {
        await expect(page.getByRole('button', { name: '学习目录', exact: true })).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('.node-detail h2')).toBeInViewport();
      }
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`view=${view}`));
    });
  }
}

for (const width of [320, 390]) {
  test(`brand and source links have actual 44px targets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./#view=study&node=c9-shm&tab=understand');
    for (const link of [page.locator('.brand'), page.locator('[data-detail-kind="source"] a').first()]) {
      const box = await link.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('experiment footer is fully in the first desktop viewport and supplementary state is disclosed', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
  await page.evaluate(() => document.fonts.ready);
  for (const action of [page.locator('.mastery-actions'), page.locator('.start-practice')]) {
    const box = await action.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(1024);
  }
  await expect(page.locator('.period-readout')).toBeVisible();
  await expect(page.locator('.simulation-result')).not.toBeVisible();
  const state = page.locator('.simulation-state');
  await expect(state).not.toHaveAttribute('open', '');
  await state.locator('summary').click();
  await expect(page.locator('.simulation-result')).toBeVisible();
  await expect(page.locator('.simulation-result')).toContainText('周期 T');
  await expect(page.locator('[data-param="length"]')).toBeVisible();
  await expect(page.locator('[data-param="gravity"]')).toBeVisible();
});

for (const [view, width] of [['study', 320], ['graph', 320], ['graph', 1024]]) {
  test(`equation stays intact with local scrolling in ${view} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`./#view=${view}&node=c9-shm&tab=understand`);
    const formula = page.locator('.node-detail .formula');
    await expect(formula.locator('.katex-html')).toBeVisible();
    const bounds = await formula.evaluate(element => {
      const html = element.querySelector('.katex-html');
      const fragments = [...html.children].filter(child => child.classList.contains('base')).flatMap(child => [...child.getClientRects()]);
      return { tops: fragments.map(box => box.top), scroll: element.scrollWidth, width: element.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(Math.max(...bounds.tops) - Math.min(...bounds.tops)).toBeLessThan(2);
    expect(bounds.scroll).toBeGreaterThan(bounds.width);
    expect(bounds.overflow).toBe(false);
    await formula.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    expect(await formula.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  });
}
