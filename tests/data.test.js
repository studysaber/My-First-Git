import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKnowledgeData } from '../dist/assets/data/validate.js';

const relationshipTypes = ['先修', '推导/解释', '类比/迁移', '对比', '应用'];
const requiredRouteIds = ['oscillation-to-optics', 'energy-to-entropy', 'statistics-to-entropy', 'spacetime', 'classical-to-quantum', 'modern-technology'];
const requiredNodeStringFields = ['id', 'title', 'chapterId', 'section', 'type', 'summary', 'formula', 'variables', 'conditions', 'pitfalls', 'problemApproach'];

function fixtureNode(id, chapterId, level = 'extension') {
  return {
    id,
    title: `概念 ${id}`,
    chapterId,
    section: '测试小节',
    type: 'concept',
    level,
    summary: '这是用于契约测试的简短学习说明。',
    formula: 'x = 0',
    variables: 'x：位置，m。',
    conditions: '仅用于确定性测试，不表示真实物理模型。',
    prerequisites: [],
    pitfalls: '不要把测试占位关系当作物理结论。',
    problemApproach: '先辨认已知量和所求量。',
    keywords: ['测试'],
  };
}

function validFixture() {
  const fixtureChapters = Array.from({ length: 8 }, (_, index) => ({
    id: `ch-${index + 9}`,
    number: index + 9,
    title: `第 ${index + 9} 章`,
  }));
  const fixtureNodes = Array.from({ length: 90 }, (_, index) => {
    const chapterIndex = index < 72 ? Math.floor(index / 12) : 6 + Math.floor((index - 72) / 9);
    const chapterId = `ch-${chapterIndex + 9}`;
    const isCore = index === 0 || (index < 72 && index % 12 === 0) || (index >= 72 && (index - 72) % 9 === 0);
    return fixtureNode(`fixture-${index + 1}`, chapterId, isCore ? 'core' : 'extension');
  });
  const routeNodeIds = [0, 12, 24, 36, 48, 60].map((index) => fixtureNodes[index].id);
  const fixtureRoutes = Array.from({ length: 6 }, (_, index) => ({
    id: requiredRouteIds[index],
    title: `测试路线 ${index + 1}`,
    minutes: 6,
    nodeIds: routeNodeIds,
    goal: '验证路线端点与顺序字段。',
  }));
  return {
    chapters: fixtureChapters,
    nodes: fixtureNodes,
    edges: [{ source: routeNodeIds[0], target: routeNodeIds[1], type: '先修', label: '先建立基础' }],
    routes: fixtureRoutes,
    chapterStudyPaths: Object.fromEntries(fixtureChapters.map((chapter) => [chapter.id, fixtureNodes.filter((node) => node.chapterId === chapter.id).map((node) => node.id)])),
  };
}

function invalid(data) {
  const result = validateKnowledgeData(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
}

test('the complete textbook data covers chapters 9–16 with bounded, linked routes', async () => {
  const { assessment, chapters, edges, nodes, routes, sourceNotes } = await import('../dist/assets/data/physics-data.js');
  assert.deepEqual(chapters.map(({ number }) => number), [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.ok(nodes.length >= 112, 'coverage growth must preserve the original nodes');
  assert.equal(nodes.find(({ id }) => id === 'c13-entropy-stat-info')?.level, 'extension', 'the starred 13-9 information-entropy material should be marked as extension');
  assert.equal(routes.length, 6, 'all six study routes should be available');
  assert.deepEqual([...routes.map(({ id }) => id)].sort(), [...requiredRouteIds].sort(), 'the six route IDs should be stable');
  assert.equal(assessment.length, 5, 'the assessment should cover five neutral dimensions');
  assert.ok(sourceNotes.some(({ url }) => url === 'https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=61704ca3938b7cc2960edcb7'));

  const expectedAssessmentTitles = ['内容结构', '数学要求', '难点分布', '工程适用性', '学习策略'];
  assert.deepEqual(assessment.map(({ title }) => title), expectedAssessmentTitles);
  for (const section of assessment) {
    assert.ok(section.learnerFit?.advice?.trim(), `${section.title} should separate actionable learner-fit advice`);
    assert.ok(section.learnerFit.nodeIds.length + section.learnerFit.routeIds.length > 0, `${section.title} advice should link to existing study content`);
    assert.ok(section.learnerFit.nodeIds.every((id) => nodes.some((node) => node.id === id)), `${section.title} should link only existing nodes`);
    assert.ok(section.learnerFit.routeIds.every((id) => routes.some((route) => route.id === id)), `${section.title} should link only existing routes`);
  }

  const { chapterStudyPaths, coverageExceptions } = await import('../dist/assets/data/physics-data.js');
  const result = validateKnowledgeData({ chapters, nodes, edges, routes, chapterStudyPaths, coverageExceptions, sourceNotes });
  assert.deepEqual(result, { valid: true, errors: [] });
  for (const route of routes) {
    assert.ok(route.minutes >= 5 && route.minutes <= 12, `${route.id} should take 5–12 minutes`);
    assert.ok(route.nodeIds.length >= 6 && route.nodeIds.length <= 12, `${route.id} should list 6–12 ordered nodes`);
    assert.ok(route.nodeIds.every((id) => nodes.some((node) => node.id === id)), `${route.id} should reference known nodes`);
    const routeChapters = new Set(route.nodeIds.map((id) => nodes.find((node) => node.id === id).chapterId));
    assert.ok(routeChapters.size > 1, `${route.id} should cross chapter boundaries`);
  }
  assert.deepEqual(relationshipTypes, ['先修', '推导/解释', '类比/迁移', '对比', '应用']);
});

test('the identified starred polytropic subtopic is marked as an extension', async () => {
  const { nodes } = await import('../dist/assets/data/physics-data.js');
  assert.equal(nodes.find(({ id }) => id === 'c13-polytropic')?.level, 'extension');
});

test('relativistic rest-mass change uses one explicit Q sign convention', async () => {
  const { nodes } = await import('../dist/assets/data/physics-data.js');
  const node = nodes.find(({ id }) => id === 'c14-mass-energy');
  assert.ok(node);
  assert.match(node.formula, /Δm=m末−m初; Q=−Δm c²=\(m初−m末\)c²/);
  assert.match(node.variables, /m初、m末：kg/);
});

test('modern technology route follows and connects each physical mechanism', async () => {
  const { edges, nodes, routes } = await import('../dist/assets/data/physics-data.js');
  const route = routes.find(({ id }) => id === 'modern-technology');
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const positions = new Map(route.nodeIds.map((nodeId, index) => [nodeId, index]));
  for (const nodeId of route.nodeIds) {
    for (const prerequisite of byId.get(nodeId).prerequisites) {
      if (positions.has(prerequisite)) {
        assert.ok(positions.get(prerequisite) < positions.get(nodeId), `${prerequisite} must precede ${nodeId}`);
      }
    }
  }
  const expectedOrder = ['c10-em-plane', 'c15-photon-photoelectric', 'c15-bohr', 'c15-stimulated-emission', 'c15-laser', 'c15-debroglie', 'c15-wavefunction', 'c15-schrodinger', 'c15-semiconductor', 'c15-pn-junction', 'c15-tunneling', 'c15-stm'];
  assert.deepEqual(route.nodeIds, expectedOrder);
  for (let index = 0; index < route.nodeIds.length - 1; index += 1) {
    assert.ok(edges.some(({ source, target }) => source === route.nodeIds[index] && target === route.nodeIds[index + 1]), `${route.nodeIds[index]} should lead directly to ${route.nodeIds[index + 1]}`);
  }
  assert.ok(byId.get('c15-semiconductor').prerequisites.includes('c15-photon-photoelectric'));
  assert.ok(byId.get('c15-semiconductor').prerequisites.includes('c15-schrodinger'));
  assert.ok(byId.get('c15-tunneling').prerequisites.includes('c15-schrodinger'));
});

test('the plane-wave to photoelectric edge is a directed contrast', async () => {
  const { edges } = await import('../dist/assets/data/physics-data.js');
  const edge = edges.find(({ source, target }) => source === 'c10-em-plane' && target === 'c15-photon-photoelectric');
  assert.ok(edge, 'the relationship should point from the plane-wave model to the photoelectric threshold');
  assert.equal(edge.type, '对比');
  assert.match(edge.label, /对比经典场模型与光电效应阈值/);
});

test('the knowledge graph uses each approved relationship type without duplicate edges', async () => {
  const { edges } = await import('../dist/assets/data/physics-data.js');
  const actualTypes = [...new Set(edges.map(({ type }) => type))].sort();
  assert.deepEqual(actualTypes, [...relationshipTypes].sort());
  const edgeKeys = edges.map(({ source, target, type }) => `${source}|${target}|${type}`);
  assert.equal(new Set(edgeKeys).size, edgeKeys.length, 'each directed relationship should appear only once');
});

test('the textbook assessment separates evidence-based characteristics from learner advice', async () => {
  const { assessment } = await import('../dist/assets/data/physics-data.js');
  assert.equal(assessment.length, 5, 'the five assessment dimensions should be available');
  for (const section of assessment) {
    assert.ok(section.textbookView?.trim(), `${section.title} should describe a textbook characteristic`);
    assert.ok(section.learnerFit?.advice?.trim(), `${section.title} should give separate, actionable learner advice`);
  }
});

test('the deterministic 90-node fixture satisfies the data contract', () => {
  assert.equal(validFixture().nodes.length, 90);
  assert.deepEqual(validateKnowledgeData(validFixture()), { valid: true, errors: [] });
});

test('the five identified directory gaps each have a distinct study node', async () => {
  const { nodes } = await import('../dist/assets/data/physics-data.js');
  for (const title of ['两相互垂直振动合成', '劳埃德镜', '热力学第零定律', '等容过程', '等压过程']) {
    assert.ok(nodes.some((node) => node.title.includes(title)), `${title} should have its own node`);
  }
});

test('thin-film and polarization overviews retain old IDs while subtopics gain independent nodes', async () => {
  const { nodes } = await import('../dist/assets/data/physics-data.js');
  const ids = new Set(nodes.map((node) => node.id));
  for (const id of ['c11-thin-film-rings', 'c11-polarizer-malus-brewster', 'c11-thin-film', 'c11-wedge', 'c11-newton-rings', 'c11-malus', 'c11-brewster']) {
    assert.ok(ids.has(id), `${id} must stay navigable`);
  }
});

test('chapter paths cover every authored node exactly once in its own chapter', async () => {
  const { chapters, nodes, chapterStudyPaths } = await import('../dist/assets/data/physics-data.js');
  assert.equal(Object.keys(chapterStudyPaths).length, 8);
  for (const chapter of chapters) {
    const path = chapterStudyPaths[chapter.id];
    assert.ok(Array.isArray(path) && path.length > 0, chapter.id);
    const expected = nodes.filter((node) => node.chapterId === chapter.id).map((node) => node.id);
    assert.deepEqual([...path].sort(), expected.sort(), chapter.id);
  }
});

test('new thermal concepts appear before applications in the chapter path', async () => {
  const { chapterStudyPaths } = await import('../dist/assets/data/physics-data.js');
  const path = chapterStudyPaths['ch-13'];
  assert.ok(path.indexOf('c13-zeroth-law') < path.indexOf('c13-first-law'));
  assert.ok(path.indexOf('c13-isochoric') < path.indexOf('c13-cycle-carnot'));
  assert.ok(path.indexOf('c13-isobaric') < path.indexOf('c13-cycle-carnot'));
});

test('validator accepts coverage growth above 120 nodes and rejects path omissions', () => {
  const larger = validFixture();
  larger.nodes.push(...Array.from({ length: 31 }, (_, index) => fixtureNode(`extra-${index + 1}`, 'ch-9')));
  larger.chapterStudyPaths = Object.fromEntries(larger.chapters.map((chapter) => [chapter.id, larger.nodes.filter((node) => node.chapterId === chapter.id).map((node) => node.id)]));
  assert.equal(validateKnowledgeData(larger).valid, true);
  larger.chapterStudyPaths['ch-9'].pop();
  assert.equal(validateKnowledgeData(larger).valid, false);
});

test('missing textbook section requires an explicit review exception', async () => {
  const { chapters, nodes, edges, routes, chapterStudyPaths, coverageExceptions } = await import('../dist/assets/data/physics-data.js');
  const data = { chapters, nodes, edges, routes, chapterStudyPaths, coverageExceptions: [] };
  assert.equal(validateKnowledgeData(data).valid, false);
  assert.ok(validateKnowledgeData(data).errors.some((error) => error.includes('15-10')));
  assert.deepEqual(coverageExceptions, [{ section: '15-10', status: '需核对' }]);
});

test('reviewed content rejects unresolved source references', async () => {
  const { chapters, nodes, edges, routes, chapterStudyPaths, coverageExceptions, sourceNotes } = await import('../dist/assets/data/physics-data.js');
  const data = { chapters, nodes: nodes.map((node) => ({ ...node })), edges, routes, chapterStudyPaths, coverageExceptions, sourceNotes };
  data.nodes.find((node) => node.id === 'c11-michelson').sourceRefs = ['not-a-source'];
  assert.ok(validateKnowledgeData(data).errors.some((error) => error.includes('unknown source')));
});

test('a cited source must include a usable public URL and title', async () => {
  const { chapters, nodes, edges, routes, chapterStudyPaths, coverageExceptions, sourceNotes } = await import('../dist/assets/data/physics-data.js');
  const data = { chapters, nodes, edges, routes, chapterStudyPaths, coverageExceptions, sourceNotes: sourceNotes.map((source) => ({ ...source })) };
  data.sourceNotes.find((source) => source.id === 'noether-ucr').url = 'not-a-url';
  assert.ok(validateKnowledgeData(data).errors.some((error) => error.includes('noether-ucr') && error.includes('URL')));
  data.sourceNotes.find((source) => source.id === 'noether-ucr').url = 'https://math.ucr.edu/home/baez/noether.html';
  data.sourceNotes.find((source) => source.id === 'noether-ucr').title = ' ';
  assert.ok(validateKnowledgeData(data).errors.some((error) => error.includes('noether-ucr') && error.includes('title')));
});

test('a core card without a complete review cannot pass published data validation', async () => {
  const { chapters, nodes, edges, routes, chapterStudyPaths, coverageExceptions, sourceNotes } = await import('../dist/assets/data/physics-data.js');
  const data = { chapters, nodes: nodes.map((node) => ({ ...node })), edges, routes, chapterStudyPaths, coverageExceptions, sourceNotes };
  const card = data.nodes.find((node) => node.id === 'c11-coherence');
  delete card.explanation;
  delete card.workedExample;
  delete card.sourceRefs;
  assert.ok(validateKnowledgeData(data).errors.some((error) => error.includes('c11-coherence') && error.includes('content review')));
});

test('mean translational kinetic energy is not restricted to monatomic gases', async () => {
  const { nodes } = await import('../dist/assets/data/physics-data.js');
  const node = nodes.find(({ id }) => id === 'c12-temperature-kinetic');
  assert.ok(node, 'the translational kinetic-energy concept should exist');
  assert.doesNotMatch(node.conditions, /单原子/);
  assert.match(node.conditions, /经典理想气体/);
});

test('Michelson mirror travel follows half a wavelength per shifted fringe', async () => {
  const { nodes } = await import('../dist/assets/data/physics-data.js');
  const card = nodes.find(({ id }) => id === 'c11-michelson');
  assert.match(card.formula, /Δℓ=Nλ\/2/);
  assert.match(card.problemApproach, /100.*500 nm.*25 μm/);
  assert.doesNotMatch(card.problemApproach, /除以波长的一半/);
});

test('Bohr card scopes hydrogen and gives a hydrogen-like extension', async () => {
  const { nodes } = await import('../dist/assets/data/physics-data.js');
  const card = nodes.find(({ id }) => id === 'c15-bohr');
  assert.match(card.conditions, /Z\s*=\s*1/);
  assert.match(card.problemApproach, /n=1.*−13\.6 eV/);
  assert.match(card.problemApproach, /Z².*n²/);
});

test('revised content records a source and a worked explanation', async () => {
  const { nodes, sourceNotes } = await import('../dist/assets/data/physics-data.js');
  const sources = new Set(sourceNotes.map((source) => source.id));
  for (const id of ['c11-michelson', 'c15-bohr', 'c13-zeroth-law', 'c13-isochoric', 'c13-isobaric', 'c9-perpendicular-composition', 'c11-lloyd-mirror', 'c11-thin-film', 'c11-wedge', 'c11-newton-rings', 'c11-malus', 'c11-brewster', 'c9-simple-pendulum', 'c10-wave-quantities', 'c10-wave-function', 'c11-young', 'c12-ideal-gas', 'c13-first-law', 'c13-cycle-carnot']) {
    const card = nodes.find((node) => node.id === id);
    assert.ok(card.explanation?.length >= 35, `${id} needs a derivation or explanation`);
    assert.ok(card.workedExample?.length >= 35, `${id} needs a worked example`);
    assert.ok(card.sourceRefs?.length > 0 && card.sourceRefs.every((ref) => sources.has(ref)), `${id} needs a resolvable source`);
  }
});

test('every core node has independently usable explanation, example, and source', async () => {
  const { nodes, sourceNotes } = await import('../dist/assets/data/physics-data.js');
  const sourceIds = new Set(sourceNotes.map((source) => source.id));
  for (const node of nodes.filter((item) => item.level === 'core')) {
    assert.ok(node.explanation?.trim().length >= 30, `${node.id}: explanation`);
    assert.ok(node.workedExample?.trim().length >= 25, `${node.id}: worked example`);
    assert.ok(node.sourceRefs?.length > 0 && node.sourceRefs.every((id) => sourceIds.has(id)), `${node.id}: source`);
  }
});

test('duplicate node identifiers are rejected', () => {
  const data = validFixture();
  data.nodes[1].id = data.nodes[0].id;
  invalid(data);
});

test('duplicate chapter and route identifiers are rejected', () => {
  const chapterData = validFixture();
  chapterData.chapters[1].id = chapterData.chapters[0].id;
  invalid(chapterData);

  const routeData = validFixture();
  routeData.routes[1].id = routeData.routes[0].id;
  invalid(routeData);
});

test('a node that names an unknown chapter is rejected', () => {
  const data = validFixture();
  data.nodes[0].chapterId = 'ch-99';
  invalid(data);
});

test('self-edges are rejected', () => {
  const data = validFixture();
  data.edges[0].target = data.edges[0].source;
  invalid(data);
});

test('edges with unknown endpoints are rejected', () => {
  const data = validFixture();
  data.edges[0].target = 'missing-node';
  invalid(data);
});

test('edges with unknown sources are rejected', () => {
  const data = validFixture();
  data.edges[0].source = 'missing-node';
  invalid(data);
});

test('empty node summaries are rejected', () => {
  const data = validFixture();
  data.nodes[0].summary = '  ';
  invalid(data);
});

test('missing chapter core coverage is rejected', () => {
  const data = validFixture();
  for (const node of data.nodes) {
    if (node.chapterId === 'ch-12') node.level = 'extension';
  }
  invalid(data);
});

test('routes with unknown nodes, invalid lengths, or out-of-range durations are rejected', () => {
  const data = validFixture();
  data.routes[0].nodeIds[2] = 'missing-node';
  invalid(data);

  const tooShort = validFixture();
  tooShort.routes[0].nodeIds = tooShort.routes[0].nodeIds.slice(0, 5);
  invalid(tooShort);

  const tooLong = validFixture();
  tooLong.routes[0].minutes = 13;
  invalid(tooLong);
});

test('route identifiers stay on the six approved study routes', () => {
  const data = validFixture();
  data.routes[0].id = 'unapproved-route';
  invalid(data);
});

test('unknown relationship types and missing required fields are rejected', () => {
  const data = validFixture();
  data.edges[0].type = '相关';
  invalid(data);

  const missingField = validFixture();
  delete missingField.nodes[0].problemApproach;
  invalid(missingField);
});

test('every required node string rejects both omission and whitespace-only values', () => {
  for (const field of requiredNodeStringFields) {
    const missing = validFixture();
    delete missing.nodes[0][field];
    assert.equal(validateKnowledgeData(missing).valid, false, `missing ${field} should be rejected`);

    const empty = validFixture();
    empty.nodes[0][field] = '  ';
    assert.equal(validateKnowledgeData(empty).valid, false, `blank ${field} should be rejected`);
  }
});

test('invalid node levels and malformed node arrays are rejected', () => {
  const level = validFixture();
  level.nodes[0].level = 'optional';
  invalid(level);

  const prerequisites = validFixture();
  prerequisites.nodes[0].prerequisites = 'fixture-2';
  invalid(prerequisites);

  const keywords = validFixture();
  keywords.nodes[0].keywords = [];
  invalid(keywords);
});

test('unknown prerequisite IDs are rejected', () => {
  const data = validFixture();
  data.nodes[0].prerequisites = ['missing-node'];
  invalid(data);
});

test('a node cannot list itself as a prerequisite', () => {
  const data = validFixture();
  data.nodes[0].prerequisites = [data.nodes[0].id];
  invalid(data);
});

test('null top-level input is rejected without throwing', () => {
  assert.doesNotThrow(() => validateKnowledgeData(null));
  assert.equal(validateKnowledgeData(null).valid, false);
});

test('validator rejects an empty chapter path', () => {
  const data = validFixture();
  data.chapterStudyPaths = Object.fromEntries(data.chapters.map((chapter) => [chapter.id, data.nodes.filter((node) => node.chapterId === chapter.id).map((node) => node.id)]));
  data.chapterStudyPaths['ch-16'] = [];
  invalid(data);
});
