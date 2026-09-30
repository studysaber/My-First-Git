import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningStorage, learningStorageKey } from '../dist/assets/learning-storage.js';

class StorageStub {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = []; this.fail = false; this.failKey = null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.fail || key === this.failKey) throw new Error('quota');
    this.values.set(key, value);
    this.writes.push(key);
  }
  removeItem(key) { this.values.delete(key); }
}

test('legacy progress remains readable to the old site after a v2 update', () => {
  const oldProgress = '{"version":1,"progress":{"c9-shm":"review"}}';
  const oldPractice = '{"schemaVersion":2,"records":{}}';
  const native = new StorageStub({
    'physics-atlas-progress-v1': oldProgress,
    'physics-atlas-practice-v2': oldPractice,
  });
  const adapter = createLearningStorage(native);
  assert.equal(adapter.storage.getItem('physics-atlas-progress-v1'), oldProgress);
  adapter.storage.setItem('physics-atlas-progress-v1', '{"version":1,"progress":{"c9-shm":"mastered"}}');
  assert.deepEqual(native.writes, [learningStorageKey, 'physics-atlas-progress-v1', learningStorageKey]);
  assert.equal(native.getItem('physics-atlas-progress-v1'), '{"version":1,"progress":{"c9-shm":"mastered"}}');
  assert.equal(JSON.parse(native.getItem(learningStorageKey)).practiceRaw, oldPractice);
});

test('a legacy-site edit after rollback is recovered on the next v2 visit', () => {
  const native = new StorageStub({
    'physics-atlas-progress-v1': '{"version":1,"progress":{"c9-shm":"review"}}',
    'physics-atlas-practice-v2': '{"schemaVersion":2,"records":{"q":1}}',
  });
  const first = createLearningStorage(native);
  first.storage.setItem('physics-atlas-progress-v1', '{"version":1,"progress":{"c9-shm":"mastered"}}');
  native.setItem('physics-atlas-progress-v1', '{"version":1,"progress":{"c9-shm":"review","c10-wave":"review"}}');
  const restored = createLearningStorage(native);
  assert.equal(JSON.parse(restored.storage.getItem('physics-atlas-progress-v1')).progress['c10-wave'], 'review');
  assert.equal(JSON.parse(restored.storage.getItem('physics-atlas-progress-v1')).progress['c9-shm'], 'review');
  assert.equal(restored.storage.getItem('physics-atlas-practice-v2'), '{"schemaVersion":2,"records":{"q":1}}');
  // A visit reconciles the old site's edit for reading; the next exclusive
  // mutation acknowledges it without writing a captured startup envelope.
  assert.notEqual(JSON.parse(native.getItem(learningStorageKey)).progressRaw, native.getItem('physics-atlas-progress-v1'));
  restored.runExclusive(() => restored.storage.setItem('physics-atlas-practice-v2', '{"schemaVersion":2,"records":{"q":1,"next":2}}'));
  assert.equal(JSON.parse(native.getItem(learningStorageKey)).progressRaw, native.getItem('physics-atlas-progress-v1'));
  assert.deepEqual(JSON.parse(restored.storage.getItem('physics-atlas-practice-v2')).records, { q: 1, next: 2 });
});

test('a failed legacy mirror is flagged and retried without losing canonical progress', () => {
  const old = '{"version":1,"progress":{"c9-shm":"review"}}';
  const latest = '{"version":1,"progress":{"c9-shm":"mastered"}}';
  const native = new StorageStub({ 'physics-atlas-progress-v1': old });
  const first = createLearningStorage(native);
  native.failKey = 'physics-atlas-progress-v1';
  first.storage.setItem('physics-atlas-progress-v1', latest);
  assert.equal(first.getLegacySyncState(), 'out-of-sync');
  assert.equal(native.getItem('physics-atlas-progress-v1'), old);
  assert.equal(JSON.parse(native.getItem(learningStorageKey)).progressRaw, latest);
  native.failKey = null;
  const second = createLearningStorage(native);
  assert.equal(second.getLegacySyncState(), 'out-of-sync');
  assert.equal(second.storage.getItem('physics-atlas-progress-v1'), latest);
  assert.equal(native.getItem('physics-atlas-progress-v1'), old);
  second.runExclusive(() => second.storage.setItem('physics-atlas-practice-v2', '{"schemaVersion":2,"records":{}}'));
  assert.equal(second.getLegacySyncState(), 'in-sync');
  assert.equal(native.getItem('physics-atlas-progress-v1'), latest);
});

test('transaction commits v2 with a v1 mirror or leaves prior state untouched on the first write failure', () => {
  const native = new StorageStub();
  const adapter = createLearningStorage(native);
  adapter.beginTransaction();
  adapter.storage.setItem('physics-atlas-progress-v1', 'progress-next');
  adapter.storage.setItem('physics-atlas-practice-v2', 'practice-next');
  assert.equal(native.writes.length, 0);
  adapter.commitTransaction();
  assert.deepEqual(native.writes, [learningStorageKey, 'physics-atlas-progress-v1', learningStorageKey]);
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

test('refresh reloads current data but never changes a transaction’s starting snapshot', () => {
  const native = new StorageStub();
  const a = createLearningStorage(native), b = createLearningStorage(native);
  a.beginTransaction();
  a.storage.setItem('physics-atlas-practice-v2', '{"schemaVersion":2,"records":{"q":1}}');
  b.storage.setItem('physics-atlas-practice-v2', '{"schemaVersion":2,"records":{"q":2}}');
  a.refresh();
  assert.equal(JSON.parse(a.storage.getItem('physics-atlas-practice-v2')).records.q, 1);
  const before = native.getItem(learningStorageKey);
  assert.throws(() => a.commitTransaction(), /同时|冲突|刷新/);
  assert.equal(native.getItem(learningStorageKey), before);
  a.refresh();
  assert.equal(JSON.parse(a.storage.getItem('physics-atlas-practice-v2')).records.q, 2);
});

test('runExclusive preserves the synchronous fallback result when Web Locks are unavailable', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const adapter = createLearningStorage(new StorageStub());
  let called = false;
  const result = adapter.runExclusive(() => { called = true; return 42; });
  assert.equal(called, true);
  assert.equal(result, 42);
});

test('runExclusive runs mutations only when the named Web Lock is granted', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  });
  let grant;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    locks: { request(name, action) {
      assert.equal(name, learningStorageKey);
      return new Promise((resolve) => { grant = () => resolve(action()); });
    } },
  } });
  const native = new StorageStub();
  const adapter = createLearningStorage(native);
  const pending = adapter.runExclusive(() => {
    adapter.storage.setItem('physics-atlas-practice-v2', 'answer');
    return 'saved';
  });
  assert.equal(native.getItem(learningStorageKey), null);
  grant();
  assert.equal(await pending, 'saved');
  assert.equal(JSON.parse(native.getItem(learningStorageKey)).practiceRaw, 'answer');
});
