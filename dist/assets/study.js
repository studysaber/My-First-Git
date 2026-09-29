const STORAGE_KEY = 'physics-atlas-progress-v1';
const STATUSES = new Set(['new', 'review', 'mastered']);

const text = (value) => String(value ?? '');

export function searchKnowledge(nodes, query) {
  const needle = text(query).trim().toLocaleLowerCase();
  if (!needle || !Array.isArray(nodes)) return [];
  return nodes
    .filter((node) => [node.title, node.section, node.summary, node.formula, ...(node.keywords ?? [])]
      .some((value) => text(value).toLocaleLowerCase().includes(needle)))
    .sort((left, right) => text(left.title).localeCompare(text(right.title), 'zh-CN') || text(left.id).localeCompare(text(right.id)));
}

export function advanceRoute(route, currentNodeId) {
  const ids = Array.isArray(route?.nodeIds) ? route.nodeIds : [];
  if (!ids.length) return null;
  const index = ids.indexOf(currentNodeId);
  if (currentNodeId === null) return ids[0];
  return index < 0 ? null : ids[index + 1] ?? null;
}

export function getRouteState(route, selectedId, progress = {}) {
  const ids = Array.isArray(route?.nodeIds) ? route.nodeIds : [];
  const states = typeof progress?.getAll === 'function' ? progress.getAll() : progress;
  const done = ids.filter((id) => states?.[id] === 'mastered').length;
  const inRoute = ids.includes(selectedId);
  return {
    inRoute,
    done,
    total: ids.length,
    complete: ids.length > 0 && done === ids.length,
    nextUnfinishedId: inRoute ? ids.find((id) => states?.[id] !== 'mastered') ?? null : null,
  };
}

function appendSection(article, heading, content, className = '', kind = 'core') {
  const section = document.createElement('section');
  section.className = 'detail-section';
  section.setAttribute('data-detail-kind', kind);
  const title = document.createElement('h3');
  title.textContent = heading;
  section.append(title);
  if (Array.isArray(content)) {
    const list = document.createElement('ul');
    for (const item of content) list.append(item);
    section.append(list);
  } else {
    const paragraph = document.createElement('p');
    if (className) paragraph.className = className;
    paragraph.textContent = text(content) || '暂无补充说明。';
    section.append(paragraph);
  }
  article.append(section);
}

function relationItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'related-node';
    const id = typeof item === 'string' ? item : item?.id;
    if (id) button.setAttribute('data-node-id', id);
    button.textContent = typeof item === 'string' ? item : item?.title ?? id ?? '未知知识点';
    return button;
  });
}

export function renderNodeDetail(node, relations = {}, sources = []) {
  const article = document.createElement('article');
  article.className = 'node-detail';
  article.setAttribute('aria-label', `${text(node?.title)}知识详情`);
  const heading = document.createElement('h2');
  heading.textContent = text(node?.title) || '知识点详情';
  article.append(heading);

  const summarySection = document.createElement('section');
  summarySection.className = 'detail-section';
  summarySection.setAttribute('data-detail-kind', 'summary');
  const summaryHeading = document.createElement('h3');
  summaryHeading.textContent = '30 秒理解';
  const summary = document.createElement('p');
  summary.className = 'detail-summary';
  summary.textContent = text(node?.summary) || '暂无摘要。';
  summarySection.append(summaryHeading, summary);
  article.append(summarySection);
  appendSection(article, '核心公式', node?.formula, 'formula');
  if (node?.explanation) appendSection(article, '为什么成立', node.explanation);
  if (node?.workedExample) appendSection(article, '带数值走一遍', node.workedExample);
  appendSection(article, '变量与单位', node?.variables);
  appendSection(article, '适用条件', node?.conditions);
  appendSection(article, '容易出错', node?.pitfalls);
  appendSection(article, '题目怎么入手', node?.problemApproach);
  if (Array.isArray(node?.sourceRefs) && node.sourceRefs.length && Array.isArray(sources)) {
    const byId = new Map(sources.map((source) => [source.id, source]));
    const sourceItems = node.sourceRefs.map((id) => byId.get(id)).filter(Boolean).map((source) => {
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title;
      return link;
    });
    if (sourceItems.length) appendSection(article, '核对来源', sourceItems, '', 'source');
  }
  appendSection(article, '先修知识', relationItems(relations.prerequisites), '', 'relation');
  appendSection(article, '下一步', relationItems(relations.next ?? relations.successors), '', 'relation');
  return article;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProgress(value) {
  if (!isPlainObject(value)) return null;
  const entries = [];
  for (const [nodeId, status] of Object.entries(value)) {
    if (!nodeId || !STATUSES.has(status)) return null;
    entries.push([nodeId, status]);
  }
  return Object.fromEntries(entries);
}

export function createProgressStore(storage) {
  let storageUnavailable = !storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function';
  let memoryProgress = {};

  function read() {
    if (storageUnavailable) return { ...memoryProgress };
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw === null) return {};
      const payload = JSON.parse(raw);
      const progress = isPlainObject(payload) && payload.version === 1 ? normalizeProgress(payload.progress) : null;
      if (progress === null) {
        storageUnavailable = true;
        return { ...memoryProgress };
      }
      return progress;
    } catch {
      storageUnavailable = true;
      return { ...memoryProgress };
    }
  }

  function write(progress) {
    const ordered = Object.fromEntries(Object.entries(progress).sort(([left], [right]) => left.localeCompare(right)));
    if (storageUnavailable) {
      memoryProgress = ordered;
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, progress: ordered }));
      memoryProgress = ordered;
    } catch {
      storageUnavailable = true;
      memoryProgress = ordered;
    }
  }

  function parseImport(serialized, knownNodeIds) {
    let payload;
    try {
      payload = JSON.parse(serialized);
    } catch {
      throw new TypeError('进度文件格式无效，无法读取。');
    }
    if (!isPlainObject(payload) || payload.version !== 1 || !isPlainObject(payload.progress)) {
      throw new TypeError('进度文件结构不符合要求。');
    }
    const knownIds = knownNodeIds instanceof Set ? knownNodeIds : new Set(Array.isArray(knownNodeIds) ? knownNodeIds : []);
    const candidate = {};
    for (const [nodeId, status] of Object.entries(payload.progress)) {
      if (!knownIds.has(nodeId)) throw new TypeError('进度文件含有无法识别的知识点，未导入任何内容。');
      if (!STATUSES.has(status)) throw new TypeError('进度文件含有无效的学习状态，未导入任何内容。');
      candidate[nodeId] = status;
    }
    return candidate;
  }

  return {
    getAll() {
      return read();
    },
    setStatus(nodeId, status) {
      if (typeof nodeId !== 'string' || !nodeId.trim()) throw new TypeError('知识点标识不能为空。');
      if (!STATUSES.has(status)) throw new TypeError('学习状态必须为未开始、待复习或自评掌握。');
      const progress = read();
      progress[nodeId] = status;
      write(progress);
      return { ...progress };
    },
    getPersistenceState() {
      read();
      return storageUnavailable ? 'memory' : 'persistent';
    },
    clear() {
      memoryProgress = {};
      if (storageUnavailable) return;
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        storageUnavailable = true;
      }
    },
    exportJson() {
      const progress = Object.fromEntries(Object.entries(read()).sort(([left], [right]) => left.localeCompare(right)));
      return JSON.stringify({ version: 1, progress }, null, 2);
    },
    previewImportJson(serialized, knownNodeIds) {
      const candidate = parseImport(serialized, knownNodeIds);
      const current = read();
      const added = Object.keys(candidate).filter((id) => !(id in current)).length;
      const conflicts = Object.keys(candidate).filter((id) => id in current && candidate[id] !== current[id]).length;
      return { added, conflicts, imported: Object.keys(candidate).length, current: Object.keys(current).length };
    },
    importJson(serialized, knownNodeIds, { mode = 'merge' } = {}) {
      if (!['merge', 'replace'].includes(mode)) throw new TypeError('导入模式必须为合并或替换。');
      const candidate = parseImport(serialized, knownNodeIds);
      const result = mode === 'merge' ? { ...candidate, ...read() } : candidate;
      write(result);
      return { ...result };
    },
  };
}

export { STORAGE_KEY as progressStorageKey };
