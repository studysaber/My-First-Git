import { test, expect } from '@playwright/test';

test('a learner can answer a concept question and see its result after refresh', async ({ page }) => {
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  await expect(page.getByRole('tab', { name: '练习' })).toHaveAttribute('aria-selected', 'true');
  const question = page.locator('[data-question-id="c9-shm-concept"]');
  await expect(question).toContainText('经过平衡位置');
  await question.getByLabel('速率最大，加速度为零').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await expect(question.getByRole('status')).toContainText('回答正确');
  await page.reload();
  await expect(page.locator('[data-question-id="c9-shm-concept"]')).toContainText('已通过');
});

test('a numeric answer with the wrong unit receives a useful correction', async ({ page }) => {
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const question = page.locator('[data-question-id="c9-shm-numeric"]');
  await question.getByLabel('数值').fill('0.2');
  await question.getByLabel('单位').fill('s');
  await question.getByRole('button', { name: '提交答案' }).click();
  await expect(question.getByRole('status')).toContainText('单位应为 m/s');
});
