import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningStorage, learningStorageKey } from '../dist/assets/learning-storage.js';

class StorageStub {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = []; this.fail = false; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.fail) throw new Error('quota');
    this.values.set(key, value);
    this.writes.push(key);
  }
  removeItem(key) { this.values.delete(key); }
}

test('legacy keys migrate into one canonical record without deleting old backups', () => {
  const oldProgress = '{"version":1,"progress":{"c9-shm":"review"}}';
  const oldPractice = '{"schemaVersion":2,"records":{}}';
  const native = new StorageStub({
    'physics-atlas-progress-v1': oldProgress,
    'physics-atlas-practice-v2': oldPractice,
  });
  const adapter = createLearningStorage(native);
  assert.equal(adapter.storage.getItem('physics-atlas-progress-v1'), oldProgress);
  adapter.storage.setItem('physics-atlas-progress-v1', '{"version":1,"progress":{"c9-shm":"mastered"}}');
  assert.deepEqual(native.writes, [learningStorageKey]);
  assert.equal(native.getItem('physics-atlas-progress-v1'), oldProgress);
  assert.equal(JSON.parse(native.getItem(learningStorageKey)).practiceRaw, oldPractice);
});

test('transaction writes both components once or leaves prior state untouched', () => {
  const native = new StorageStub();
  const adapter = createLearningStorage(native);
  adapter.beginTransaction();
  adapter.storage.setItem('physics-atlas-progress-v1', 'progress-next');
  adapter.storage.setItem('physics-atlas-practice-v2', 'practice-next');
  assert.equal(native.writes.length, 0);
  adapter.commitTransaction();
  assert.deepEqual(native.writes, [learningStorageKey]);
  assert.equal(adapter.storage.getItem('physics-atlas-practice-v2'), 'practice-next');

  adapter.beginTransaction();
  adapter.storage.setItem('physics-atlas-progress-v1', 'bad-next');
  native.fail = true;
  assert.throws(() => adapter.commitTransaction(), /quota/);
  assert.equal(adapter.storage.getItem('physics-atlas-progress-v1'), 'progress-next');
  assert.equal(JSON.parse(native.getItem(learningStorageKey)).progressRaw, 'progress-next');
});

test('damaged canonical record is never overwritten by a new session', () => {
  const native = new StorageStub({ [learningStorageKey]: '{broken' });
  const adapter = createLearningStorage(native);
  assert.equal(adapter.storage, null);
  assert.equal(adapter.state, 'damaged');
  assert.equal(native.getItem(learningStorageKey), '{broken');
});
