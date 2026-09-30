import { test, expect } from '@playwright/test';
import { chapterStudyPaths, nodes } from '../../dist/assets/data/physics-data.js';

test('a link to a knowledge point survives refresh', async ({ page }) => {
  const node = nodes.find((item) => item.id === 'c9-simple-pendulum') ?? nodes[0];
  await page.goto(`./#view=study&node=${node.id}&tab=experiment`);
  await expect(page.locator('#detail-content h2')).toHaveText(node.title);
  await expect(page.getByRole('tab', { name: '实验' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.locator('#detail-content h2')).toHaveText(node.title);
});

test('selection updates the URL and browser history restores the prior node', async ({ page }) => {
  await page.goto('./');
  const first = await page.locator('#detail-content h2').textContent();
  await page.getByRole('searchbox', { name: '搜索概念、公式或关键词' }).fill('光电效应');
  await expect(page.locator('#detail-content h2')).toContainText('光电效应');
  await expect(page).toHaveURL(/node=/);
  await page.goBack();
  await expect(page.locator('#detail-content h2')).toHaveText(first);
});

test('a full-graph experiment link survives refresh', async ({ page }) => {
  await page.goto('./#view=graph&node=c9-simple-pendulum&tab=experiment');
  await expect(page.locator('#detail-content h2')).toContainText('单摆');
  await expect(page.getByRole('tab', { name: '实验' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('tab', { name: '实验' })).toHaveAttribute('aria-selected', 'true');
});

test('a selected chapter survives a refresh and browser history', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '章节地图', exact: true }).click();
  await page.getByRole('combobox', { name: '选择章节' }).selectOption('ch-16');
  await expect(page.locator('#chapter-view-title')).toContainText('粒子');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '选择章节' })).toHaveValue('ch-16');
  await expect(page.locator('#chapter-view-title')).toContainText('粒子');
});

test('chapter core links continue in that chapter’s own study order', async ({ page }) => {
  const coreIds = chapterStudyPaths['ch-13'].filter((id) => nodes.find((node) => node.id === id)?.level === 'core');
  await page.goto('./#view=chapter&chapter=ch-13');
  await page.locator('[aria-labelledby="chapter-route-title"] .chapter-node-link').first().click();
  await page.locator('.route-disclosure > summary').click();
  await expect(page.getByRole('combobox', { name: '选择学习路线' })).toHaveValue('chapter-ch-13');
  await expect(page.locator('#detail-content h2')).toHaveText(nodes.find((node) => node.id === coreIds[0]).title);
  await page.getByRole('button', { name: /下一节/ }).click();
  await expect(page.locator('#detail-content h2')).toHaveText(nodes.find((node) => node.id === coreIds[1]).title);
  await page.reload();
  await page.locator('.route-disclosure > summary').click();
  await expect(page.getByRole('combobox', { name: '选择学习路线' })).toHaveValue('chapter-ch-13');
});
