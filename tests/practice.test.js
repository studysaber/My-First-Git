import test from 'node:test';
import assert from 'node:assert/strict';
import { nodes, chapters } from '../dist/assets/data/physics-data.js';
import { questions } from '../dist/assets/data/practice-data.js';
import { questionsByNode, gradeAnswer, createPracticeStore } from '../dist/assets/practice.js';

test('each core node has a distinct concept and applied question with gradeable, explained answers', () => {
  const ids = new Set();
  const prompts = new Set();
  for (const q of questions) {
    assert.ok(!ids.has(q.id), `duplicate id ${q.id}`);
    assert.ok(!prompts.has(q.prompt), `duplicate prompt ${q.id}`);
    ids.add(q.id);
    prompts.add(q.prompt);
    assert.ok(q.prompt?.trim(), q.id);
    assert.ok(q.explanation?.trim(), q.id);
    if (q.kind === 'numeric') {
      assert.ok(Number.isFinite(q.answer), q.id);
      assert.ok(q.unit && q.prompt.includes(q.unit), q.id);
      assert.equal(gradeAnswer(q, { value: q.answer, unit: q.unit }).correct, true, q.id);
    } else {
      assert.ok(q.options?.length >= 2, q.id);
      assert.equal(q.options.filter((option) => option.id === q.answer).length, 1, q.id);
      assert.equal(gradeAnswer(q, q.answer).correct, true, q.id);
    }
  }
  for (const node of nodes.filter((item) => item.level === 'core')) {
    const items = questionsByNode(node.id);
    assert.ok(items.some((q) => q.kind === 'concept'), `${node.id}: concept missing`);
    assert.ok(items.some((q) => q.kind === 'numeric' || q.kind === 'interpretation'), `${node.id}: applied missing`);
  }
});

test('nonfinite numeric tolerances cannot turn an incorrect answer into a pass', () => {
  const q = { kind: 'numeric', answer: 10, unit: 'm', tolerance: { absolute: Infinity, relative: NaN }, explanation: '应为 10 m。' };
  assert.equal(gradeAnswer(q, { value: 999, unit: 'm' }).correct, false);
});

test('choice answer positions vary within each chapter so one position cannot pass everything', () => {
  for (const chapter of chapters) {
    const chapterIds = new Set(nodes.filter((node) => node.chapterId === chapter.id).map((node) => node.id));
    const positions = new Set(questions.filter((q) => chapterIds.has(q.nodeId) && q.options).map((q) => q.options.findIndex((option) => option.id === q.answer)));
    assert.ok(positions.size >= 2, chapter.id);
  }
});

test('every chapter starts with a core node offering two distinct practice modes', () => {
  for (const chapter of chapters) {
    const core = nodes.find((node) => node.chapterId === chapter.id && node.level === 'core');
    const questions = questionsByNode(core.id);
    assert.ok(questions.some((q) => q.kind === 'concept'), chapter.id);
    assert.ok(questions.some((q) => q.kind === 'numeric' || q.kind === 'interpretation'), chapter.id);
  }
});

test('representative quantitative nodes across all chapters include conceptual and applied questions', () => {
  for (const id of ['c9-simple-pendulum', 'c10-wave-quantities', 'c11-young', 'c12-ideal-gas', 'c13-first-law', 'c14-time-dilation', 'c15-photon-photoelectric', 'c16-neutrinos']) {
    const items = questionsByNode(id);
    assert.ok(items.some((q) => q.kind === 'concept'), id);
    assert.ok(items.some((q) => q.kind === 'numeric' || q.kind === 'interpretation'), id);
  }
});

test('numeric grading respects units and the greater of absolute and relative tolerance', () => {
  const q = { kind: 'numeric', answer: 25, unit: 'μm', tolerance: { absolute: 0.1, relative: 0.01 }, explanation: '镜移动距离为条纹数乘半波长。' };
  assert.equal(gradeAnswer(q, { value: 25.2, unit: 'μm' }).correct, true);
  assert.equal(gradeAnswer(q, { value: 25.3, unit: 'μm' }).correct, false);
  assert.equal(gradeAnswer(q, { value: 25, unit: 'm' }).correct, false);
  for (const value of ['', ' ', NaN, Infinity, 'Infinity', '25 μm']) {
    assert.equal(gradeAnswer(q, { value, unit: 'μm' }).correct, false, String(value));
  }
});

test('concept grading gives the authored explanation and does not execute answers', () => {
  const q = { kind: 'concept', options: [{ id: 'a', text: '正确' }, { id: 'b', text: '错误' }], answer: 'a', explanation: '根据定义。' };
  assert.equal(gradeAnswer(q, 'b').correct, false);
  assert.match(gradeAnswer(q, 'b').feedback, /根据定义/);
  assert.equal(gradeAnswer(q, 'a').correct, true);
  assert.equal(gradeAnswer(q, 'process.exit()').correct, false);
});

test('practice evidence is versioned, survives refresh and never inherits self assessment', () => {
  const map = new Map([['physics-atlas-progress-v1', JSON.stringify({ version: 1, progress: { 'c9-shm': 'mastered' } })]]);
  const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const q = { id: 'test-q', nodeId: 'c9-shm', version: 1, kind: 'concept', options: [{ id: 'yes', text: '是' }], answer: 'yes', explanation: '是。' };
  const store = createPracticeStore(storage);
  assert.equal(store.getRecord(q), null);
  store.submit(q, 'yes', new Date('2026-09-28T12:00:00+08:00'));
  assert.equal(createPracticeStore(storage).getRecord(q).passed, true);
  assert.equal(store.getRecord({ ...q, version: 2 }), null);
  assert.equal(map.get('physics-atlas-progress-v1').includes('mastered'), true);
});

test('repeat submit counts once until a new attempt begins', () => {
  const q = { id: 'test-q', nodeId: 'c9-shm', version: 1, kind: 'concept', options: [{ id: 'yes', text: '是' }], answer: 'yes', explanation: '是。' };
  const store = createPracticeStore(null);
  const now = new Date('2026-09-28T12:00:00+08:00');
  store.submit(q, 'no', now);
  store.submit(q, 'no', now);
  const blocked = store.submit(q, 'yes', now);
  assert.equal(blocked.record.lastCorrect, false);
  assert.equal(blocked.result.correct, false);
  assert.equal(store.getRecord(q).attempts, 1);
  store.beginAttempt(q);
  store.submit(q, 'yes', now);
  assert.equal(store.getRecord(q).attempts, 2);
  assert.equal(store.getRecord(q).firstCorrect, false);
});

test('review intervals advance only on due local dates; wrong answer restarts sequence', () => {
  const q = { id: 'test-q', nodeId: 'c9-shm', version: 1, kind: 'concept', options: [{ id: 'yes', text: '是' }], answer: 'yes', explanation: '是。' };
  const store = createPracticeStore(null);
  const on = (day) => new Date(`${day}T12:00:00`);
  store.submit(q, 'yes', on('2026-09-28'));
  assert.equal(store.getRecord(q).dueDate, '2026-09-29');
  store.beginAttempt(q);
  store.submit(q, 'yes', on('2026-09-28'));
  assert.equal(store.getRecord(q).dueDate, '2026-09-29');
  store.beginAttempt(q);
  store.submit(q, 'yes', on('2026-09-29'));
  assert.equal(store.getRecord(q).dueDate, '2026-10-02');
  store.beginAttempt(q);
  store.submit(q, 'yes', on('2026-10-02'));
  assert.equal(store.getRecord(q).dueDate, '2026-10-09');
  store.beginAttempt(q);
  store.submit(q, 'no', on('2026-10-09'));
  assert.equal(store.getRecord(q).dueDate, '2026-10-09');
  store.beginAttempt(q);
  store.submit(q, 'yes', on('2026-10-09'));
  assert.equal(store.getRecord(q).dueDate, '2026-10-10');
});

test('snapshot preview rejects wrong schema, unknown IDs and malformed practice records', () => {
  const q = { id: 'test-q', nodeId: 'c9-shm', version: 1, kind: 'concept', options: [{ id: 'yes', text: '是' }], answer: 'yes', explanation: '是。' };
  const source = createPracticeStore(null);
  source.submit(q, 'yes', new Date('2026-09-28T12:00:00+08:00'));
  const record = source.getRecord(q);
  const target = createPracticeStore(null);
  const valid = { schemaVersion: 2, records: { 'test-q@1': record } };
  assert.deepEqual(target.previewImport(valid, ['test-q']), { valid: true, accepted: 1, errors: [] });
  assert.equal(target.previewImport({ ...valid, schemaVersion: 1 }, ['test-q']).valid, false);
  assert.equal(target.previewImport(valid, ['other-q']).valid, false);
  assert.equal(target.previewImport({ schemaVersion: 2, records: { 'test-q@1': { ...record, attempts: -1 } } }, ['test-q']).valid, false);
  assert.equal(target.previewImport({ schemaVersion: 2, records: { 'test-q@1': { ...record, dueDate: '2026-02-31' } } }, ['test-q']).valid, false);
  assert.equal(target.previewImport({ schemaVersion: 2, records: { 'test-q@1': { ...record, firstCorrect: false, passed: false, lastCorrect: true } } }, ['test-q']).valid, false);
});

test('practice import merges by latest answer, replaces when requested and keeps memory on failed write', () => {
  const q = { id: 'test-q', nodeId: 'c9-shm', version: 1, kind: 'concept', options: [{ id: 'yes', text: '是' }], answer: 'yes', explanation: '是。' };
  const map = new Map();
  let failWrite = false;
  const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => { if (failWrite) throw Error('quota'); map.set(key, value); } };
  const target = createPracticeStore(storage);
  target.submit(q, 'yes', new Date('2026-09-29T12:00:00+08:00'));
  const recent = target.getRecord(q);
  const older = { ...recent, lastAnsweredAt: '2026-09-28T04:00:00.000Z', attempts: 4, lastCorrect: false };
  const snapshot = { schemaVersion: 2, records: { 'test-q@1': older } };
  target.importSnapshot(snapshot, { mode: 'merge', knownQuestionIds: ['test-q'] });
  assert.deepEqual(target.getRecord(q), recent);
  failWrite = true;
  assert.throws(() => target.importSnapshot(snapshot, { mode: 'replace', knownQuestionIds: ['test-q'] }), /quota/);
  assert.deepEqual(target.getRecord(q), recent);
  failWrite = false;
  target.importSnapshot(snapshot, { mode: 'replace', knownQuestionIds: ['test-q'] });
  assert.deepEqual(target.getRecord(q), older);
  assert.deepEqual(createPracticeStore(storage).getRecord(q), older);
});
