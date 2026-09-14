import { assessment as assessmentSections, chapters, edges, nodes, routes } from './data/physics-data.js';
import { advanceRoute, createProgressStore, renderNodeDetail, searchKnowledge } from './study.js';
import { renderGraph } from './graph.js';
import { mountSimulation } from './simulations.js';
import { renderAssessment, renderChapter } from './assessment.js';

const previewRoute = {
  title: '从振动到光学',
  chapter: '第 9 章 · 振动',
  nodes: [
    { title: '简谐振动', subtitle: '周期运动', formula: 'x = A cos(ωt + φ)', summary: '用一个随时间往复变化的状态量描述理想振动。振幅决定范围，角频率决定快慢，相位决定初始状态。', note: '先看清位移、速度和加速度之间的相位关系，再把它们连到波的局部振动。' },
    { title: '振动合成', subtitle: '相位与叠加', formula: 'x = x₁ + x₂', summary: '同一位置的多个振动遵循叠加原理；相位差决定合振幅，频率接近时会出现拍。', note: '从振动叠加出发，下一步可以理解波的干涉与驻波。' },
    { title: '机械波', subtitle: '振动的传播', formula: 'y(x,t) = A cos(ωt − kx + φ)', summary: '波把振动状态从一处传到另一处，介质质点在平衡位置附近振动，能量随波传播。', note: '波的叠加带来干涉、驻波，也为光的波动现象建立直觉。' },
  ],
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function normalizeRoute(data) {
  const route = data?.routes?.[0];
  if (!route || !Array.isArray(data.nodes)) return previewRoute;
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const nodes = (route.nodeIds ?? []).slice(0, 3).map((id) => byId.get(id)).filter(Boolean).map((node) => ({
    title: node.title,
    subtitle: `第 ${String(node.chapterId).replace(/^ch-/, '')} 章 · ${node.section ?? node.type ?? '知识点'}`,
    formula: node.formula || '观察物理量之间的关系',
    summary: node.summary,
    note: node.problemApproach || '联系前后知识点，检查模型成立条件。',
  }));
  return nodes.length ? { title: route.title, chapter: '推荐路线 · 跨章连接', nodes } : previewRoute;
}

function safeStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; }
  catch { return null; }
}

function mountStudyApp(root, data) {
  const catalog = {
    chapters: data.chapters ?? chapters,
    nodes: data.nodes ?? nodes,
    edges: data.edges ?? edges,
    routes: data.routes ?? routes,
  };
  const byId = new Map(catalog.nodes.map((node) => [node.id, node]));
  const progress = createProgressStore(safeStorage());
  let currentRoute = catalog.routes[0];
  let currentChapter = catalog.chapters[0];
  let selectedId = currentRoute.nodeIds[0];
  let graph = null;
  let searchIds = null;
  let activeView = '速学路线';
  let activeSimulationCleanup = null;
  let activeSimulationMount = null;
  let userMotionPaused = false;
  const motionQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
  let systemReducedMotion = Boolean(motionQuery?.matches);
  const syncMotionPreference = () => root.classList.toggle('reduced-motion', systemReducedMotion || userMotionPaused);
  const onSystemMotionChange = (event) => {
    systemReducedMotion = Boolean(event.matches);
    syncMotionPreference();
  };
  let removeMotionListener = null;
  if (motionQuery?.addEventListener) {
    motionQuery.addEventListener('change', onSystemMotionChange);
    removeMotionListener = () => motionQuery.removeEventListener?.('change', onSystemMotionChange);
  } else if (motionQuery?.addListener) {
    motionQuery.addListener(onSystemMotionChange);
    removeMotionListener = () => motionQuery.removeListener?.(onSystemMotionChange);
  }
  syncMotionPreference();

  root.innerHTML = `
    <div class="site-shell study-app">
      <header class="topbar">
        <a class="brand" href="./index.html" aria-label="物理知识地图首页">
          <img src="./assets/physics-mark.svg" alt="" width="34" height="34">
          <span class="brand-name">物理知识地图</span>
        </a>
        <div class="topbar-tools">
          <nav class="primary-nav" aria-label="主导航">
            ${['速学路线', '完整图谱', '章节地图', '教材评估'].map((label, index) => `<button class="nav-button" type="button" data-view="${escapeHtml(label)}" aria-current="${index === 0 ? 'page' : 'false'}">${escapeHtml(label)}</button>`).join('')}
            <label class="view-select-label" for="view-select"><span class="is-hidden">切换学习视图</span><select id="view-select" aria-label="切换学习视图">${['速学路线', '完整图谱', '章节地图', '教材评估'].map((label, index) => `<option value="${escapeHtml(label)}"${index === 0 ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
          </nav>
          <label class="search-wrap"><span class="is-hidden">搜索知识点</span><input class="search-input" type="search" placeholder="搜索概念、公式或关键词" aria-label="搜索概念、公式或关键词" autocomplete="off"></label>
          <button class="motion-button" type="button" aria-pressed="false">暂停动态</button>
        </div>
      </header>

      <section class="intro" aria-labelledby="page-title">
        <div>
          <div class="eyebrow">物理学 · 下册</div>
          <h1 id="page-title">让知识沿着路径发生联系</h1>
          <p class="intro-description">从推荐路线开始，随时展开完整图谱；公式、适用条件和易错点都跟随同一知识节点。</p>
          <p class="intro-mobile-summary">${escapeHtml(currentRoute.title)} · 第 9—16 章 ·《物理学》第七版下册</p>
        </div>
        <div class="book-marker"><strong>第 9—16 章</strong><span>《物理学》第七版 · 下册</span></div>
      </section>

      <p class="view-status" aria-live="polite">当前视图：<span>速学路线</span></p>
      <p id="node-announcement" class="screen-reader-only" aria-live="polite" aria-atomic="true"></p>
      <section class="workspace" aria-label="物理知识学习区">
        <section class="panel graph-panel" aria-labelledby="route-heading">
          <div class="panel-heading"><h2 id="route-heading">${escapeHtml(currentRoute.title)}</h2><span class="chapter-tag">推荐路线</span></div>
          <div class="route-toolbar">
            <label for="route-select">学习路线</label>
            <select id="route-select" aria-label="选择速学路线">${catalog.routes.map((route, index) => `<option value="${escapeHtml(route.id)}"${index === 0 ? ' selected' : ''}>${escapeHtml(route.title)} · ${route.nodeIds.length} 站 · ${route.minutes} 分钟</option>`).join('')}</select>
            <span class="route-meta" id="route-meta"></span>
          </div>
          <p class="graph-copy" id="route-goal"></p>
          <div class="graph-region" id="graph-mount" aria-label="可交互知识图谱"></div>
          <p class="no-results is-hidden" id="no-results" role="status">没有找到匹配的知识点。<button type="button" class="clear-search">清空搜索与筛选</button></p>
          <p class="view-notice is-hidden" id="view-notice" role="status"></p>
        </section>

        <aside class="panel detail-panel" aria-label="当前知识点详情">
          <div class="detail-kicker"><span>当前节点</span><span class="detail-step" id="detail-step"></span></div>
          <div id="detail-content" class="detail-content"></div>
          <div class="mastery-actions">
            <button type="button" class="route-action mark-mastered">标记掌握 <span aria-hidden="true">↗</span></button>
            <button type="button" class="route-action mark-review">待复习</button>
          </div>
          <p class="progress-feedback" id="progress-feedback" aria-live="polite"></p>
        </aside>
      </section>

      <section id="study-view-panel" class="panel study-view-panel is-hidden" aria-label="章节与教材学习视图" aria-live="polite">
        <label class="chapter-select-label" for="chapter-select">选择章节
          <select id="chapter-select" aria-label="选择章节">${catalog.chapters.map((chapter, index) => '<option value="' + escapeHtml(chapter.id) + '"' + (index === 0 ? ' selected' : '') + '>第 ' + chapter.number + ' 章 · ' + escapeHtml(chapter.title) + '</option>').join('')}</select>
        </label>
        <div id="study-view-content"></div>
      </section>

      <section class="progress-tools" aria-label="本地学习进度管理">
        <p id="progress-summary"></p>
        <div class="progress-actions">
          <button type="button" data-action="clear-progress">清空进度</button>
          <button type="button" data-action="export-progress">导出学习进度</button>
          <label class="import-progress">导入学习进度<input type="file" id="progress-import" accept="application/json,.json"></label>
        </div>
        <p class="progress-message" id="progress-message" role="status" aria-live="polite">学习进度只保存在当前浏览器中。</p>
      </section>
      <footer class="bottom-note"><span>学习图谱 · 以关系组织知识</span><span>本地进度不会上传，可随时导出备份</span></footer>
    </div>`;

  const graphRoot = root.querySelector('#graph-mount');
  const renderGraphForView = () => {
    graph?.destroy();
    graph = renderGraph({
      root: graphRoot,
      nodes: catalog.nodes,
      edges: catalog.edges,
      chapters: catalog.chapters,
      filters: {
        routeOnly: activeView === '速学路线' && !searchIds,
        searchIds,
        progress: progress.getAll(),
      },
      selectedId,
      routeIds: currentRoute.nodeIds,
    });
  };

  const routeTitle = root.querySelector('#route-heading');
  const routeMeta = root.querySelector('#route-meta');
  const routeGoal = root.querySelector('#route-goal');
  const detailHost = root.querySelector('#detail-content');
  const detailStep = root.querySelector('#detail-step');
  const feedback = root.querySelector('#progress-feedback');
  const progressSummary = root.querySelector('#progress-summary');
  const progressMessage = root.querySelector('#progress-message');
  const nodeAnnouncement = root.querySelector('#node-announcement');
  const noResults = root.querySelector('#no-results');
  const viewNotice = root.querySelector('#view-notice');
  const workspace = root.querySelector('.workspace');
  const studyViewPanel = root.querySelector('#study-view-panel');
  const studyViewContent = root.querySelector('#study-view-content');
  const chapterSelectLabel = root.querySelector('.chapter-select-label');

  function renderStudyView() {
    chapterSelectLabel.classList.toggle('is-hidden', activeView !== '章节地图');
    if (activeView === '章节地图') {
      const chapterNodes = catalog.nodes.filter((node) => node.chapterId === currentChapter.id);
      studyViewContent.innerHTML = renderChapter(currentChapter, chapterNodes, progress.getAll());
    } else if (activeView === '教材评估') {
      studyViewContent.innerHTML = renderAssessment(data.assessment ?? assessmentSections);
    }
  }

  function updateRouteMeta() {
    const done = currentRoute.nodeIds.filter((id) => progress.getAll()[id] === 'mastered').length;
    const index = currentRoute.nodeIds.indexOf(selectedId);
    routeTitle.textContent = currentRoute.title;
    routeMeta.textContent = `${currentRoute.nodeIds.length} 个知识点 · 约 ${currentRoute.minutes} 分钟 · 已掌握 ${done}/${currentRoute.nodeIds.length}`;
    routeGoal.textContent = currentRoute.goal;
    detailStep.textContent = index < 0
      ? '自由探索'
      : `路线第 ${String(index + 1).padStart(2, '0')} / ${String(currentRoute.nodeIds.length).padStart(2, '0')} 站`;
    progressSummary.textContent = `当前路线「${currentRoute.title}」已掌握 ${done} / ${currentRoute.nodeIds.length} 个节点。`;
  }

  function updateDetail(id) {
    const node = byId.get(id);
    if (!node) return;
    selectedId = id;
    nodeAnnouncement.textContent = `已选择知识点：${node.title}。`;
    activeSimulationCleanup?.();
    activeSimulationCleanup = null;
    activeSimulationMount = null;
    const prerequisiteIds = [...new Set([...(node.prerequisites ?? []), ...catalog.edges.filter((edge) => edge.target === id && edge.type === '先修').map((edge) => edge.source)])];
    const nextIds = [...new Set(catalog.edges.filter((edge) => edge.source === id).map((edge) => edge.target))];
    const prerequisites = prerequisiteIds.map((nodeId) => byId.get(nodeId)).filter(Boolean);
    const next = nextIds.map((nodeId) => byId.get(nodeId)).filter(Boolean);
    const detail = renderNodeDetail(node, { prerequisites, next });
    if (node.simulationId) {
      const ownerDocument = detailHost.ownerDocument ?? document;
      const launch = ownerDocument.createElement('button');
      launch.type = 'button';
      launch.className = 'simulation-launch-button';
      launch.textContent = '打开演示';
      launch.setAttribute('data-action', 'open-simulation');
      launch.setAttribute('data-node-id', node.id);
      const simulationMount = ownerDocument.createElement('div');
      simulationMount.className = 'simulation-mount';
      simulationMount.setAttribute('aria-label', `${node.title}微型演示区域`);
      detail.append(launch, simulationMount);
      activeSimulationMount = simulationMount;
    }
    detailHost.replaceChildren(detail);
    const status = progress.getAll()[id] ?? 'new';
    feedback.textContent = status === 'mastered' ? '已掌握' : status === 'review' ? '已加入待复习' : '尚未标记';
    updateRouteMeta();
  }

  function selectNode(id) {
    if (!byId.has(id)) return;
    selectedId = id;
    graph?.selectNode(id);
    updateDetail(id);
  }

  function resetGraphFacets() {
    return { chapterId: null, type: 'all', level: 'all', status: 'all', progress: progress.getAll() };
  }

  function clearSearch() {
    const search = root.querySelector('.search-input');
    search.value = '';
    searchIds = null;
    noResults.classList.add('is-hidden');
    graph?.setFilters({ ...resetGraphFacets(), searchIds: null, routeOnly: activeView === '速学路线' });
  }

  function changeView(label, preserveSearch = false) {
    activeView = label;
    root.querySelector('#view-select').value = label;
    if (label === '速学路线' && !currentRoute.nodeIds.includes(selectedId)) selectedId = currentRoute.nodeIds[0];
    root.querySelectorAll('.nav-button').forEach((button) => button.setAttribute('aria-current', button.dataset.view === label ? 'page' : 'false'));
    root.querySelector('.view-status span').textContent = label;
    const isKnownView = ['速学路线', '完整图谱', '章节地图', '教材评估'].includes(label);
    const isGraphView = label === '速学路线' || label === '完整图谱';
    viewNotice.classList.toggle('is-hidden', isKnownView);
    workspace.classList.toggle('is-hidden', !isGraphView);
    studyViewPanel.classList.toggle('is-hidden', isGraphView || !isKnownView);
    if (!isKnownView) viewNotice.textContent = '当前视图暂不可用。';
    if (isGraphView) {
      if (!preserveSearch) {
        noResults.classList.add('is-hidden');
        searchIds = null;
        root.querySelector('.search-input').value = '';
      }
      renderGraphForView();
      updateDetail(selectedId);
    } else if (isKnownView) {
      noResults.classList.add('is-hidden');
      renderStudyView();
    }
  }

  function selectRoute(routeId) {
    currentRoute = catalog.routes.find((route) => route.id === routeId) ?? catalog.routes[0];
    root.querySelector('#route-select').value = currentRoute.id;
    selectedId = currentRoute.nodeIds[0];
    searchIds = null;
    root.querySelector('.search-input').value = '';
    noResults.classList.add('is-hidden');
    if (activeView !== '速学路线') changeView('速学路线');
    else renderGraphForView();
    updateDetail(selectedId);
  }

  root.querySelector('#route-select').addEventListener('change', (event) => selectRoute(event.target.value));
  root.querySelector('#chapter-select').addEventListener('change', (event) => {
    currentChapter = catalog.chapters.find((chapter) => chapter.id === event.target.value) ?? catalog.chapters[0];
    if (activeView === '章节地图') renderStudyView();
  });

  root.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => changeView(button.dataset.view)));
  root.querySelector('#view-select').addEventListener('change', (event) => changeView(event.target.value));

  root.querySelector('.search-input').addEventListener('input', (event) => {
    const query = event.target.value.trim();
    if (!query) {
      clearSearch();
      return;
    }
    const matches = searchKnowledge(catalog.nodes, query);
    searchIds = new Set(matches.map((node) => node.id));
    if (activeView !== '完整图谱') changeView('完整图谱', true);
    else graph?.setFilters({ ...resetGraphFacets(), routeOnly: false, searchIds });
    noResults.classList.toggle('is-hidden', matches.length > 0);
    if (matches.length) {
      noResults.textContent = `找到 ${matches.length} 个知识点，已聚焦「${matches[0].title}」。`;
      selectNode(matches[0].id);
    } else {
      noResults.innerHTML = '没有找到匹配的知识点。<button type="button" class="clear-search">清空搜索与筛选</button>';
    }
  });

  root.addEventListener('click', (event) => {
    const relatedNode = event.target.closest?.('.related-node[data-node-id]');
    if (relatedNode) {
      const id = relatedNode.getAttribute('data-node-id');
      if (activeView !== '完整图谱') changeView('完整图谱');
      else if (searchIds) clearSearch();
      selectNode(id);
      const graphNode = graphRoot.querySelector?.('.graph-node[data-node-id="' + id + '"], .graph-node-list[data-node-id="' + id + '"]');
      graphNode?.scrollIntoView?.({ behavior: root.classList.contains('reduced-motion') ? 'auto' : 'smooth', block: 'center' });
      graphNode?.focus?.();
      return;
    }
    const routeLink = event.target.closest?.('[data-route-id]');
    if (routeLink) {
      selectRoute(routeLink.getAttribute('data-route-id'));
      return;
    }
    const chapterOption = event.target.closest?.('[data-chapter-id]');
    if (chapterOption) {
      currentChapter = catalog.chapters.find((chapter) => chapter.id === chapterOption.getAttribute('data-chapter-id')) ?? currentChapter;
      root.querySelector('#chapter-select').value = currentChapter.id;
      if (activeView === '章节地图') renderStudyView();
    }
    const action = event.target.closest?.('[data-action]');
    if (action?.dataset.action === 'open-simulation') {
      const node = byId.get(action.getAttribute('data-node-id'));
      if (node?.simulationId && node.id === selectedId && activeSimulationMount) {
        activeSimulationCleanup?.();
        try {
          activeSimulationCleanup = mountSimulation(activeSimulationMount, node.simulationId);
          action.textContent = '重新打开演示';
        } catch (error) {
          activeSimulationMount.textContent = `演示无法加载：${error.message}`;
        }
      }
    } else if (action?.dataset.action === 'clear-progress') {
      if (typeof window === 'undefined' || !window.confirm || window.confirm('清空此浏览器中保存的学习进度？')) {
        progress.clear();
        feedback.textContent = '本地进度已清空。';
        graph?.setFilters({ progress: progress.getAll() });
        updateDetail(selectedId);
        if (activeView === '章节地图') renderStudyView();
        progressMessage.textContent = '本地学习进度已清空。';
      }
    } else if (action?.dataset.action === 'export-progress') {
      const blob = new Blob([progress.exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'physics-atlas-progress.json';
      link.click();
      URL.revokeObjectURL(url);
      progressMessage.textContent = '学习进度已导出。';
    }
    if (event.target.closest?.('.clear-search')) clearSearch();
    if (event.target.closest?.('.mark-mastered')) {
      progress.setStatus(selectedId, 'mastered');
      graph?.setFilters({ progress: progress.getAll() });
      const nextId = advanceRoute(currentRoute, selectedId);
      if (nextId) selectNode(nextId);
      else updateDetail(selectedId);
      if (activeView === '章节地图') renderStudyView();
      progressMessage.textContent = nextId ? '已标记掌握，已前进到路线下一站。' : '已掌握路线最后一站，路线完成。';
    }
    if (event.target.closest?.('.mark-review')) {
      progress.setStatus(selectedId, 'review');
      graph?.setFilters({ progress: progress.getAll() });
      updateDetail(selectedId);
      if (activeView === '章节地图') renderStudyView();
      progressMessage.textContent = '已加入待复习，可在图谱进度筛选中查看。';
    }
  });

  root.querySelector('#progress-import').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      progress.importJson(await file.text(), new Set(catalog.nodes.map((node) => node.id)));
      graph?.setFilters({ progress: progress.getAll() });
      updateDetail(selectedId);
      if (activeView === '章节地图') renderStudyView();
      progressMessage.textContent = '进度已验证并导入。';
    } catch (error) {
      progressMessage.textContent = `未导入：${error.message}`;
    } finally {
      event.target.value = '';
    }
  });

  root.querySelector('.motion-button').addEventListener('click', (event) => {
    const button = event.currentTarget;
    userMotionPaused = button.getAttribute('aria-pressed') !== 'true';
    syncMotionPreference();
    button.setAttribute('aria-pressed', String(userMotionPaused));
    button.textContent = userMotionPaused ? '恢复动态' : '暂停动态';
  });

  graphRoot.addEventListener('physics-node-select', (event) => updateDetail(event.detail.id));

  renderGraphForView();
  updateDetail(selectedId);
  return { progress, selectNode, destroy() { activeSimulationCleanup?.(); removeMotionListener?.(); graph?.destroy(); root.innerHTML = ''; } };
}


export function mountApp(root, data) {
  if (!(root instanceof HTMLElement)) throw new TypeError('mountApp requires a root HTML element');
  if (data?.nodes?.length && data?.routes?.length) return mountStudyApp(root, data);
  const route = normalizeRoute(data);
  let selectedIndex = 0;
  let activeView = '速学路线';
  let motionPaused = false;

  root.innerHTML = `
    <div class="site-shell">
      <header class="topbar">
        <a class="brand" href="./index.html" aria-label="物理知识地图首页">
          <img src="./assets/physics-mark.svg" alt="" width="34" height="34">
          <span class="brand-name">物理知识地图</span>
        </a>
        <div class="topbar-tools">
          <nav class="primary-nav" aria-label="主导航">
            ${['速学路线', '完整图谱', '章节地图', '教材评估'].map((label, index) => `<button class="nav-button" type="button" data-view="${escapeHtml(label)}" aria-current="${index === 0 ? 'page' : 'false'}">${escapeHtml(label)}</button>`).join('')}
            <label class="view-select-label" for="view-select"><span class="is-hidden">切换学习视图</span><select id="view-select" aria-label="切换学习视图">${['速学路线', '完整图谱', '章节地图', '教材评估'].map((label, index) => `<option value="${escapeHtml(label)}"${index === 0 ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
          </nav>
          <label class="search-wrap"><span class="is-hidden">搜索知识点</span><input class="search-input" type="search" placeholder="搜索概念或公式" aria-label="搜索概念或公式"></label>
          <button class="motion-button" type="button" aria-pressed="false">暂停动态</button>
        </div>
      </header>

      <section class="intro" aria-labelledby="page-title">
        <div>
          <div class="eyebrow">物理学 · 下册</div>
          <h1 id="page-title">让知识沿着路径发生联系</h1>
          <p class="intro-description">从一个清晰的物理图像出发，沿概念之间的依赖关系前进。这里先从振动开始，看见周期运动如何长成波。</p>
          <p class="intro-mobile-summary">${escapeHtml(route.title)} · 第 9—16 章 ·《物理学》第七版下册</p>
        </div>
        <div class="book-marker"><strong>第 9—16 章</strong><span>《物理学》第七版 · 下册</span></div>
      </section>

      <p class="view-status" aria-live="polite">当前视图：<span>${escapeHtml(activeView)}</span></p>
      <p id="node-announcement" class="screen-reader-only" aria-live="polite" aria-atomic="true"></p>
      <section class="workspace" aria-label="${escapeHtml(route.title)}">
        <section class="panel graph-panel" aria-labelledby="route-heading">
          <div class="panel-heading"><h2 id="route-heading">${escapeHtml(route.title)}</h2><span class="chapter-tag">${escapeHtml(route.chapter)}</span></div>
          <p class="graph-copy">跟随概念之间的连接，一步步展开这一条学习路径。</p>
          <div class="graph-region" role="region" aria-label="第九章学习路线图，可用 Tab 键聚焦节点">
            <svg class="route-graph" viewBox="0 0 700 300" role="group" aria-label="简谐振动、振动合成到机械波的学习路径">
              <path class="graph-grid" d="M0 60H700 M0 120H700 M0 180H700 M0 240H700 M70 0V300 M210 0V300 M350 0V300 M490 0V300 M630 0V300"/>
              <path class="route-line" d="M115 155 C190 155 215 110 290 110 S390 196 465 196 S545 140 610 140"/>
              <path class="route-trace" d="M115 155 C190 155 215 110 290 110 S390 196 465 196 S545 140 610 140"/>
              ${route.nodes.map((node, index) => {
                const positions = [[115, 155], [290, 110], [465, 196]][index] ?? [610, 140];
                return `<g class="graph-node${index === selectedIndex ? ' is-selected' : ''}" transform="translate(${positions[0]} ${positions[1]})" role="button" tabindex="0" aria-label="${escapeHtml(node.title)}，学习路线第 ${index + 1} 站" data-node-index="${index}"><circle r="10"/><text y="32">${escapeHtml(node.title)}</text><text class="node-subtitle" y="50">${escapeHtml(node.subtitle)}</text></g>`;
              }).join('')}
            </svg>
          </div>
          <div class="route-legend"><span class="legend-dot" aria-hidden="true"></span><span>青绿色流迹表示当前学习路线</span></div>
        </section>

        <aside class="panel detail-panel" aria-labelledby="detail-title">
          <div class="detail-kicker"><span>当前节点</span><span class="detail-step">01 / ${String(route.nodes.length).padStart(2, '0')}</span></div>
          <h2 id="detail-title">${escapeHtml(route.nodes[0].title)}</h2>
          <p class="detail-summary">${escapeHtml(route.nodes[0].summary)}</p>
          <div class="formula" aria-label="核心关系">${escapeHtml(route.nodes[0].formula)}</div>
          <div class="detail-note">${escapeHtml(route.nodes[0].note)}</div>
          <button class="route-action" type="button">开始这一站 <span aria-hidden="true">↗</span></button>
        </aside>
      </section>
      <p class="no-results is-hidden" role="status">没有找到匹配的路线节点。试试“振动”或“波”。</p>
      <footer class="bottom-note"><span>学习图谱 · 以关系组织知识</span><span>动态只提示路线，可随时暂停</span></footer>
    </div>`;

  const nodeElements = [...root.querySelectorAll('.graph-node')];
  const detailTitle = root.querySelector('#detail-title');
  const detailSummary = root.querySelector('.detail-summary');
  const detailFormula = root.querySelector('.formula');
  const detailNote = root.querySelector('.detail-note');
  const detailStep = root.querySelector('.detail-step');
  const nodeAnnouncement = root.querySelector('#node-announcement');
  const announce = (index) => {
    selectedIndex = index;
    const node = route.nodes[index];
    nodeElements.forEach((element, itemIndex) => element.classList.toggle('is-selected', itemIndex === index));
    detailTitle.textContent = node.title;
    detailSummary.textContent = node.summary;
    detailFormula.textContent = node.formula;
    detailNote.textContent = node.note;
    detailStep.textContent = `${String(index + 1).padStart(2, '0')} / ${String(route.nodes.length).padStart(2, '0')}`;
    nodeAnnouncement.textContent = `已选择知识点：${node.title}。`;
  };

  nodeElements.forEach((element, index) => {
    element.addEventListener('click', () => announce(index));
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); announce(index); }
    });
  });
  root.querySelector('.route-action').addEventListener('click', () => {
    const nextIndex = (selectedIndex + 1) % route.nodes.length;
    announce(nextIndex);
    nodeElements[nextIndex]?.focus();
  });
  root.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => {
    activeView = button.dataset.view;
    root.querySelector('#view-select').value = activeView;
    root.querySelectorAll('.nav-button').forEach((item) => item.setAttribute('aria-current', item === button ? 'page' : 'false'));
    root.querySelector('.view-status span').textContent = activeView;
  }));
  root.querySelector('#view-select').addEventListener('change', (event) => {
    activeView = event.target.value;
    root.querySelectorAll('.nav-button').forEach((item) => item.setAttribute('aria-current', item.dataset.view === activeView ? 'page' : 'false'));
    root.querySelector('.view-status span').textContent = activeView;
  });
  const motionButton = root.querySelector('.motion-button');
  motionButton.addEventListener('click', () => {
    motionPaused = !motionPaused;
    root.classList.toggle('reduced-motion', motionPaused);
    motionButton.setAttribute('aria-pressed', String(motionPaused));
    motionButton.textContent = motionPaused ? '恢复动态' : '暂停动态';
  });
  const searchInput = root.querySelector('.search-input');
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    nodeElements.forEach((element, index) => {
      const visible = !query || `${route.nodes[index].title} ${route.nodes[index].subtitle} ${route.nodes[index].formula}`.toLocaleLowerCase().includes(query);
      element.classList.toggle('is-hidden', !visible);
      if (visible) visibleCount += 1;
    });
    root.querySelector('.no-results').classList.toggle('is-hidden', visibleCount > 0);
  });
}

const root = document.querySelector('#app');
if (root) mountApp(root, window.PHYSICS_KNOWLEDGE_DATA ?? { chapters, nodes, edges, routes });
