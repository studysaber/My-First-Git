import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceRoute, createProgressStore, getRouteState } from '../dist/assets/study.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const route = { nodeIds: ['a', 'b', 'c'] };

test('a node outside the route has no next station and cannot complete it', () => {
  assert.equal(advanceRoute(route, 'outside'), null);
  assert.deepEqual(getRouteState(route, 'outside', { c: 'mastered' }), {
    inRoute: false, done: 1, total: 3, complete: false, nextUnfinishedId: null,
  });
});

test('marking only the final station does not complete the route', () => {
  const partial = getRouteState(route, 'c', { c: 'mastered' });
  assert.equal(partial.complete, false);
  assert.equal(partial.nextUnfinishedId, 'a');
  const complete = getRouteState(route, 'c', { a: 'mastered', b: 'mastered', c: 'mastered' });
  assert.equal(complete.complete, true);
  assert.equal(complete.nextUnfinishedId, null);
});

test('storage failure is visible and progress remains exportable for this session', () => {
  const storage = new MemoryStorage();
  storage.setItem = () => { throw new Error('quota'); };
  const progress = createProgressStore(storage);
  progress.setStatus('a', 'mastered');
  assert.equal(progress.getPersistenceState(), 'memory');
  assert.equal(progress.getAll().a, 'mastered');
  assert.equal(JSON.parse(progress.exportJson()).progress.a, 'mastered');
});

test('import merges by default, retains current conflicts, and previews replacement', () => {
  const storage = new MemoryStorage();
  const progress = createProgressStore(storage);
  progress.setStatus('a', 'mastered');
  const serialized = JSON.stringify({ version: 1, progress: { a: 'review', b: 'mastered' } });
  const preview = progress.previewImportJson(serialized, new Set(['a', 'b']));
  assert.equal(preview.added, 1);
  assert.equal(preview.conflicts, 1);
  progress.importJson(serialized, new Set(['a', 'b']));
  assert.deepEqual(progress.getAll(), { a: 'mastered', b: 'mastered' });
  progress.importJson(serialized, new Set(['a', 'b']), { mode: 'replace' });
  assert.deepEqual(progress.getAll(), { a: 'review', b: 'mastered' });
});

test('a malformed saved record is preserved as a backup before new changes', () => {
  const storage = new MemoryStorage();
  storage.setItem('physics-atlas-progress-v1', '{broken');
  const progress = createProgressStore(storage);
  assert.deepEqual(progress.getAll(), {});
  progress.setStatus('a', 'review');
  assert.equal(progress.getPersistenceState(), 'memory');
  assert.equal(storage.getItem('physics-atlas-progress-v1'), '{broken');
  assert.deepEqual(progress.getAll(), { a: 'review' });
});
