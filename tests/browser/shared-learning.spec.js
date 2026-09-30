import { test, expect } from '@playwright/test';

test('two open pages retain both questions and self assessment and reflect remote saves without refresh', async ({ page, context }) => {
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const other = await context.newPage();
  await other.goto('./#view=study&node=c9-shm&tab=practice');
  const concept = page.locator('[data-question-id="c9-shm-concept"]');
  const remoteConcept = other.locator('[data-question-id="c9-shm-concept"]');
  const numeric = other.locator('[data-question-id="c9-shm-numeric"]');
  await numeric.getByLabel('数值').fill('0.2');
  await numeric.getByLabel('单位').fill('m/s');
  await concept.getByLabel('速率最大，加速度为零').check();
  await concept.getByRole('button', { name: '提交答案' }).click();
  await expect(remoteConcept.getByRole('status')).toContainText('回答正确');
  await expect(numeric.getByLabel('数值')).toHaveValue('0.2');
  await expect(numeric.getByLabel('单位')).toHaveValue('m/s');
  await Promise.all([
    numeric.getByRole('button', { name: '提交答案' }).click(),
    page.getByRole('button', { name: '标记掌握（自评）' }).click(),
  ]);
  await expect(page.locator('[data-question-id="c9-shm-numeric"] .practice-record')).toContainText('已通过');
  await expect(other.locator('#progress-feedback')).toContainText('已自评掌握');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('physics-atlas-learning-v2')));
  expect(Object.keys(JSON.parse(saved.practiceRaw).records)).toHaveLength(2);
  expect(JSON.parse(saved.progressRaw).progress['c9-shm']).toBe('mastered');
});

test('mutations read current records only after a held browser lock is granted', async ({ page, context }) => {
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const other = await context.newPage();
  await other.goto('./#view=study&node=c9-shm&tab=practice');
  await other.evaluate(() => {
    window.lockHeld = false;
    navigator.locks.request('physics-atlas-learning-v2', () => new Promise((resolve) => {
      window.releaseLearningLock = resolve;
      window.lockHeld = true;
    }));
  });
  await expect.poll(() => other.evaluate(() => window.lockHeld)).toBe(true);
  const q = page.locator('[data-question-id="c9-shm-concept"]');
  await q.getByLabel('速率最大，加速度为零').check();
  await q.getByRole('button', { name: '提交答案' }).click();
  expect(await page.evaluate(() => localStorage.getItem('physics-atlas-learning-v2'))).toBeNull();
  await other.evaluate(async () => {
    const { createLearningStorage } = await import('./assets/learning-storage.js');
    const { createPracticeStore } = await import('./assets/practice.js');
    const { createProgressStore } = await import('./assets/study.js');
    const { questions } = await import('./assets/data/practice-data.js');
    const adapter = createLearningStorage(localStorage);
    createPracticeStore(adapter.storage).submit(questions[1], { value: 0.2, unit: 'm/s' });
    createProgressStore(adapter.storage).setStatus('c9-shm', 'review');
    window.releaseLearningLock();
  });
  await expect(q.getByRole('status')).toContainText('回答正确');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('physics-atlas-learning-v2')));
  expect(Object.keys(JSON.parse(saved.practiceRaw).records)).toHaveLength(2);
  expect(JSON.parse(saved.progressRaw).progress['c9-shm']).toBe('review');
});
