import { test, expect } from '@playwright/test';

async function dragAndMeasure(page, view, zoomClicks) {
  await page.getByRole('button', { name: view, exact: true }).click();
  for (let index = 0; index < zoomClicks; index += 1) await page.getByRole('button', { name: '放大图谱' }).click();
  const node = page.locator('.graph-node').first();
  const before = await node.boundingBox();
  const canvas = await page.locator('.graph-canvas').boundingBox();
  await page.mouse.move(canvas.x + 20, canvas.y + 20);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 60, canvas.y + 20);
  await page.mouse.up();
  const after = await node.boundingBox();
  expect(Math.abs((after.x - before.x) - 40)).toBeLessThanOrEqual(2);
}

test('40 px graph drag moves nodes 40 px in the expanded graph at two zoom levels', async ({ page }) => {
  await page.goto('./');
  for (const view of ['完整图谱']) {
    for (const zoomClicks of [0, 3]) {
      await page.reload();
      await dragAndMeasure(page, view, zoomClicks);
    }
  }
});

test('graph labels select nodes, keyboard focus survives selection, and empty filters recover', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '完整图谱', exact: true }).click();
  const label = page.locator('.graph-node-title:visible').nth(1);
  const clickedId = await label.locator('xpath=..').getAttribute('data-node-id');
  await label.click();
  await expect(page.locator(`.graph-node[data-node-id="${clickedId}"]`)).toHaveClass(/is-selected/);
  const node = page.locator('.graph-node').nth(2);
  const id = await node.getAttribute('data-node-id');
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`.graph-node[data-node-id="${id}"]`)).toHaveClass(/is-selected/);
  await expect(page.locator('.detail-content h2:focus')).toHaveCount(1);
  await page.getByText('高级筛选', { exact: true }).click();
  await page.getByLabel('按知识类型筛选').selectOption('instrument');
  await page.getByLabel('按学习进度筛选').selectOption('mastered');
  await expect(page.getByRole('button', { name: '清除筛选' })).toBeVisible();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('.graph-node').first()).toBeVisible();
});

test('overview limits visible labels and selected label remains screen readable', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '完整图谱', exact: true }).click();
  const labels = page.locator('.graph-node-title:visible');
  expect(await labels.count()).toBeLessThan(20);
  const selected = page.locator('.graph-node.is-selected .graph-node-title');
  const size = await selected.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.height;
  });
  expect(size).toBeGreaterThanOrEqual(14);
});

test('mobile graph nodes retain a 44 px touch target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#view=graph&node=c9-shm');
  const hit = page.locator('.graph-node.is-selected .graph-node-hit');
  const box = await hit.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('guided route labels form a readable non-overlapping sequence on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: '学习目录', exact: true }).click();
  const labels = page.locator('.directory-chapter[open] li button');
  const boxes = await labels.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: box.height };
  }));
  expect(boxes.length).toBeGreaterThan(2);
  expect(boxes.every((box) => box.height >= 44)).toBe(true);
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].top).toBeGreaterThanOrEqual(boxes[index - 1].bottom);
  }
});

test('full graph chapter headings do not collide in the study workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await page.getByRole('button', { name: '完整图谱', exact: true }).click();
  const first = await page.locator('.chapter-title').nth(0).boundingBox();
  const second = await page.locator('.chapter-title').nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(first.x + first.width + 8).toBeLessThan(second.x);
});

test('full graph reflows from two chapter columns to one after resizing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#view=graph&node=c9-shm');
  await expect(page.locator('.route-graph')).toHaveAttribute('viewBox', /^0 0 896 /);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.route-graph')).toHaveAttribute('viewBox', /^0 0 466 /);
  const first = await page.locator('.chapter-title').nth(0).boundingBox();
  const second = await page.locator('.chapter-title').nth(1).boundingBox();
  expect(second.y).toBeGreaterThan(first.y + first.height);
});

test('chapter overview opens the chapter and fits its nodes', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '完整图谱', exact: true }).click();
  const chapter = page.locator('.chapter-cluster').first();
  await chapter.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('按章节筛选')).toHaveValue('ch-9');
  await expect(page.locator('.graph-node[data-chapter-id="ch-10"]')).toHaveCount(0);
});
