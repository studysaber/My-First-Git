import { test, expect } from '@playwright/test';

test('pendulum experiment asks for a prediction and explains the observed trend', async ({ page }) => {
  await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
  await page.locator('.prediction-disclosure > summary').click();
  const prompt = page.locator('[data-prediction-id="pendulum"]');
  await expect(prompt).toContainText('0.5 m 增至 2.0 m');
  await prompt.getByLabel('变为两倍').check();
  await prompt.getByRole('button', { name: '记录预测' }).click();
  await expect(prompt.getByRole('status')).toContainText('预测正确');
  await expect(prompt.getByRole('status')).toContainText('T∝√ℓ');
  await expect(page.locator('.simulation-card')).toBeVisible();
});

test('resetting the simulation preserves an unsubmitted prediction draft', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
  await page.locator('.prediction-disclosure > summary').click();
  const prompt = page.locator('[data-prediction-id="pendulum"]');
  await prompt.getByLabel('变为四倍').check();
  await page.locator('[data-param="length"]').fill('2');
  await page.getByRole('button', { name: '单步 +0.1 s' }).click();
  await expect(page.locator('[data-role="result"]')).toContainText('t = 0.1 s');

  await page.getByRole('button', { name: '重置演示' }).click();

  await expect(prompt).toBeVisible();
  await expect(prompt.getByLabel('变为四倍')).toBeChecked();
  await expect(prompt.getByRole('status')).toBeEmpty();
  await expect(page.locator('[data-param="length"]')).toHaveValue('1');
  await expect(page.locator('[data-role="result"]')).toContainText('t = 0 s');
  await prompt.getByRole('button', { name: '记录预测' }).click();
  await expect(prompt.getByRole('status')).toContainText('预测与模型不符');
});

for (const [choice, feedback] of [['变为两倍', '预测正确'], ['变为四倍', '预测与模型不符']]) {
  test(`resetting the simulation preserves recorded prediction feedback for ${choice}`, async ({ page }) => {
    await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
    await page.locator('.prediction-disclosure > summary').click();
    const prompt = page.locator('[data-prediction-id="pendulum"]');
    await prompt.getByLabel(choice).check();
    await prompt.getByRole('button', { name: '记录预测' }).click();
    await expect(prompt.getByRole('status')).toContainText(feedback);

    for (let reset = 0; reset < 2; reset += 1) {
      await page.getByRole('button', { name: '重置演示' }).click();
      await expect(page.locator('.prediction-disclosure')).toHaveCount(1);
      await expect(prompt).toBeVisible();
      await expect(prompt.getByLabel(choice)).toBeChecked();
      await expect(prompt.getByRole('status')).toContainText(feedback);
      await expect(prompt.getByRole('status')).toContainText('T∝√ℓ');
    }
  });
}
