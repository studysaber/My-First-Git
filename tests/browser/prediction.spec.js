import { test, expect } from '@playwright/test';

test('pendulum experiment asks for a prediction and explains the observed trend', async ({ page }) => {
  await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
  const prompt = page.locator('[data-prediction-id="pendulum"]');
  await expect(prompt).toContainText('0.5 m 增至 2.0 m');
  await prompt.getByLabel('变为两倍').check();
  await prompt.getByRole('button', { name: '记录预测' }).click();
  await expect(prompt.getByRole('status')).toContainText('预测正确');
  await expect(prompt.getByRole('status')).toContainText('T∝√ℓ');
  await expect(page.locator('.simulation-card')).toBeVisible();
});
