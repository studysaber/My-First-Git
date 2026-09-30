import { test, expect } from '@playwright/test';

test('retry hides the old explanation and distinguishes historical pass from latest error', async ({ page }) => {
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const question = page.locator('[data-question-id="c9-shm-concept"]');
  await question.getByLabel('速率最大，加速度为零').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await expect(question.getByRole('status')).toContainText('回答正确');
  await question.getByRole('button', { name: '再试一次' }).click();
  await expect(question.getByRole('status')).toBeEmpty();
  await question.getByLabel('两者都最大').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await expect(question.locator('.practice-record')).toContainText('曾通过 · 本次错误 · 待复习');
  await expect(page.locator('#progress-summary')).toContainText('历史练习通过 1 /');
});

test('today queue opens the exact question for an independent attempt and removes a corrected answer', async ({ page }) => {
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  const question = page.locator('[data-question-id="c9-shm-concept"]');
  await question.getByLabel('两者都最大').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await page.getByRole('button', { name: /今日复习/ }).click();
  const item = page.locator('.review-queue [data-review-question-id="c9-shm-concept"]');
  await expect(item).toContainText('简谐运动');
  await expect(item).toContainText('本次错误');
  await expect(item.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await item.getByRole('button', { name: '开始复习' }).click();
  await expect(page.getByRole('tab', { name: '练习' })).toHaveAttribute('aria-selected', 'true');
  await expect(question.getByRole('status')).toBeEmpty();
  await expect(question.locator('h3')).toBeFocused();
  await question.getByLabel('速率最大，加速度为零').check();
  await question.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('button', { name: /今日复习/ })).toContainText('0');
  await expect(page.locator('.review-queue')).not.toContainText('开始复习');
});

test('review queue ignores obsolete versions and sorts due dates, updating on a new local day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T12:00:00') });
  await page.goto('./#view=study&node=c9-shm&tab=practice');
  await page.evaluate(async () => {
    const { createPracticeStore } = await import('./assets/practice.js');
    const { questions } = await import('./assets/data/practice-data.js');
    const practice = createPracticeStore(localStorage);
    practice.submit(questions[0], questions[0].answer, new Date('2026-09-30T12:00:00'));
    practice.submit(questions[1], {}, new Date('2026-09-29T12:00:00'));
    practice.submit({ ...questions[0], version: 99 }, 'wrong', new Date('2026-09-28T12:00:00'));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /今日复习/ })).toContainText('1');
  await page.clock.fastForward(86400000);
  await expect(page.getByRole('button', { name: /今日复习/ })).toContainText('2');
  await page.getByRole('button', { name: /今日复习/ }).click();
  const entries = page.locator('.review-queue [data-review-question-id]');
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toHaveAttribute('data-review-question-id', 'c9-shm-numeric');
});

test('detail tabs support arrow, Home and End keyboard navigation', async ({ page }) => {
  await page.goto('./#view=study&node=c9-shm&tab=understand');
  await page.getByRole('tab', { name: '理解' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '知识关系' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: '练习' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '练习' })).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: '理解' })).toBeFocused();
});
