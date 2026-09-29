import { test, expect } from '@playwright/test';
import { nodes } from '../../dist/assets/data/physics-data.js';

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
