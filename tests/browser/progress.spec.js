import { test, expect } from '@playwright/test';
import { routes, nodes } from '../../dist/assets/data/physics-data.js';

test('self-rating does not move a freely explored node into the default route', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '完整图谱' }).first().click();
  const target = nodes.find((node) => node.chapterId === 'ch-16' && node.title.includes('原子核基本性质'));
  await page.getByRole('searchbox', { name: '搜索概念、公式或关键词' }).fill(target.title);
  await expect(page.locator('#detail-content h2')).toHaveText(target.title);
  await page.getByRole('button', { name: /标记掌握/ }).click();
  await expect(page.locator('#detail-content h2')).toHaveText(target.title);
  await expect(page.locator('#progress-message')).not.toContainText('路线完成');
});

test('the last station alone does not complete a route', async ({ page }) => {
  const last = routes[0].nodeIds.at(-1);
  await page.goto(`./#view=study&node=${last}`);
  await expect(page.locator('#detail-content h2')).toHaveText(nodes.find((node) => node.id === last).title);
  await page.getByRole('button', { name: /标记掌握/ }).click();
  await expect(page.locator('#progress-summary')).toContainText(`1 / ${routes[0].nodeIds.length}`);
  await expect(page.locator('#progress-message')).not.toContainText('路线完成');
});

test('storage failure tells the learner that progress is temporary', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('physics-atlas')) throw new Error('quota');
      return original.call(this, key, value);
    };
  });
  await page.goto('./');
  await page.getByRole('button', { name: /标记掌握/ }).click();
  await expect(page.locator('#progress-message')).toContainText('本次打开期间');
  await expect(page.getByRole('button', { name: '导出学习进度' })).toBeVisible();
});
