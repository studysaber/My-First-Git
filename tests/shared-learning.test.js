import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningStorage, learningStorageKey } from '../dist/assets/learning-storage.js';
import { createPracticeStore } from '../dist/assets/practice.js';
import { createProgressStore } from '../dist/assets/study.js';
import { questions } from '../dist/assets/data/practice-data.js';

const progressKey = 'physics-atlas-progress-v1';
const practiceKey = 'physics-atlas-practice-v2';
const q1 = questions.find((q) => q.id === 'c9-shm-concept');
const q2 = questions.find((q) => q.kind === 'concept' && q.id !== q1.id);

class SharedStorage {
  values = new Map();
  fail = false;
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw Error('quota'); this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('a self-assessment from an older adapter retains another tab’s answer', () => {
  const native = new SharedStorage();
  const a = createLearningStorage(native), b = createLearningStorage(native);
  const pa = createPracticeStore(a.storage), pb = createPracticeStore(b.storage);
  pb.submit(q1, q1.answer);
  createProgressStore(a.storage).setStatus('c9-shm', 'mastered');
  assert.equal(createPracticeStore(createLearningStorage(native).storage).getRecord(q1)?.passed, true);
  pa.submit(q2, q2.answer);
  const fresh = createPracticeStore(createLearningStorage(native).storage);
  assert.equal(fresh.getRecord(q1)?.attempts, 1);
  assert.equal(fresh.getRecord(q2)?.attempts, 1);
});

test('older practice stores read latest answers before duplicate submit and beginAttempt', () => {
  const native = new SharedStorage();
  const a = createPracticeStore(createLearningStorage(native).storage);
  const b = createPracticeStore(createLearningStorage(native).storage);
  b.submit(q1, q1.answer);
  assert.equal(a.submit(q1, 'wrong').recorded, false);
  a.beginAttempt(q1);
  assert.equal(b.submit(q1, q1.answer).record.attempts, 2);
  assert.equal(a.getAll()[`${q1.id}@1`].attempts, 2);
});

test('stale field snapshots merge independent entries but reject changed same entries', () => {
  const native = new SharedStorage();
  const seed = createLearningStorage(native);
  seed.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'new' } }));
  const a = createLearningStorage(native), b = createLearningStorage(native);
  b.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'mastered', b: 'review' } }));
  a.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'new', c: 'review' } }));
  assert.deepEqual(JSON.parse(createLearningStorage(native).storage.getItem(progressKey)).progress,
    { a: 'mastered', b: 'review', c: 'review' });
  const stale = createLearningStorage(native), other = createLearningStorage(native);
  other.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'review', b: 'review', c: 'review' } }));
  const before = native.getItem(learningStorageKey);
  assert.throws(() => stale.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'new', b: 'review', c: 'review' } })), /同时|冲突|刷新/);
  assert.equal(native.getItem(learningStorageKey), before);
});

test('transaction commit validates its starting entries and does not partially commit on conflict', () => {
  const native = new SharedStorage();
  const a = createLearningStorage(native), b = createLearningStorage(native);
  a.beginTransaction();
  a.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'mastered' } }));
  a.storage.setItem(practiceKey, JSON.stringify({ schemaVersion: 2, records: { local: 1 } }));
  b.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'review' } }));
  const before = native.getItem(learningStorageKey);
  assert.throws(() => a.commitTransaction(), /同时|冲突|刷新/);
  assert.equal(native.getItem(learningStorageKey), before);
  assert.equal(createLearningStorage(native).storage.getItem(practiceKey), null);
});

test('transaction merges untouched fields and independent entries from newer writes', () => {
  const native = new SharedStorage();
  const a = createLearningStorage(native), b = createLearningStorage(native);
  a.beginTransaction();
  a.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { a: 'mastered' } }));
  b.storage.setItem(progressKey, JSON.stringify({ version: 1, progress: { b: 'review' } }));
  createPracticeStore(b.storage).submit(q1, q1.answer);
  a.commitTransaction();
  assert.deepEqual(JSON.parse(a.storage.getItem(progressKey)).progress, { b: 'review', a: 'mastered' });
  assert.equal(createPracticeStore(a.storage).getRecord(q1).passed, true);
});

test('fresh canonical damage blocks writes and leaves temporary practice exportable', () => {
  const native = new SharedStorage();
  const adapter = createLearningStorage(native);
  const practice = createPracticeStore(adapter.storage);
  native.setItem(learningStorageKey, '{broken');
  assert.throws(() => adapter.storage.setItem(progressKey, '{}'), /损坏|刷新|读取/);
  practice.submit(q1, q1.answer);
  assert.equal(practice.getRecord(q1).passed, true);
  assert.equal(practice.getPersistenceState(), 'memory');
  assert.equal(native.getItem(learningStorageKey), '{broken');
});

test('refresh preserves quota-failed temporary answers while another tab adds records', () => {
  const native = new SharedStorage();
  const a = createPracticeStore(createLearningStorage(native).storage);
  native.fail = true;
  a.submit(q1, q1.answer);
  native.fail = false;
  createPracticeStore(createLearningStorage(native).storage).submit(q2, q2.answer);
  a.refresh();
  assert.equal(a.getRecord(q1).passed, true);
  assert.equal(a.getRecord(q2).passed, true);
  assert.equal(a.getPersistenceState(), 'memory');
  assert.equal(createPracticeStore(createLearningStorage(native).storage).getRecord(q1), null);
});
