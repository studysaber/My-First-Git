const RELATIONSHIP_TYPES = new Set(['先修', '推导/解释', '类比/迁移', '对比', '应用']);
const REQUIRED_CHAPTER_NUMBERS = [9, 10, 11, 12, 13, 14, 15, 16];
const REQUIRED_SECTION_ENDS = { 9: 8, 10: 8, 11: 14, 12: 10, 13: 9, 14: 8, 15: 15, 16: 3 };
const REQUIRED_ROUTE_IDS = new Set(['oscillation-to-optics', 'energy-to-entropy', 'statistics-to-entropy', 'spacetime', 'classical-to-quantum', 'modern-technology']);
const REQUIRED_NODE_STRINGS = [
  'id', 'title', 'chapterId', 'section', 'type', 'summary', 'formula', 'variables',
  'conditions', 'pitfalls', 'problemApproach',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPublicWebUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
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
  const { chapters = [], nodes = [], edges = [], routes = [], chapterStudyPaths, coverageExceptions, sourceNotes } = input;
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
  if (sourceNotes !== undefined) {
    if (!Array.isArray(sourceNotes)) errors.push('sourceNotes must be an array');
    else {
      checkUniqueIds(sourceNotes, 'source', errors);
      for (const source of sourceNotes) {
        if (!isNonEmptyString(source?.title)) errors.push(`source ${source?.id ?? '(unknown)'} needs title`);
        if (!isPublicWebUrl(source?.url)) errors.push(`source ${source?.id ?? '(unknown)'} needs a public HTTPS URL`);
      }
      const sourceIds = new Set(sourceNotes.map((source) => source?.id).filter(isNonEmptyString));
      for (const node of nodes) {
        const hasReview = node?.level === 'core' || node?.sourceRefs !== undefined || node?.explanation !== undefined || node?.workedExample !== undefined;
        if (!hasReview) continue;
        if (!isNonEmptyString(node.explanation) || !isNonEmptyString(node.workedExample)) errors.push(`node ${node.id} has an incomplete content review`);
        if (!Array.isArray(node.sourceRefs) || node.sourceRefs.length === 0 || node.sourceRefs.some((ref) => !sourceIds.has(ref))) {
          errors.push(`node ${node.id} has an unknown source reference`);
        }
      }
    }
  }

  if (chapterStudyPaths === null || typeof chapterStudyPaths !== 'object' || Array.isArray(chapterStudyPaths)) {
    errors.push('chapterStudyPaths must map each chapter to an ordered node list');
  } else {
    for (const key of Object.keys(chapterStudyPaths)) {
      if (!chapterIds.has(key)) errors.push(`chapterStudyPaths has unknown chapter: ${key}`);
    }
    for (const chapter of chapters) {
      const path = chapterStudyPaths[chapter.id];
      if (!Array.isArray(path) || path.length === 0) {
        errors.push(`chapter ${chapter.id} needs a non-empty study path`);
        continue;
      }
      const expected = nodes.filter((node) => node.chapterId === chapter.id).map((node) => node.id);
      if (path.length !== expected.length || new Set(path).size !== path.length || path.some((id) => !expected.includes(id))) {
        errors.push(`chapter ${chapter.id} study path must cover every chapter node exactly once`);
      }
    }
  }

  if (coverageExceptions !== undefined) {
    if (!Array.isArray(coverageExceptions)) errors.push('coverageExceptions must be an array');
    else {
      const coveredSections = new Set(nodes.flatMap((node) => typeof node.section === 'string' ? node.section.split('/').map((part) => part.trim()) : []));
      const exceptionSections = new Set();
      for (const exception of coverageExceptions) {
        if (!isNonEmptyString(exception?.section) || exception?.status !== '需核对' || exceptionSections.has(exception.section) || coveredSections.has(exception.section)) {
          errors.push(`invalid coverage exception: ${exception?.section ?? '(missing)'}`);
        }
        exceptionSections.add(exception?.section);
      }
      for (const [chapterNumber, lastSection] of Object.entries(REQUIRED_SECTION_ENDS)) {
        for (let number = 1; number <= lastSection; number += 1) {
          const section = `${chapterNumber}-${number}`;
          if (!coveredSections.has(section) && !exceptionSections.has(section)) errors.push(`section ${section} has no node or review exception`);
        }
      }
    }
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
