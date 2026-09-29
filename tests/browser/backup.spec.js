import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('v2 export and import preserve self-rating and answered-question evidence', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const question = page.locator('[data-question-id="c9-shm-concept"]');
  await question.getByLabel('速率最大，加速度为零').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await page.getByRole('button', { name: '标记掌握（自评）' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出学习进度' }).click();
  const download = await downloadPromise;
  const bundle = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(bundle.schemaVersion).toBe(2);
  expect(bundle.selfAssessment.progress['c9-shm']).toBe('mastered');
  expect(bundle.practice.records['c9-shm-concept@1'].passed).toBe(true);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-question-id="c9-shm-concept"]')).not.toContainText('已通过');
  await page.locator('#progress-import').setInputFiles({
    name: 'learning-v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.locator('[data-question-id="c9-shm-concept"]')).toContainText('已通过');
  await expect(page.locator('#progress-summary')).toContainText('自评掌握 1 /');
});

test('legacy v1 import changes self-rating only and leaves practice evidence intact', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const question = page.locator('[data-question-id="c9-shm-concept"]');
  await question.getByLabel('速率最大，加速度为零').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await page.locator('#progress-import').setInputFiles({
    name: 'old-progress.json', mimeType: 'application/json',
    buffer: Buffer.from('{"version":1,"progress":{"c9-shm":"review"}}'),
  });
  await expect(question).toContainText('已通过');
  await expect(page.locator('#progress-feedback')).toContainText('待复习');
});

test('a rollback to the old site can edit self-rating without losing later v2 practice', async ({ page }) => {
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const question = page.locator('[data-question-id="c9-shm-concept"]');
  await question.getByLabel('速率最大，加速度为零').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await page.getByRole('button', { name: '标记掌握（自评）' }).click();
  const oldSiteRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('physics-atlas-progress-v1')));
  expect(oldSiteRecord.progress['c9-shm']).toBe('mastered');
  await page.evaluate(() => localStorage.setItem('physics-atlas-progress-v1', '{"version":1,"progress":{"c9-shm":"review"}}'));
  await page.reload();
  await expect(page.locator('#progress-feedback')).toContainText('待复习');
  await expect(page.locator('[data-question-id="c9-shm-concept"]')).toContainText('已通过');
});
