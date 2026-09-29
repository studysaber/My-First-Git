import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation, serializeLocation } from '../dist/assets/navigation.js';

const catalog = {
  nodes: [{ id: 'a', chapterId: 'ch-9' }, { id: 'b', chapterId: 'ch-10' }],
  chapters: [{ id: 'ch-9' }, { id: 'ch-10' }],
  routes: [{ id: 'r', nodeIds: ['a', 'b'] }],
};

test('a shared link restores the chosen node and study tab', () => {
  const hash = serializeLocation({ view: 'study', nodeId: 'b', tab: 'experiment' });
  assert.equal(hash, '#view=study&node=b&tab=experiment');
  assert.deepEqual(parseLocation(hash, catalog), {
    view: 'study', nodeId: 'b', chapterId: 'ch-10', routeId: 'r', tab: 'experiment',
  });
});

test('a full-graph link restores the chosen detail tab', () => {
  const hash = serializeLocation({ view: 'graph', nodeId: 'a', tab: 'experiment' });
  assert.equal(hash, '#view=graph&node=a&tab=experiment');
  assert.equal(parseLocation(hash, catalog).tab, 'experiment');
});

test('a chapter link restores its selected chapter even when the last node was elsewhere', () => {
  const state = parseLocation('#view=chapter&node=a&chapter=ch-10', catalog);
  assert.equal(state.view, 'chapter');
  assert.equal(state.chapterId, 'ch-10');
  assert.equal(state.nodeId, 'a');
});

test('invalid IDs and unsupported tabs fall back to a valid location', () => {
  assert.deepEqual(parseLocation('#view=unsafe&node=missing&tab=wrong', catalog), {
    view: 'study', nodeId: 'a', chapterId: 'ch-9', routeId: 'r', tab: 'understand',
  });
});

test('a share URL cannot serialize progress or unknown keys', () => {
  const hash = serializeLocation({ view: 'graph', nodeId: 'a', progress: { a: 'mastered' }, name: 'student' });
  assert.equal(hash, '#view=graph&node=a');
});
