import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBackupJson, previewBackup } from '../dist/assets/learning-backup.js';
import { createProgressStore } from '../dist/assets/study.js';
import { createPracticeStore } from '../dist/assets/practice.js';
import { questions } from '../dist/assets/data/practice-data.js';

const knownNodes = new Set(['c9-shm']);
const knownQuestions = new Set(questions.map((question) => question.id));

test('v2 backup includes assessment and question evidence, with an explicit export time', () => {
  const progress = createProgressStore(null);
  const practice = createPracticeStore(null);
  progress.setStatus('c9-shm', 'review');
  practice.submit(questions.find((question) => question.id === 'c9-shm-concept'), 'a', new Date('2026-09-29T08:00:00Z'));
  const serialized = exportBackupJson(progress, practice, new Date('2026-09-29T09:00:00Z'));
  const bundle = JSON.parse(serialized);
  assert.equal(bundle.schemaVersion, 2);
  assert.equal(bundle.exportedAt, '2026-09-29T09:00:00.000Z');
  assert.equal(bundle.selfAssessment.progress['c9-shm'], 'review');
  assert.equal(bundle.practice.records['c9-shm-concept@1'].passed, true);
  assert.equal(previewBackup(serialized, { progress, practice, knownNodes, knownQuestions }).version, 2);
});

test('legacy v1 backup remains importable without claiming question passes', () => {
  const progress = createProgressStore(null);
  const practice = createPracticeStore(null);
  const preview = previewBackup('{"version":1,"progress":{"c9-shm":"mastered"}}', { progress, practice, knownNodes, knownQuestions });
  assert.equal(preview.version, 1);
  assert.equal(preview.practice, null);
});

test('unknown schemas and node identifiers are rejected before any writes', () => {
  const progress = createProgressStore(null);
  const practice = createPracticeStore(null);
  assert.throws(() => previewBackup('{"schemaVersion":3}', { progress, practice, knownNodes, knownQuestions }), /不支持的进度文件版本/);
  assert.throws(() => previewBackup('{"version":1,"progress":{"foreign":"mastered"}}', { progress, practice, knownNodes, knownQuestions }), /foreign/);
});

test('backup preview reports self assessment and practice additions and conflicts separately', () => {
  const progress = createProgressStore(null), practice = createPracticeStore(null);
  progress.setStatus('c9-shm', 'mastered');
  const q = questions.find((question) => question.id === 'c9-shm-concept');
  practice.submit(q, q.answer);
  const incomingProgress = createProgressStore(null), incomingPractice = createPracticeStore(null);
  incomingProgress.setStatus('c9-shm', 'review');
  incomingPractice.submit(q, 'wrong');
  const preview = previewBackup(exportBackupJson(incomingProgress, incomingPractice), { progress, practice, knownNodes, knownQuestions });
  assert.equal(preview.progress.added, 0);
  assert.equal(preview.progress.conflicts, 1);
  assert.equal(preview.practice.added, 0);
  assert.equal(preview.practice.conflicts, 1);
  assert.equal(preview.practice.imported, 1);
});
