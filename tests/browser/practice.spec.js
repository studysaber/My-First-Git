import { test, expect } from '@playwright/test';

test('a late chapter practice answer works by keyboard and survives refresh', async ({ page }) => {
  await page.goto('./#view=study&node=c16-standard-model&tab=practice');
  const question = page.locator('[data-question-id="c16-standard-model-concept"]');
  await expect(question).toContainText('标准模型');
  const choice = question.getByRole('radio', { name: '强、电磁、弱；未纳入量子引力' });
  await choice.focus();
  await page.keyboard.press('Space');
  await expect(choice).toBeChecked();
  await question.getByRole('button', { name: '提交答案' }).focus();
  await page.keyboard.press('Enter');
  await expect(question.getByRole('status')).toContainText('回答正确');
  await page.reload();
  await expect(page.locator('[data-question-id="c16-standard-model-concept"]')).toContainText('已通过');
});
