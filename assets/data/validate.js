const RELATIONSHIP_TYPES = new Set(['先修', '推导/解释', '类比/迁移', '对比', '应用']);
const REQUIRED_CHAPTER_NUMBERS = [9, 10, 11, 12, 13, 14, 15, 16];
const REQUIRED_ROUTE_IDS = new Set(['oscillation-to-optics', 'energy-to-entropy', 'statistics-to-entropy', 'spacetime', 'classical-to-quantum', 'modern-technology']);
const REQUIRED_NODE_STRINGS = [
  'id', 'title', 'chapterId', 'section', 'type', 'summary', 'formula', 'variables',
  'conditions', 'pitfalls', 'problemApproach',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function checkUniqueIds(items, label, errors) {
  const seen = new Set();
  for (const item of items) {
    if (!isNonEmptyString(item?.id)) continue;
    if (seen.has(item.id)) errors.push(`duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
}

export function validateKnowledgeData(input = {}) {
  const errors = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['input must be an object'] };
  const { chapters = [], nodes = [], edges = [], routes = [] } = input;
  if (!Array.isArray(chapters)) errors.push('chapters must be an array');
  if (!Array.isArray(nodes)) errors.push('nodes must be an array');
  if (!Array.isArray(edges)) errors.push('edges must be an array');
  if (!Array.isArray(routes)) errors.push('routes must be an array');
  if (!Array.isArray(chapters) || !Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(routes)) {
    return { valid: false, errors };
  }

  if (chapters.length !== 8) errors.push('exactly eight chapters are required');
  checkUniqueIds(chapters, 'chapter', errors);
  const expectedNumbers = REQUIRED_CHAPTER_NUMBERS;
  const actualNumbers = chapters.map((chapter) => chapter?.number).sort((a, b) => a - b);
  if (actualNumbers.length !== expectedNumbers.length || actualNumbers.some((number, index) => number !== expectedNumbers[index])) {
    errors.push('chapters must cover numbers 9 through 16 exactly');
  }

  const chapterIds = new Set(chapters.map((chapter) => chapter?.id).filter(isNonEmptyString));
  for (const chapter of chapters) {
    if (!isNonEmptyString(chapter?.id)) errors.push('chapter id is required');
    if (!Number.isInteger(chapter?.number)) errors.push(`chapter ${chapter?.id ?? '(unknown)'} needs an integer number`);
    if (!isNonEmptyString(chapter?.title)) errors.push(`chapter ${chapter?.id ?? '(unknown)'} needs a title`);
  }

  if (nodes.length < 90 || nodes.length > 120) errors.push('node count must be between 90 and 120');
  checkUniqueIds(nodes, 'node', errors);
  const nodeIds = new Set(nodes.map((node) => node?.id).filter(isNonEmptyString));
  const coreCounts = new Map([...chapterIds].map((id) => [id, 0]));
  for (const node of nodes) {
    for (const field of REQUIRED_NODE_STRINGS) {
      if (!isNonEmptyString(node?.[field])) errors.push(`node ${node?.id ?? '(unknown)'} needs ${field}`);
    }
    if (node?.level !== 'core' && node?.level !== 'extension') errors.push(`node ${node?.id ?? '(unknown)'} has an invalid level`);
    if (!Array.isArray(node?.prerequisites)) errors.push(`node ${node?.id ?? '(unknown)'} prerequisites must be an array`);
    else if (node.prerequisites.some((id) => !isNonEmptyString(id) || !nodeIds.has(id) || id === node.id)) errors.push(`node ${node?.id ?? '(unknown)'} has an unknown or self prerequisite`);
    if (!Array.isArray(node?.keywords) || node.keywords.length === 0 || node.keywords.some((word) => !isNonEmptyString(word))) {
      errors.push(`node ${node?.id ?? '(unknown)'} needs non-empty keywords`);
    }
    if (isNonEmptyString(node?.chapterId) && !chapterIds.has(node.chapterId)) {
      errors.push(`node ${node.id ?? '(unknown)'} references an unknown chapter: ${node.chapterId}`);
    }
    if (node?.level === 'core' && coreCounts.has(node.chapterId)) coreCounts.set(node.chapterId, coreCounts.get(node.chapterId) + 1);
  }
  for (const chapter of chapters) {
    if (coreCounts.get(chapter?.id) === 0) errors.push(`chapter ${chapter.id} has no core node`);
  }

  for (const edge of edges) {
    if (!isNonEmptyString(edge?.source) || !nodeIds.has(edge.source)) errors.push(`edge has an unknown source: ${edge?.source ?? '(missing)'}`);
    if (!isNonEmptyString(edge?.target) || !nodeIds.has(edge.target)) errors.push(`edge has an unknown target: ${edge?.target ?? '(missing)'}`);
    if (edge?.source === edge?.target && isNonEmptyString(edge?.source)) errors.push(`self-edge is not allowed: ${edge.source}`);
    if (!RELATIONSHIP_TYPES.has(edge?.type)) errors.push(`edge has an invalid relationship type: ${edge?.type ?? '(missing)'}`);
    if (!isNonEmptyString(edge?.label)) errors.push('edge label is required');
  }

  checkUniqueIds(routes, 'route', errors);
  if (routes.length !== REQUIRED_ROUTE_IDS.size || routes.some((route) => !REQUIRED_ROUTE_IDS.has(route?.id))) {
    errors.push('routes must contain the six approved route IDs');
  }
  for (const route of routes) {
    if (!isNonEmptyString(route?.id)) errors.push('route id is required');
    if (!isNonEmptyString(route?.title)) errors.push(`route ${route?.id ?? '(unknown)'} needs a title`);
    if (!isNonEmptyString(route?.goal)) errors.push(`route ${route?.id ?? '(unknown)'} needs a goal`);
    if (!Number.isFinite(route?.minutes) || route.minutes < 5 || route.minutes > 12) errors.push(`route ${route?.id ?? '(unknown)'} must take 5–12 minutes`);
    if (!Array.isArray(route?.nodeIds) || route.nodeIds.length < 6 || route.nodeIds.length > 12) {
      errors.push(`route ${route?.id ?? '(unknown)'} must contain 6–12 ordered nodes`);
      continue;
    }
    if (new Set(route.nodeIds).size !== route.nodeIds.length) errors.push(`route ${route.id ?? '(unknown)'} repeats a node`);
    if (route.nodeIds.some((id) => !nodeIds.has(id))) errors.push(`route ${route.id ?? '(unknown)'} references an unknown node`);
    const routeChapterIds = new Set(route.nodeIds.map((id) => nodes.find((node) => node?.id === id)?.chapterId).filter(Boolean));
    if (routeChapterIds.size < 2) errors.push(`route ${route.id ?? '(unknown)'} must cross chapter boundaries`);
  }

  return { valid: errors.length === 0, errors };
}
