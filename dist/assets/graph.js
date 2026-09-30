const SVG_NS = 'http://www.w3.org/2000/svg';
const ROUTE_WIDTH = 320;
const ROUTE_STEP = 112;
const CHAPTER_FOCUS_HEIGHT = 700;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const shortTitle = (value, max = 8) => {
  const title = String(value ?? '');
  return [...title].length > max ? `${[...title].slice(0, max).join('')}…` : title;
};

function routeLayout(routeNodes) {
  return {
    width: ROUTE_WIDTH,
    height: Math.max(260, 170 + Math.max(0, routeNodes.length - 1) * ROUTE_STEP),
    positions: new Map(routeNodes.map((node, index) => [node.id, { x: ROUTE_WIDTH / 2, y: 85 + index * ROUTE_STEP }])),
  };
}

const edgeStyles = new Map([
  ['先修', { color: 'var(--plot-green, #24664F)', dash: '' }],
  ['推导/解释', { color: 'var(--plot-blue, #275F91)', dash: '7 3' }],
  ['类比/迁移', { color: 'var(--plot-ochre, #8A5A12)', dash: '2 4' }],
  ['对比', { color: 'var(--plot-comparison, #96506B)', dash: '8 4 2 4' }],
  ['应用', { color: 'var(--plot-purple, #71539A)', dash: '3 3' }],
]);

const nodeTypeLabels = Object.freeze({
  application: '应用',
  classification: '分类',
  comparison: '比较',
  concept: '概念',
  definition: '定义',
  derivation: '推导',
  distribution: '分布',
  equation: '方程',
  experiment: '实验',
  extension: '扩展',
  instrument: '仪器',
  law: '定律',
  method: '方法',
  model: '模型',
  phenomenon: '现象',
  principle: '原理',
  process: '过程',
  representation: '表示',
  theory: '理论',
});

function chapterLayout(chapter, index, columns = 4, rowStep = 500) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  return { x: 36 + column * 430, y: 34 + row * rowStep, column, row };
}

function graphLayout(root, chapterCount) {
  const measured = root.clientWidth || root.getBoundingClientRect?.().width || 0;
  const columns = !measured || measured >= 1100 ? 4 : measured >= 600 ? 2 : 1;
  return { columns, width: 36 + columns * 430, height: Math.ceil(chapterCount / columns) * 230 + 20 };
}

function dispatchSelection(root, id) {
  const EventConstructor = root.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  if (EventConstructor && typeof root.dispatchEvent === 'function') {
    root.dispatchEvent(new EventConstructor('physics-node-select', { detail: { id } }));
  }
}

export function renderGraph({ root, nodes = [], edges = [], chapters = [], filters = {}, selectedId = null, routeIds = [] }) {
  if (!root) throw new TypeError('renderGraph requires a root element.');
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const chapterList = chapters.length ? chapters : [...new Map(nodes.map((node) => [node.chapterId, {
    id: node.chapterId,
    number: Number(String(node.chapterId).replace(/^ch-/, '')),
    title: `第 ${String(node.chapterId).replace(/^ch-/, '')} 章`,
  }])).values()];
  let fullLayout = graphLayout(root, chapterList.length);
  const positionById = new Map();
  function positionChapters() {
    positionById.clear();
    for (const [chapterIndex, chapter] of chapterList.entries()) {
      const chapterNodes = nodes.filter((node) => node.chapterId === chapter.id);
      const origin = chapterLayout(chapter, chapterIndex, fullLayout.columns);
      chapterNodes.forEach((node, index) => {
        const column = index % 4;
        const row = Math.floor(index / 4);
        positionById.set(node.id, { x: origin.x + 55 + column * 82, y: origin.y + 91 + row * 74, row, origin, chapter });
      });
    }
  }
  positionChapters();

  let currentFilters = { ...filters };
  let currentSelectedId = selectedId;
  let route = [...routeIds];
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pointer = null;
  const activePointers = new Map();
  let suppressClick = false;

  function svgPoint(clientX, clientY) {
    const svg = root.querySelector('.route-graph');
    const matrix = svg?.getScreenCTM?.()?.inverse?.();
    if (matrix) {
      if (typeof matrix.transformPoint === 'function') return matrix.transformPoint({ x: clientX, y: clientY });
      if (typeof svg.createSVGPoint === 'function') {
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        return point.matrixTransform(matrix);
      }
      return { x: matrix.a * clientX + matrix.c * clientY + matrix.e, y: matrix.b * clientX + matrix.d * clientY + matrix.f };
    }
    const bounds = svg?.getBoundingClientRect?.();
    const viewBox = svg?.viewBox?.baseVal;
    return { x: (clientX - (bounds?.left ?? 0)) * (viewBox?.width ?? (currentFilters.routeOnly ? ROUTE_WIDTH : fullLayout.width)) / (bounds?.width || 1),
      y: (clientY - (bounds?.top ?? 0)) * (viewBox?.height ?? (currentFilters.routeOnly ? 260 : fullLayout.height)) / (bounds?.height || 1) };
  }

  function updateTransform() {
    root.querySelector('.graph-world')?.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
  }

  function updateLabels() {
    const svg = root.querySelector('.route-graph');
    const matrix = svg?.getScreenCTM?.();
    const viewportScale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
    const scale = Math.max(0.01, viewportScale * zoom);
    const overview = !currentFilters.routeOnly && !currentFilters.chapterId;
    for (const title of root.querySelectorAll('.graph-node-title')) {
      const node = title.closest('.graph-node');
      title.style.display = '';
      title.style.fontSize = `${16 / scale}px`;
      title.style.pointerEvents = 'auto';
      if (node) {
        node.style.opacity = '';
        node.style.pointerEvents = '';
      }
    }
    for (const section of root.querySelectorAll('.graph-node-section')) {
      section.style.display = overview ? 'none' : '';
      section.style.fontSize = `${12 / scale}px`;
    }
    for (const chapter of root.querySelectorAll('.chapter-title')) chapter.style.fontSize = `${16 / scale}px`;
    for (const count of root.querySelectorAll('.chapter-count')) count.style.fontSize = `${12 / scale}px`;
    for (const hit of root.querySelectorAll('.graph-node-hit')) {
      const size = Math.max(56, 46 / scale);
      hit.setAttribute('x', `${-size / 2}`);
      hit.setAttribute('y', `${-size / 2}`);
      hit.setAttribute('width', `${size}`);
      hit.setAttribute('height', `${size}`);
      hit.style.pointerEvents = overview ? 'none' : '';
    }
  }

  const visibleNodes = () => nodes.filter((node) => {
    if (currentFilters.routeOnly && !route.includes(node.id)) return false;
    const searchIds = currentFilters.searchIds;
    if (searchIds && !(searchIds instanceof Set ? searchIds.has(node.id) : searchIds.includes?.(node.id))) return false;
    if (currentFilters.chapterId && node.chapterId !== currentFilters.chapterId) return false;
    if (currentFilters.type && currentFilters.type !== 'all' && node.type !== currentFilters.type) return false;
    if (currentFilters.level && currentFilters.level !== 'all' && node.level !== currentFilters.level) return false;
    if (currentFilters.status && currentFilters.status !== 'all') {
      const status = currentFilters.progress?.[node.id] ?? 'new';
      if (status !== currentFilters.status) return false;
    }
    return true;
  });

  function captureFocus() {
    const active = root.ownerDocument?.activeElement;
    if (!active || !root.contains?.(active)) return null;
    for (const [selector, attribute] of [
      ['.graph-node[data-node-id]', 'data-node-id'],
      ['.graph-node-list[data-node-id]', 'data-node-id'],
      ['.chapter-cluster[data-chapter-id]', 'data-chapter-id'],
      ['select[data-filter]', 'data-filter'],
      ['[data-zoom]', 'data-zoom'],
    ]) {
      if (active.matches?.(selector)) return { selector, attribute, value: active.getAttribute(attribute) };
    }
    return null;
  }

  function restoreFocus(descriptor) {
    if (!descriptor) return;
    const replacement = [...root.querySelectorAll(descriptor.selector)]
      .find((element) => element.getAttribute(descriptor.attribute) === descriptor.value);
    replacement?.focus?.({ preventScroll: true });
  }

  function render() {
    const focusDescriptor = captureFocus();
    const nodeIndexOpen = root.querySelector('.graph-node-index')?.open === true;
    const advancedFiltersOpen = root.querySelector('#advanced-filters')?.open === true;
    const shown = visibleNodes();
    const visibleIds = new Set(shown.map((node) => node.id));
    const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
    const routeNodes = currentFilters.routeOnly ? route.filter((id) => visibleIds.has(id)).map((id) => nodeById.get(id)).filter(Boolean) : [];
    const { width: routeWidth, height: routeHeight, positions: routePositions } = routeLayout(routeNodes);
    const activePositions = currentFilters.routeOnly ? routePositions : positionById;
    const overview = !currentFilters.routeOnly && !currentFilters.chapterId;
    const chapterRepresentative = new Map();
    for (const id of route) {
      const chapterId = nodeById.get(id)?.chapterId;
      if (chapterId && !chapterRepresentative.has(chapterId)) chapterRepresentative.set(chapterId, id);
    }
    const selectedChapter = nodeById.get(currentSelectedId)?.chapterId;
    if (selectedChapter) chapterRepresentative.set(selectedChapter, currentSelectedId);
    const chapterMarkup = chapterList.map((chapter, index) => {
      const origin = chapterLayout(chapter, index, fullLayout.columns, overview ? 230 : 500);
      const chapterNodes = shown.filter((node) => node.chapterId === chapter.id);
      if (overview) {
        const representative = chapterNodes.find((node) => node.id === chapterRepresentative.get(chapter.id)) ?? chapterNodes[0];
        return `<g class="chapter-cluster chapter-overview" role="button" tabindex="0" data-chapter-id="${escapeHtml(chapter.id)}" aria-label="查看第 ${escapeHtml(chapter.number)} 章 ${escapeHtml(chapter.title)}的知识点">
          <rect class="chapter-frame" x="${origin.x}" y="${origin.y}" width="394" height="202" rx="14" />
          <text class="chapter-title" x="${origin.x + 18}" y="${origin.y + 30}">第 ${escapeHtml(chapter.number)} 章 · ${escapeHtml(chapter.title)}</text>
          ${representative ? `<g class="graph-node${representative.id === currentSelectedId ? ' is-selected' : ''}" transform="translate(${origin.x + 197} ${origin.y + 93})" role="button" tabindex="0" aria-label="${escapeHtml(representative.title)}，第 ${escapeHtml(chapter.number)} 章代表知识点" data-node-id="${escapeHtml(representative.id)}" data-node-index="${nodes.indexOf(representative)}" data-chapter-id="${escapeHtml(chapter.id)}">
            <title>${escapeHtml(representative.title)}</title><rect class="graph-node-hit" x="-40" y="-12" width="80" height="56" fill="transparent" /><circle r="10" class="node-orbit"/><circle r="4" class="node-core"/><text class="graph-node-title" y="29">${escapeHtml(shortTitle(representative.title, 12))}</text>
          </g>` : ''}
          <text class="chapter-count" x="${origin.x + 197}" y="${origin.y + 177}" text-anchor="middle">${chapterNodes.length} 个知识点 · 点击查看关系</text>
        </g>`;
      }
      const lastRow = chapterNodes.reduce((maximum, node) => Math.max(maximum, positionById.get(node.id)?.row ?? -1), -1);
      const frameHeight = Math.max(374, lastRow < 0 ? 374 : 144 + lastRow * 74);
      return `<g class="chapter-cluster" role="button" tabindex="0" data-chapter-id="${escapeHtml(chapter.id)}" aria-label="查看第 ${escapeHtml(chapter.number)} 章 ${escapeHtml(chapter.title)}的知识点">
        <rect class="chapter-frame" x="${origin.x}" y="${origin.y}" width="394" height="${frameHeight}" rx="14" />
        <text class="chapter-title" x="${origin.x + 18}" y="${origin.y + 28}">第 ${escapeHtml(chapter.number)} 章 · ${escapeHtml(chapter.title)}</text>
        ${chapterNodes.map((node) => {
          const position = positionById.get(node.id);
          const isSelected = node.id === currentSelectedId;
          const isRoute = route.includes(node.id);
          const status = currentFilters.progress?.[node.id] ?? 'new';
          const nodeIndex = nodes.indexOf(node);
          return `<g class="graph-node${isSelected ? ' is-selected' : ''}${isRoute ? ' is-on-route' : ''}" transform="translate(${position.x} ${position.y})" role="button" tabindex="0" aria-label="${escapeHtml(node.title)}，第 ${escapeHtml(chapter.number)} 章，${node.level === 'core' ? '核心' : '扩展'}，${escapeHtml(status === 'mastered' ? '已掌握' : status === 'review' ? '待复习' : '未学习')}" data-node-id="${escapeHtml(node.id)}" data-node-index="${nodeIndex}" data-chapter-id="${escapeHtml(node.chapterId)}">
            <title>${escapeHtml(node.title)} · ${escapeHtml(node.section)} · ${escapeHtml(node.summary)}</title>
            <rect class="graph-node-hit" x="-40" y="-12" width="80" height="56" fill="transparent" />
            <circle r="9" class="node-orbit"/><circle r="4" class="node-core"/>
            <text class="graph-node-title" y="25">${escapeHtml(shortTitle(node.title))}</text>
            <text class="graph-node-section" y="38">${escapeHtml(node.section)}</text>
          </g>`;
        }).join('')}
      </g>`;
    }).join('');

    const compactRouteMarkup = routeNodes.map((node, index) => {
      const position = routePositions.get(node.id);
      const chapter = chapterList.find(({ id }) => id === node.chapterId);
      const isSelected = node.id === currentSelectedId;
      const status = currentFilters.progress?.[node.id] ?? 'new';
      return `<g class="route-station" aria-label="路线第 ${index + 1} 站，第 ${escapeHtml(chapter?.number)} 章">
        <text class="route-chapter-tag" x="${position.x}" y="${position.y - 39}" text-anchor="middle">第 ${escapeHtml(chapter?.number)} 章 · ${escapeHtml(node.section)}</text>
        <g class="graph-node${isSelected ? ' is-selected' : ''} is-on-route" transform="translate(${position.x} ${position.y})" role="button" tabindex="0" aria-label="${escapeHtml(node.title)}，路线第 ${index + 1} 站，${node.level === 'core' ? '核心' : '扩展'}，${escapeHtml(status === 'mastered' ? '已掌握' : status === 'review' ? '待复习' : '未学习')}" data-node-id="${escapeHtml(node.id)}" data-node-index="${nodes.indexOf(node)}" data-chapter-id="${escapeHtml(node.chapterId)}">
          <title>${escapeHtml(node.title)} · ${escapeHtml(node.summary)}</title>
          <rect class="graph-node-hit" x="-60" y="-14" width="120" height="62" fill="transparent" />
          <circle r="9" class="node-orbit"/><circle r="4" class="node-core"/>
          <text class="graph-node-title" y="28">${escapeHtml(shortTitle(node.title))}</text>
          <text class="graph-node-section" y="43">${escapeHtml(node.level === 'core' ? '核心节点' : '扩展节点')}</text>
        </g>
      </g>`;
    }).join('');

    const edgeMarkup = (overview ? [] : visibleEdges).map((edge, index) => {
      const from = activePositions.get(edge.source);
      const to = activePositions.get(edge.target);
      if (!from || !to) return '';
      const style = edgeStyles.get(edge.type) ?? { color: 'var(--plot-axis, #637067)', dash: '3 4' };
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const bend = Math.max(-36, Math.min(36, (to.x - from.x) * 0.12));
      const path = `M ${from.x} ${from.y} C ${midX + bend} ${from.y}, ${midX - bend} ${to.y}, ${to.x} ${to.y}`;
      const onRoute = route.some((id, routeIndex) => id === edge.source && route[routeIndex + 1] === edge.target);
      return `<g class="graph-edge${onRoute ? ' is-route-edge' : ''}" data-edge-index="${index}" data-type="${escapeHtml(edge.type)}">
        <path d="${path}" fill="none" stroke="${style.color}" stroke-width="1.15"${style.dash ? ` stroke-dasharray="${style.dash}"` : ''} marker-end="url(#edge-arrow)"/>
        <title>${escapeHtml(edge.type)}：${escapeHtml(edge.label)}（${escapeHtml(nodeById.get(edge.source)?.title)} → ${escapeHtml(nodeById.get(edge.target)?.title)}）</title>
        <text class="graph-edge-label" x="${midX}" y="${midY - 3}" text-anchor="middle">${escapeHtml(edge.type)}</text>
      </g>`;
    }).join('');

    const routePoints = route.map((id) => activePositions.get(id)).filter(Boolean);
    const routePath = routePoints.length > 1 ? `M ${routePoints.map(({ x, y }, index) => `${index ? 'L ' : ''}${x} ${y}`).join(' ')}` : '';
    const routeCount = route.filter((id) => nodeById.has(id)).length;
    const nodeIndex = chapterList.map((chapter) => {
      const chapterNodes = shown.filter((node) => node.chapterId === chapter.id);
      if (!chapterNodes.length) return '';
      return `<section class="graph-index-chapter"><h3>第 ${escapeHtml(chapter.number)} 章 · ${escapeHtml(chapter.title)}</h3><ul>${chapterNodes.map((node) => `<li><button type="button" class="graph-node-list${node.id === currentSelectedId ? ' is-selected' : ''}" data-node-id="${escapeHtml(node.id)}">${escapeHtml(node.title)} <span>${escapeHtml(node.section)} · ${node.level === 'core' ? '核心' : '扩展'}</span></button></li>`).join('')}</ul></section>`;
    }).join('');

    const selectionHidden = currentSelectedId && nodeById.has(currentSelectedId) && !visibleIds.has(currentSelectedId);
    root.innerHTML = `<div class="graph-tools"><details class="advanced-filters" id="advanced-filters"${advancedFiltersOpen ? ' open' : ''}><summary>高级筛选</summary><div class="graph-controls" aria-label="图谱筛选">
      <label>章节<select data-filter="chapterId" aria-label="按章节筛选"><option value="">全部章节</option>${chapterList.map((chapter) => `<option value="${escapeHtml(chapter.id)}"${currentFilters.chapterId === chapter.id ? ' selected' : ''}>第 ${escapeHtml(chapter.number)} 章 · ${escapeHtml(chapter.title)}</option>`).join('')}</select></label>
      <label>类型<select data-filter="type" aria-label="按知识类型筛选"><option value="all">全部类型</option>${[...new Set(nodes.map((node) => node.type))].map((type) => `<option value="${escapeHtml(type)}"${currentFilters.type === type ? ' selected' : ''}>${escapeHtml(nodeTypeLabels[type] ?? '其他知识类型')}</option>`).join('')}</select></label>
      <label>层级<select data-filter="level" aria-label="按核心或扩展筛选"><option value="all">核心与扩展</option><option value="core"${currentFilters.level === 'core' ? ' selected' : ''}>核心</option><option value="extension"${currentFilters.level === 'extension' ? ' selected' : ''}>扩展</option></select></label>
      <label>进度<select data-filter="status" aria-label="按学习进度筛选"><option value="all">全部进度</option><option value="new"${currentFilters.status === 'new' ? ' selected' : ''}>未学习</option><option value="review"${currentFilters.status === 'review' ? ' selected' : ''}>待复习</option><option value="mastered"${currentFilters.status === 'mastered' ? ' selected' : ''}>已掌握</option></select></label>
      </div></details><div class="zoom-controls" aria-label="图谱缩放"><button type="button" data-zoom="out" aria-label="缩小图谱">−</button><button type="button" data-zoom="in" aria-label="放大图谱">+</button><button type="button" data-zoom="reset">重置视图</button></div>
    </div>
    <p class="graph-count" aria-live="polite">当前显示 ${shown.length} 个知识点、${visibleEdges.length} 条关系；速学路线 ${routeCount} 站。${selectionHidden ? '当前所选知识点不在筛选结果中。' : ''}</p>
    ${!shown.length ? '<p class="graph-empty" role="status">当前筛选没有匹配的知识点。<button type="button" data-action="clear-filters">清除筛选</button></p>' : ''}
    ${selectionHidden ? '<p class="graph-selection-hidden">当前选中节点暂不可见。<button type="button" data-action="focus-selected">定位当前节点</button></p>' : ''}
    <div class="graph-canvas${currentFilters.routeOnly ? ' route-canvas' : currentFilters.chapterId ? ' chapter-focus-canvas' : ' graph-overview-canvas'}" style="aspect-ratio:${currentFilters.routeOnly ? routeWidth : fullLayout.width}/${currentFilters.routeOnly ? routeHeight : currentFilters.chapterId ? CHAPTER_FOCUS_HEIGHT : fullLayout.height}" aria-label="完整知识图谱，可拖动平移并用滚轮缩放">
      <svg class="route-graph${currentFilters.routeOnly ? ' route-only-graph' : ''}" viewBox="0 0 ${currentFilters.routeOnly ? routeWidth : fullLayout.width} ${currentFilters.routeOnly ? routeHeight : currentFilters.chapterId ? CHAPTER_FOCUS_HEIGHT : fullLayout.height}" role="group" aria-labelledby="graph-title graph-description" preserveAspectRatio="xMidYMid meet">
        <title id="graph-title">第 9 至 16 章物理知识关系图</title><desc id="graph-description">节点按章节成组；每个节点都可用键盘选择，连线有方向、类型和文字说明。</desc>
        <defs><marker id="edge-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--plot-axis, #637067)"/></marker></defs>
        <g class="graph-world" transform="translate(${panX} ${panY}) scale(${zoom})">
          ${edgeMarkup}${overview ? '' : `<path class="route-trace" d="${routePath}" aria-hidden="true"/>`}${currentFilters.routeOnly ? compactRouteMarkup : chapterMarkup}
        </g>
      </svg>
    </div>
    <p class="graph-legend">${overview ? '<span>先选章节，再查看知识点与关系连线</span>' : '<span>实线/不同虚线与文字表示关系类型</span><span>青绿色流迹表示当前速学路线</span>'}</p>
    <details class="graph-node-index"${nodeIndexOpen ? ' open' : ''}><summary>按章节键盘浏览全部知识点（${shown.length}）</summary><div class="graph-index-grid">${nodeIndex || '<p>当前筛选没有匹配的知识点。</p>'}</div></details>`;
    updateTransform();
    updateLabels();
    restoreFocus(focusDescriptor);
  }

  function selectNode(id) {
    if (!nodeById.has(id)) return false;
    if (currentSelectedId === id) return true;
    currentSelectedId = id;
    render();
    dispatchSelection(root, id);
    return true;
  }

  function setFilters(nextFilters = {}) {
    currentFilters = { ...currentFilters, ...nextFilters };
    if (Object.hasOwn(nextFilters, 'chapterId') && nextFilters.chapterId) fitVisible();
    else render();
    return { ...currentFilters };
  }

  function fitVisible() {
    const shown = visibleNodes();
    if (!shown.length) { render(); return false; }
    const layout = currentFilters.routeOnly ? routeLayout(route.map((id) => shown.find((node) => node.id === id)).filter(Boolean)) : null;
    const positions = currentFilters.routeOnly ? layout.positions : positionById;
    const points = shown.map((node) => positions.get(node.id)).filter(Boolean);
    if (!points.length) { render(); return false; }
    const minX = Math.min(...points.map(({ x }) => x));
    const maxX = Math.max(...points.map(({ x }) => x));
    const minY = Math.min(...points.map(({ y }) => y));
    const maxY = Math.max(...points.map(({ y }) => y));
    const width = currentFilters.routeOnly ? layout.width : fullLayout.width;
    const height = currentFilters.routeOnly ? layout.height : currentFilters.chapterId ? CHAPTER_FOCUS_HEIGHT : fullLayout.height;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min((width - 150) / Math.max(120, maxX - minX), (height - 130) / Math.max(120, maxY - minY))));
    panX = width / 2 - zoom * (minX + maxX) / 2;
    panY = height / 2 - zoom * (minY + maxY) / 2;
    render();
    return true;
  }

  function focusNode(id) {
    const node = nodeById.get(id);
    if (!node) return false;
    currentFilters = { ...currentFilters, routeOnly: false, searchIds: null, chapterId: node.chapterId, type: 'all', level: 'all', status: 'all' };
    currentSelectedId = id;
    fitVisible();
    const position = positionById.get(id);
    const center = { x: fullLayout.width / 2, y: CHAPTER_FOCUS_HEIGHT / 2 };
    panX = center.x - zoom * position.x;
    panY = center.y - zoom * position.y;
    updateTransform();
    return true;
  }

  function zoomBy(factor) {
    const amount = Number(factor);
    if (!Number.isFinite(amount) || amount <= 0) return zoom;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * amount));
    render();
    return zoom;
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    render();
  }

  const onClick = (event) => {
    if (suppressClick) { suppressClick = false; return; }
    const action = event.target.closest?.('[data-action]')?.getAttribute('data-action');
    if (action === 'clear-filters') { currentFilters = { ...currentFilters, routeOnly: false, searchIds: null, chapterId: null, type: 'all', level: 'all', status: 'all' }; fitVisible(); return; }
    if (action === 'focus-selected') { focusNode(currentSelectedId); return; }
    const nodeControl = event.target.closest?.('.graph-node[data-node-id], .graph-node-list[data-node-id]');
    if (nodeControl) {
      selectNode(nodeControl.getAttribute('data-node-id'));
      return;
    }
    const chapterControl = event.target.closest?.('.chapter-cluster[data-chapter-id]');
    if (chapterControl) { setFilters({ chapterId: chapterControl.getAttribute('data-chapter-id') }); return; }
    const zoomControl = event.target.closest?.('[data-zoom]');
    if (!zoomControl) return;
    if (zoomControl.dataset.zoom === 'in') zoomBy(1.2);
    else if (zoomControl.dataset.zoom === 'out') zoomBy(1 / 1.2);
    else resetView();
  };
  const onKeyDown = (event) => {
    const nodeControl = event.target.closest?.('.graph-node[data-node-id]');
    if (nodeControl && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectNode(nodeControl.getAttribute('data-node-id'));
      return;
    }
    const chapterControl = event.target.closest?.('.chapter-cluster[data-chapter-id]');
    if (chapterControl && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setFilters({ chapterId: chapterControl.getAttribute('data-chapter-id') });
    }
  };
  const onChange = (event) => {
    const control = event.target.closest?.('select[data-filter]');
    if (!control) return;
    const filterName = control.getAttribute('data-filter');
    setFilters({ [filterName]: control.value || (filterName === 'chapterId' ? null : 'all') });
  };
  const onPointerDown = (event) => {
    if (!event.target.closest?.('.graph-canvas')) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size > 1) {
      const [first, second] = [...activePointers.values()];
      pointer = { distance: Math.hypot(second.x - first.x, second.y - first.y) };
    } else {
      pointer = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
    }
    if (!event.target.closest?.('.graph-node, .chapter-cluster')) event.target.closest?.('.graph-canvas')?.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size > 1) {
      const [first, second] = [...activePointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (pointer?.distance > 0 && distance > 0) {
        const anchor = svgPoint((first.x + second.x) / 2, (first.y + second.y) / 2);
        const before = zoom;
        zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * distance / pointer.distance));
        panX += (anchor.x - panX) * (1 - zoom / before);
        panY += (anchor.y - panY) * (1 - zoom / before);
      }
      pointer = { distance };
      updateTransform();
      updateLabels();
      return;
    }
    if (!pointer || pointer.distance !== undefined) {
      const [point] = activePointers.values();
      pointer = { ...point };
    }
    if (!pointer.dragged && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 4) return;
    if (!pointer.dragged) event.target.closest?.('.graph-canvas')?.setPointerCapture?.(event.pointerId);
    const previous = svgPoint(pointer.x, pointer.y);
    const next = svgPoint(event.clientX, event.clientY);
    panX += next.x - previous.x;
    panY += next.y - previous.y;
    pointer = { ...pointer, x: event.clientX, y: event.clientY, dragged: true };
    suppressClick = true;
    updateTransform();
  };
  const onPointerEnd = (event) => {
    activePointers.delete(event.pointerId);
    event.target?.closest?.('.graph-canvas')?.releasePointerCapture?.(event.pointerId);
    if (activePointers.size === 1) {
      const [point] = activePointers.values();
      pointer = { ...point, startX: point.x, startY: point.y };
    } else {
      pointer = null;
    }
  };
  const onWheel = (event) => {
    if (!event.target.closest?.('.graph-canvas')) return;
    event.preventDefault();
    const anchor = svgPoint(event.clientX, event.clientY);
    const before = zoom;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
    panX += (anchor.x - panX) * (1 - zoom / before);
    panY += (anchor.y - panY) * (1 - zoom / before);
    render();
  };

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('change', onChange);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerEnd);
  root.addEventListener('pointercancel', onPointerEnd);
  root.addEventListener('wheel', onWheel, { passive: false });
  render();
  const ResizeObserverClass = root.ownerDocument?.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
  const resizeObserver = typeof ResizeObserverClass === 'function' ? new ResizeObserverClass(() => {
    const next = graphLayout(root, chapterList.length);
    if (next.columns === fullLayout.columns) return;
    fullLayout = next;
    positionChapters();
    zoom = 1;
    panX = 0;
    panY = 0;
    if (currentFilters.chapterId) fitVisible();
    else render();
  }) : null;
  resizeObserver?.observe(root);

  return {
    selectNode,
    setFilters,
    zoomBy,
    focusNode,
    fitVisible,
    destroy() {
      resizeObserver?.disconnect();
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('change', onChange);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerEnd);
      root.removeEventListener('pointercancel', onPointerEnd);
      root.removeEventListener('wheel', onWheel);
      root.innerHTML = '';
    },
  };
}
