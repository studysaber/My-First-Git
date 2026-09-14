const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_WIDTH = 1760;
const VIEW_HEIGHT = 920;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const shortTitle = (value, max = 8) => {
  const title = String(value ?? '');
  return [...title].length > max ? `${[...title].slice(0, max).join('')}…` : title;
};

const edgeStyles = new Map([
  ['先修', { color: '#73d9c7', dash: '' }],
  ['推导/解释', { color: '#82b6ff', dash: '7 3' }],
  ['类比/迁移', { color: '#e7c889', dash: '2 4' }],
  ['对比', { color: '#e79ab3', dash: '8 4 2 4' }],
  ['应用', { color: '#b9a1ff', dash: '3 3' }],
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

function chapterLayout(chapter, index) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 36 + column * 430, y: 34 + row * 430, column, row };
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
  const positionById = new Map();
  for (const [chapterIndex, chapter] of chapterList.entries()) {
    const chapterNodes = nodes.filter((node) => node.chapterId === chapter.id);
    const origin = chapterLayout(chapter, chapterIndex);
    chapterNodes.forEach((node, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      positionById.set(node.id, { x: origin.x + 55 + column * 82, y: origin.y + 91 + row * 74, row, origin, chapter });
    });
  }

  let currentFilters = { ...filters };
  let currentSelectedId = selectedId;
  let route = [...routeIds];
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pointer = null;
  const activePointers = new Map();

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
    const shown = visibleNodes();
    const visibleIds = new Set(shown.map((node) => node.id));
    const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
    const routeNodes = currentFilters.routeOnly ? route.filter((id) => visibleIds.has(id)).map((id) => nodeById.get(id)) : [];
    const routeColumns = Math.max(1, Math.min(6, routeNodes.length));
    const routeWidth = 160 + (routeColumns - 1) * 140;
    const routePositions = new Map(routeNodes.map((node, index) => [node.id, {
      x: 80 + (index % 6) * 140,
      y: 155 + Math.floor(index / 6) * 185,
    }]));
    const activePositions = currentFilters.routeOnly ? routePositions : positionById;
    const chapterMarkup = chapterList.map((chapter, index) => {
      const origin = chapterLayout(chapter, index);
      const chapterNodes = shown.filter((node) => node.chapterId === chapter.id);
      const lastRow = chapterNodes.reduce((maximum, node) => Math.max(maximum, positionById.get(node.id)?.row ?? -1), -1);
      const frameHeight = Math.max(374, lastRow < 0 ? 374 : 144 + lastRow * 74);
      return `<g class="chapter-cluster" aria-label="第 ${escapeHtml(chapter.number)} 章 ${escapeHtml(chapter.title)}">
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
          <circle r="9" class="node-orbit"/><circle r="4" class="node-core"/>
          <text class="graph-node-title" y="28">${escapeHtml(shortTitle(node.title))}</text>
          <text class="graph-node-section" y="43">${escapeHtml(node.level === 'core' ? '核心节点' : '扩展节点')}</text>
        </g>
      </g>`;
    }).join('');

    const edgeMarkup = visibleEdges.map((edge, index) => {
      const from = activePositions.get(edge.source);
      const to = activePositions.get(edge.target);
      if (!from || !to) return '';
      const style = edgeStyles.get(edge.type) ?? { color: '#9eacc0', dash: '3 4' };
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

    root.innerHTML = `<div class="graph-controls" aria-label="图谱筛选与缩放">
      <label>章节<select data-filter="chapterId" aria-label="按章节筛选"><option value="">全部章节</option>${chapterList.map((chapter) => `<option value="${escapeHtml(chapter.id)}"${currentFilters.chapterId === chapter.id ? ' selected' : ''}>第 ${escapeHtml(chapter.number)} 章 · ${escapeHtml(chapter.title)}</option>`).join('')}</select></label>
      <label>类型<select data-filter="type" aria-label="按知识类型筛选"><option value="all">全部类型</option>${[...new Set(nodes.map((node) => node.type))].map((type) => `<option value="${escapeHtml(type)}"${currentFilters.type === type ? ' selected' : ''}>${escapeHtml(nodeTypeLabels[type] ?? '其他知识类型')}</option>`).join('')}</select></label>
      <label>层级<select data-filter="level" aria-label="按核心或扩展筛选"><option value="all">核心与扩展</option><option value="core"${currentFilters.level === 'core' ? ' selected' : ''}>核心</option><option value="extension"${currentFilters.level === 'extension' ? ' selected' : ''}>扩展</option></select></label>
      <label>进度<select data-filter="status" aria-label="按学习进度筛选"><option value="all">全部进度</option><option value="new"${currentFilters.status === 'new' ? ' selected' : ''}>未学习</option><option value="review"${currentFilters.status === 'review' ? ' selected' : ''}>待复习</option><option value="mastered"${currentFilters.status === 'mastered' ? ' selected' : ''}>已掌握</option></select></label>
      <div class="zoom-controls" aria-label="图谱缩放"><button type="button" data-zoom="out" aria-label="缩小图谱">−</button><button type="button" data-zoom="in" aria-label="放大图谱">+</button><button type="button" data-zoom="reset">重置视图</button></div>
    </div>
    <p class="graph-count" aria-live="polite">当前显示 ${shown.length} 个知识点、${visibleEdges.length} 条关系；速学路线 ${routeCount} 站。</p>
    <div class="graph-canvas" aria-label="完整知识图谱，可拖动平移并用滚轮缩放">
      <svg class="route-graph${currentFilters.routeOnly ? ' route-only-graph' : ''}" viewBox="0 0 ${currentFilters.routeOnly ? routeWidth : VIEW_WIDTH} ${currentFilters.routeOnly ? 470 : VIEW_HEIGHT}" role="group" aria-labelledby="graph-title graph-description" preserveAspectRatio="xMidYMid meet">
        <title id="graph-title">第 9 至 16 章物理知识关系图</title><desc id="graph-description">节点按章节成组；每个节点都可用键盘选择，连线有方向、类型和文字说明。</desc>
        <defs><marker id="edge-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#91a9c3"/></marker></defs>
        <g class="graph-world" transform="translate(${panX} ${panY}) scale(${zoom})">
          ${edgeMarkup}<path class="route-trace" d="${routePath}" aria-hidden="true"/>${currentFilters.routeOnly ? compactRouteMarkup : chapterMarkup}
        </g>
      </svg>
    </div>
    <p class="graph-legend"><span>实线/不同虚线与文字表示关系类型</span><span>青绿色流迹表示当前速学路线</span></p>
    <details class="graph-node-index"${nodeIndexOpen ? ' open' : ''}><summary>按章节键盘浏览全部知识点（${shown.length}）</summary><div class="graph-index-grid">${nodeIndex || '<p>当前筛选没有匹配的知识点。</p>'}</div></details>`;
    root.querySelector('.graph-world')?.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
    restoreFocus(focusDescriptor);
  }

  function selectNode(id) {
    if (!nodeById.has(id)) return false;
    currentSelectedId = id;
    render();
    dispatchSelection(root, id);
    return true;
  }

  function setFilters(nextFilters = {}) {
    currentFilters = { ...currentFilters, ...nextFilters };
    render();
    return { ...currentFilters };
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
    const nodeControl = event.target.closest?.('.graph-node[data-node-id], .graph-node-list[data-node-id]');
    if (nodeControl) {
      selectNode(nodeControl.getAttribute('data-node-id'));
      return;
    }
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
    }
  };
  const onChange = (event) => {
    const control = event.target.closest?.('select[data-filter]');
    if (!control) return;
    const filterName = control.getAttribute('data-filter');
    setFilters({ [filterName]: control.value || (filterName === 'chapterId' ? null : 'all') });
  };
  const onPointerDown = (event) => {
    if (!event.target.closest?.('.graph-canvas') || event.target.closest?.('.graph-node')) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size > 1) {
      const [first, second] = [...activePointers.values()];
      pointer = { distance: Math.hypot(second.x - first.x, second.y - first.y) };
    } else {
      pointer = { x: event.clientX, y: event.clientY };
    }
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size > 1) {
      const [first, second] = [...activePointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (pointer?.distance > 0 && distance > 0) zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * distance / pointer.distance));
      pointer = { distance };
      render();
      return;
    }
    if (!pointer || pointer.distance !== undefined) {
      const [point] = activePointers.values();
      pointer = { ...point };
    }
    const svg = root.querySelector('.route-graph');
    const bounds = svg?.getBoundingClientRect?.();
    const scaleX = bounds?.width ? VIEW_WIDTH / bounds.width : 1;
    const scaleY = bounds?.height ? VIEW_HEIGHT / bounds.height : 1;
    panX += (event.clientX - pointer.x) * scaleX / zoom;
    panY += (event.clientY - pointer.y) * scaleY / zoom;
    pointer = { x: event.clientX, y: event.clientY };
    render();
  };
  const onPointerEnd = (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size === 1) {
      const [point] = activePointers.values();
      pointer = { ...point };
    } else {
      pointer = null;
    }
  };
  const onWheel = (event) => {
    if (!event.target.closest?.('.graph-canvas')) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.08 : 1 / 1.08);
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

  return {
    selectNode,
    setFilters,
    zoomBy,
    destroy() {
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
