import { assessment as assessmentSections, chapterStudyPaths, chapters, edges, nodes, routes, sourceNotes } from './data/physics-data.js';
import { advanceRoute, createProgressStore, getRouteState, renderNodeDetail, searchKnowledge } from './study.js';
import { renderGraph } from './graph.js';
import { mountSimulation } from './simulations.js';
import { renderAssessment, renderChapter } from './assessment.js';
import { parseLocation, serializeLocation } from './navigation.js';
import { createPracticeStore, questionsByNode } from './practice.js';
import { questions } from './data/practice-data.js';
import { formulaLatexFor, renderFormula } from './math.js';
import { createLearningStorage } from './learning-storage.js';
import { exportBackupJson, previewBackup } from './learning-backup.js';
import { getPrediction, gradePrediction } from './experiment-predictions.js';
import { currentDueQuestions, millisecondsUntilNextDay, practiceRecordLabel } from './review.js';

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
    sources: data.sourceNotes ?? sourceNotes,
  };
  const byId = new Map(catalog.nodes.map((node) => [node.id, node]));
  const authoredChapterPaths = data.chapterStudyPaths ?? chapterStudyPaths;
  const chapterRoutes = catalog.chapters.map((chapter) => {
    const nodeIds = (authoredChapterPaths[chapter.id] ?? [])
      .filter((id) => byId.get(id)?.chapterId === chapter.id && byId.get(id)?.level === 'core');
    return {
      id: `chapter-${chapter.id}`,
      title: `第 ${chapter.number} 章 · ${chapter.title}`,
      goal: '按本章核心路径学习；扩展内容可在章节地图中自由探索。',
      minutes: Math.max(10, nodeIds.length * 3),
      nodeIds,
    };
  }).filter((route) => route.nodeIds.length);
  const chapterRouteById = new Map(chapterRoutes.map((route) => [route.id.slice('chapter-'.length), route]));
  const allRoutes = [...catalog.routes, ...chapterRoutes];
  const storage = safeStorage();
  const learningStorage = createLearningStorage(storage);
  let progress = createProgressStore(learningStorage.storage);
  let practice = createPracticeStore(learningStorage.storage);
  let savedLocation = '';
  try { savedLocation = storage?.getItem('physics-atlas-location-v1') ?? ''; } catch { /* location remains optional */ }
  const sharedHash = typeof window !== 'undefined' ? window.location?.hash ?? '' : '';
  const initialLocation = parseLocation(sharedHash || savedLocation, { ...catalog, routes: allRoutes });
  let currentRoute = allRoutes.find((route) => route.id === initialLocation.routeId) ?? allRoutes[0];
  let currentChapter = catalog.chapters.find((chapter) => chapter.id === initialLocation.chapterId) ?? catalog.chapters[0];
  let selectedId = initialLocation.nodeId ?? currentRoute.nodeIds[0];
  let graph = null;
  let searchIds = null;
  let activeView = {
    graph: '完整图谱', chapter: '章节地图', guide: '教材评估',
  }[initialLocation.view] ?? '速学路线';
  let currentTab = initialLocation.tab;
  let restoringLocation = false;
  let activeSimulationCleanup = null;
  let activeSimulationMount = null;
  let destroyed = false;
  let rolloverTimer = null;
  const experimentPredictions = new Map();
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
            ${['速学路线', '完整图谱', '章节地图', '教材评估'].map((label) => `<button class="nav-button" type="button" data-view="${escapeHtml(label)}" aria-current="${label === activeView ? 'page' : 'false'}">${escapeHtml(label)}</button>`).join('')}
            <label class="view-select-label" for="view-select"><span class="is-hidden">切换学习视图</span><select id="view-select" aria-label="切换学习视图">${['速学路线', '完整图谱', '章节地图', '教材评估'].map((label) => `<option value="${escapeHtml(label)}"${label === activeView ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
          </nav>
          <label class="search-wrap"><span class="is-hidden">搜索知识点</span><input class="search-input" type="search" placeholder="搜索概念、公式或关键词" aria-label="搜索概念、公式或关键词" autocomplete="off"></label>
          <button type="button" class="today-review" data-action="today-review" aria-expanded="false" aria-controls="review-queue">今日复习（0）</button>
        </div>
      </header>

      <p class="view-status screen-reader-only" aria-live="polite">当前视图：<span>${escapeHtml(activeView)}</span></p>
      <p id="node-announcement" class="screen-reader-only" aria-live="polite" aria-atomic="true"></p>
      <section id="review-queue" class="panel review-queue is-hidden" aria-label="今日复习队列"></section>
      <section class="workspace" aria-label="物理知识学习区">
        <section class="panel graph-panel" aria-labelledby="route-heading">
          <button type="button" class="directory-toggle" aria-expanded="false" aria-controls="reading-directory-panel">学习目录</button>
          <div id="reading-directory-panel">
          <nav class="reading-directory" aria-label="学习目录"></nav>
          <details class="route-disclosure"><summary>学习路线</summary>
          <div class="panel-heading"><h2 id="route-heading">${escapeHtml(currentRoute.title)}</h2><span class="chapter-tag">推荐路线</span></div>
          <div class="route-toolbar">
            <label for="route-select">学习路线</label>
            <select id="route-select" aria-label="选择学习路线">${allRoutes.map((route) => `<option value="${escapeHtml(route.id)}"${route.id === currentRoute.id ? ' selected' : ''}>${escapeHtml(route.title)} · ${route.nodeIds.length} 站 · 概览约 ${route.minutes} 分钟</option>`).join('')}</select>
            <span class="route-meta" id="route-meta"></span>
          </div>
          <p class="graph-copy" id="route-goal"></p>
          </details>
          <p class="book-marker">《物理学》第七版 · 下册<br>第 9—16 章</p>
          </div>
          <div class="graph-region" id="graph-mount" aria-label="可交互知识图谱"></div>
          <p class="no-results is-hidden" id="no-results" role="status">没有找到匹配的知识点。<button type="button" class="clear-search">清空搜索与筛选</button></p>
          <p class="view-notice is-hidden" id="view-notice" role="status"></p>
        </section>

        <aside class="panel detail-panel" aria-label="当前知识点详情">
          <div class="detail-kicker"><span class="detail-step" id="detail-step"></span><button type="button" class="share-location" data-action="share-location">分享此处</button></div>
          <div class="detail-tabs" role="tablist" aria-label="知识点学习方式">
            <button type="button" role="tab" data-tab="understand" aria-selected="${currentTab === 'understand'}">理解</button>
            <button type="button" role="tab" data-tab="experiment" aria-selected="${currentTab === 'experiment'}">实验</button>
            <button type="button" role="tab" data-tab="practice" aria-selected="${currentTab === 'practice'}">练习</button>
            <button type="button" role="tab" data-tab="relations" aria-selected="${currentTab === 'relations'}">知识关系</button>
          </div>
          <div id="detail-content" class="detail-content"></div>
          <div class="mastery-actions">
            <button type="button" class="route-action mark-mastered">标记掌握（自评）</button>
            <button type="button" class="route-action mark-review">待复习</button>
            <button type="button" class="route-action next-station">下一节 <span aria-hidden="true">→</span></button>
            <button type="button" class="start-practice" data-action="start-practice">开始练习 <span aria-hidden="true">→</span></button>
          </div>
          <p class="progress-feedback" id="progress-feedback" aria-live="polite"></p>
        </aside>
      </section>

      <section id="study-view-panel" class="panel study-view-panel is-hidden" aria-label="章节与教材学习视图" aria-live="polite">
        <label class="chapter-select-label" for="chapter-select">选择章节
          <select id="chapter-select" aria-label="选择章节">${catalog.chapters.map((chapter) => '<option value="' + escapeHtml(chapter.id) + '"' + (chapter.id === currentChapter.id ? ' selected' : '') + '>第 ' + chapter.number + ' 章 · ' + escapeHtml(chapter.title) + '</option>').join('')}</select>
        </label>
        <div id="study-view-content"></div>
      </section>

      <details class="progress-tools" id="learning-progress"><summary>学习进度</summary>
        <section aria-label="本地学习进度管理">
        <p id="progress-summary"></p>
        <div class="progress-actions">
          <button class="motion-button" type="button" aria-pressed="false">暂停动态</button>
          <button type="button" data-action="clear-progress">清空自评</button>
          <button type="button" data-action="export-progress">导出学习进度</button>
          <label class="import-mode">导入方式<select id="progress-import-mode"><option value="merge">合并，保留本机冲突项</option><option value="replace">替换全部</option></select></label>
          <label class="import-progress">导入学习进度<input type="file" id="progress-import" accept="application/json,.json"></label>
        </div>
        <p class="progress-message" id="progress-message" role="status" aria-live="polite">学习进度只保存在当前浏览器中。</p>
        <label class="share-fallback is-hidden" id="share-fallback-label">复制此链接<input id="share-fallback" readonly></label>
        </section>
      </details>
      <footer class="bottom-note"><span>学习图谱 · 以关系组织知识</span><span>本地进度不会上传，可随时导出备份</span></footer>
    </div>`;

  root.querySelector('#reading-directory-panel').append(root.querySelector('.primary-nav'));
  root.querySelector('#reading-directory-panel').append(root.querySelector('#learning-progress'));
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
  workspace.classList.toggle('is-full-graph', activeView === '完整图谱');
  const studyViewPanel = root.querySelector('#study-view-panel');
  const studyViewContent = root.querySelector('#study-view-content');
  const chapterSelectLabel = root.querySelector('.chapter-select-label');
  workspace.append(studyViewPanel);

  function renderDirectory() {
    const selectedChapterId = byId.get(selectedId)?.chapterId;
    root.querySelector('.reading-directory').innerHTML = `<h2>学习目录</h2>${catalog.chapters.map((chapter) =>
      `<details class="directory-chapter"${chapter.id === selectedChapterId ? ' open' : ''}><summary>第 ${chapter.number} 章 · ${escapeHtml(chapter.title)}</summary><ul>${catalog.nodes.filter((node) => node.chapterId === chapter.id).map((node) =>
        `<li><button type="button" data-directory-node="${escapeHtml(node.id)}"${node.id === selectedId ? ' aria-current="page"' : ''}>${escapeHtml(node.title)}</button></li>`).join('')}</ul></details>`).join('')}`;
  }

  function closeDirectory({ restoreFocus = false } = {}) {
    root.querySelector('.directory-toggle').setAttribute('aria-expanded', 'false');
    root.querySelector('.graph-panel').classList.remove('directory-open');
    if (restoreFocus) root.querySelector('.directory-toggle').focus();
  }

  root.querySelector('.directory-toggle').addEventListener('click', (event) => {
    const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(open));
    root.querySelector('.graph-panel').classList.toggle('directory-open', open);
  });
  root.querySelector('.graph-panel').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDirectory({ restoreFocus: true });
  });

  function viewKey() {
    return { '完整图谱': 'graph', '章节地图': 'chapter', '教材评估': 'guide' }[activeView] ?? 'study';
  }

  function syncLocation() {
    if (restoringLocation || typeof window === 'undefined' || !window.location) return;
    const hash = serializeLocation({
      view: viewKey(), nodeId: selectedId, chapterId: currentChapter.id,
      routeId: currentRoute.id, tab: currentTab,
    });
    if (window.location.hash !== hash) {
      window.history?.pushState?.(null, '', hash);
    }
    try { storage?.setItem('physics-atlas-location-v1', hash); } catch { /* sharing still works */ }
  }

  function focusDetail() {
    const heading = detailHost.querySelector?.('h2');
    heading?.setAttribute?.('tabindex', '-1');
    heading?.focus?.({ preventScroll: true });
    if (typeof window !== 'undefined' && window.innerWidth <= 760) {
      heading?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    }
  }

  function persistenceNotice(action) {
    if (learningStorage.getLegacySyncState?.() === 'out-of-sync') {
      revealProgress();
      return `${action}；旧版页面可能看不到最新自评，回退前请先导出学习进度备份。`;
    }
    const temporary = progress.getPersistenceState() === 'memory' || practice.getPersistenceState() === 'memory';
    if (temporary) revealProgress();
    return temporary
      ? `${action}；仅在本次打开期间保存，请导出备份。`
      : `${action}。`;
  }

  function showLearningError(error) {
    revealProgress();
    if (!destroyed) progressMessage.textContent = `学习记录未能保存：${error.message} 请先导出备份，再刷新后重试或恢复备份。`;
  }

  function revealProgress() {
    root.querySelector('#learning-progress').open = true;
    if (typeof window !== 'undefined' && window.innerWidth <= 760) {
      root.querySelector('.directory-toggle').setAttribute('aria-expanded', 'true');
      root.querySelector('.graph-panel').classList.add('directory-open');
    }
  }

  function syncLearningStores() {
    learningStorage.refresh();
    progress.getAll();
    practice.refresh();
  }

  // Web Locks return a Promise; the unsupported-browser fallback is synchronous.
  // Refresh both collections after grant, never before a queued mutation.
  function mutateLearning(action, onSaved, onFailed) {
    const failed = (error) => {
      if (!destroyed) onFailed?.();
      showLearningError(error);
    };
    try {
      const result = learningStorage.runExclusive(() => {
        if (destroyed) return;
        syncLearningStores();
        return action();
      });
      const complete = (value) => { if (!destroyed) onSaved?.(value); };
      if (result && typeof result.then === 'function') result.then(complete).catch(failed);
      else complete(result);
    } catch (error) { failed(error); }
  }

  function updateReviewQueue() {
    const due = currentDueQuestions(practice, questions, byId);
    root.querySelector('[data-action="today-review"]').textContent = `今日复习（${due.length}）`;
    root.querySelector('#review-queue').innerHTML = `<h2>今日复习</h2>${due.length ? '<ol>' + due.map(({ question, record, node }) =>
      `<li data-review-question-id="${escapeHtml(question.id)}"><h3>${escapeHtml(node.title)}</h3><p>${escapeHtml(question.prompt)}</p><p>复习日期 <time datetime="${record.dueDate}">${record.dueDate}</time> · ${record.lastCorrect ? '本次正确' : '本次错误'}${record.passed && !record.lastCorrect ? ' · 曾通过' : ''}</p><button type="button" data-action="start-review" data-question-id="${escapeHtml(question.id)}">开始复习</button></li>`).join('') + '</ol>' : '<p>今天没有到期的练习。可以继续学习或主动练习。</p>'}`;
  }

  function refreshLearningView({ forceQuestionId } = {}) {
    graph?.setFilters({ progress: progress.getAll() });
    const status = progress.getAll()[selectedId] ?? 'new';
    feedback.textContent = status === 'mastered' ? '已自评掌握；做题记录另行计算。' : status === 'review' ? '已加入待复习。' : '尚未自评。';
    if (currentTab === 'practice') {
      const panel = detailHost.querySelector('.practice-panel');
      if (panel) {
        const freshPanel = renderPracticePanel(selectedId);
        for (const fresh of freshPanel.querySelectorAll('.practice-question')) {
          const id = fresh.getAttribute('data-question-id');
          const existing = panel.querySelector(`[data-question-id="${id}"]`);
          const hasDraft = existing && [...existing.querySelectorAll('input')].some((input) => input.type === 'radio' ? input.checked : input.value !== '');
          if (existing && hasDraft && id !== forceQuestionId) {
            existing.querySelector('.practice-record').textContent = fresh.querySelector('.practice-record').textContent;
            existing.querySelector('.practice-feedback').textContent = '';
          } else existing?.replaceWith(fresh);
        }
      }
    }
    updateRouteMeta();
    if (activeView === '章节地图') renderStudyView();
  }

  function synchronizeLearning() {
    if (destroyed) return;
    try { syncLearningStores(); refreshLearningView(); }
    catch (error) { showLearningError(error); }
  }

  function scheduleDayRollover() {
    if (typeof window === 'undefined' || !window.setTimeout) return;
    window.clearTimeout?.(rolloverTimer);
    rolloverTimer = window.setTimeout(() => {
      synchronizeLearning();
      scheduleDayRollover();
    }, millisecondsUntilNextDay() + 50);
  }

  const onLearningStorage = (event) => {
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key === null || ['physics-atlas-learning-v2', 'physics-atlas-progress-v1', 'physics-atlas-practice-v2'].includes(event.key)) synchronizeLearning();
  };
  const onReturningFocus = () => { synchronizeLearning(); scheduleDayRollover(); };
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') onReturningFocus(); };

  function renderStudyView() {
    chapterSelectLabel.classList.toggle('is-hidden', activeView !== '章节地图');
    if (activeView === '章节地图') {
      const chapterNodes = catalog.nodes.filter((node) => node.chapterId === currentChapter.id);
      studyViewContent.innerHTML = renderChapter(currentChapter, chapterNodes, progress.getAll());
    } else if (activeView === '教材评估') {
      studyViewContent.innerHTML = renderAssessment(data.assessment ?? assessmentSections);
    }
  }

  function renderPracticePanel(nodeId) {
    const ownerDocument = detailHost.ownerDocument ?? document;
    const panel = ownerDocument.createElement('div');
    panel.className = 'practice-panel';
    const introduction = ownerDocument.createElement('p');
    introduction.className = 'practice-introduction';
    introduction.textContent = '先独立作答，再对照反馈核查模型、条件和单位。练习通过与“自评掌握”分别记录。';
    panel.append(introduction);
    const items = questionsByNode(nodeId);
    if (!items.length) {
      const empty = ownerDocument.createElement('p');
      empty.className = 'practice-empty';
      empty.textContent = '这个知识点的练习仍在审校中，请先用上方模型与例题自测。';
      panel.append(empty);
      return panel;
    }

    for (const [index, question] of items.entries()) {
      const section = ownerDocument.createElement('section');
      section.className = 'practice-question';
      section.setAttribute('data-question-id', question.id);
      const heading = ownerDocument.createElement('h3');
      heading.textContent = `第 ${index + 1} 题 · ${question.kind === 'numeric' ? '数值与单位' : question.kind === 'interpretation' ? '读图与判断' : '概念辨析'}`;
      const prompt = ownerDocument.createElement('p');
      prompt.className = 'practice-prompt';
      prompt.textContent = question.prompt;
      section.append(heading, prompt);
      const record = practice.getRecord(question);
      const status = ownerDocument.createElement('p');
      status.className = 'practice-record';
      status.textContent = practiceRecordLabel(record);
      section.append(status);

      const feedback = ownerDocument.createElement('p');
      feedback.className = 'practice-feedback';
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');
      // Keep the empty live region in the accessibility tree for the new attempt.
      feedback.setAttribute('style', 'display: block');
      if (record?.lastFeedback && !record.awaitingNewAttempt) feedback.textContent = record.lastFeedback;

      if (!record || record.awaitingNewAttempt) {
        const form = ownerDocument.createElement('form');
        form.className = 'practice-form';
        if (question.kind === 'numeric') {
          for (const [name, labelText] of [['value', '数值'], ['unit', '单位']]) {
            const label = ownerDocument.createElement('label');
            label.className = 'practice-input-label';
            label.textContent = labelText;
            const input = ownerDocument.createElement('input');
            input.name = name;
            input.type = name === 'value' ? 'number' : 'text';
            if (name === 'value') input.step = 'any';
            input.required = true;
            label.append(input);
            form.append(label);
          }
        } else {
          const fieldset = ownerDocument.createElement('fieldset');
          const legend = ownerDocument.createElement('legend');
          legend.textContent = '选择一个答案';
          fieldset.append(legend);
          for (const option of question.options ?? []) {
            const label = ownerDocument.createElement('label');
            label.className = 'practice-option';
            const input = ownerDocument.createElement('input');
            input.type = 'radio';
            input.name = 'choice';
            input.value = option.id;
            input.required = true;
            const text = ownerDocument.createElement('span');
            text.textContent = option.text;
            label.append(input, text);
            fieldset.append(label);
          }
          form.append(fieldset);
        }
        const submit = ownerDocument.createElement('button');
        submit.type = 'submit';
        submit.className = 'practice-submit';
        submit.textContent = '提交答案';
        form.append(submit);
        // A preserved form owns one local attempt even when another page has
        // completed the saved attempt. Repeated events from that form stay one.
        let submitted = false;
        form.addEventListener?.('submit', (event) => {
          event.preventDefault();
          if (submitted) return;
          submitted = true;
          submit.disabled = true;
          const answer = question.kind === 'numeric'
            ? { value: form.querySelector('[name="value"]').value, unit: form.querySelector('[name="unit"]').value }
            : form.querySelector('[name="choice"]:checked')?.value;
          mutateLearning(() => {
            if (practice.getRecord(question)?.awaitingNewAttempt === false) practice.beginAttempt(question);
            return practice.submit(question, answer);
          }, ({ recorded }) => {
            refreshLearningView({ forceQuestionId: question.id });
            progressMessage.textContent = persistenceNotice(recorded ? '已记录本次练习' : '本次提交未新增记录，请点击“再试一次”后作答');
          }, () => {
            submitted = false;
            submit.disabled = false;
          });
        });
        section.append(form);
      } else {
        const retry = ownerDocument.createElement('button');
        retry.type = 'button';
        retry.className = 'practice-retry';
        retry.textContent = '再试一次';
        retry.addEventListener?.('click', () => {
          mutateLearning(() => practice.beginAttempt(question), () => {
            refreshLearningView({ forceQuestionId: question.id });
            progressMessage.textContent = persistenceNotice('已开始新一轮作答，请独立作答后提交');
          });
        });
        section.append(retry);
      }
      section.append(feedback);
      panel.append(section);
    }
    return panel;
  }

  function renderPredictionPanel(simulationId) {
    const prediction = getPrediction(simulationId);
    if (!prediction) return null;
    const ownerDocument = detailHost.ownerDocument ?? document;
    const panel = ownerDocument.createElement('section');
    panel.className = 'prediction-card';
    panel.setAttribute('data-prediction-id', simulationId);
    const heading = ownerDocument.createElement('h3');
    heading.textContent = '先预测，再调参数';
    const prompt = ownerDocument.createElement('p');
    prompt.textContent = prediction.prompt;
    const form = ownerDocument.createElement('form');
    const fieldset = ownerDocument.createElement('fieldset');
    const legend = ownerDocument.createElement('legend');
    legend.textContent = '我的预测';
    fieldset.append(legend);
    for (const option of prediction.options) {
      const label = ownerDocument.createElement('label');
      label.className = 'prediction-option';
      const input = ownerDocument.createElement('input');
      input.type = 'radio';
      input.name = 'prediction';
      input.value = option.id;
      input.checked = experimentPredictions.get(simulationId)?.choice === option.id;
      const text = ownerDocument.createElement('span');
      text.textContent = option.text;
      label.append(input, text);
      fieldset.append(label);
    }
    const button = ownerDocument.createElement('button');
    button.type = 'submit';
    button.textContent = '记录预测';
    const feedback = ownerDocument.createElement('p');
    feedback.className = 'prediction-feedback';
    feedback.setAttribute('role', 'status');
    feedback.textContent = experimentPredictions.get(simulationId)?.feedback ?? '';
    form.append(fieldset, button);
    form.addEventListener?.('submit', (event) => {
      event.preventDefault();
      const choice = form.querySelector('[name="prediction"]:checked')?.value;
      const result = gradePrediction(simulationId, choice);
      if (choice) experimentPredictions.set(simulationId, { choice, feedback: result.feedback });
      feedback.textContent = result.feedback;
    });
    const note = ownerDocument.createElement('small');
    note.textContent = '预测帮助你核对模型，不计入练习通过记录。';
    panel.append(heading, prompt, form, feedback, note);
    return panel;
  }

  function updateRouteMeta() {
    const routeState = getRouteState(currentRoute, selectedId, progress);
    const index = currentRoute.nodeIds.indexOf(selectedId);
    routeTitle.textContent = activeView === '完整图谱' ? '第 9—16 章知识总览' : currentRoute.title;
    routeMeta.textContent = activeView === '完整图谱'
      ? `${catalog.nodes.length} 个知识点 · ${catalog.edges.length} 条关系 · 点击章节卡片展开`
      : `${routeState.total} 个知识点 · 概览约 ${currentRoute.minutes} 分钟 · 自评掌握 ${routeState.done}/${routeState.total}`;
    routeGoal.textContent = activeView === '完整图谱'
      ? '先按章节定位，再用节点和连线追踪先修、推导与应用。'
      : currentRoute.goal;
    const chapter = catalog.chapters.find((item) => item.id === byId.get(selectedId)?.chapterId);
    detailStep.textContent = chapter ? `第 ${chapter.number} 章 / ${chapter.title}` : '自由探索';
    const routeQuestions = currentRoute.nodeIds.flatMap((id) => questionsByNode(id));
    const passed = routeQuestions.filter((question) => practice.getRecord(question)?.passed).length;
    progressSummary.textContent = `当前路线「${currentRoute.title}」自评掌握 ${routeState.done} / ${routeState.total} 个节点；历史练习通过 ${passed} / ${routeQuestions.length} 题。`;
    updateReviewQueue();
    const nextButton = root.querySelector('.next-station');
    if (nextButton) nextButton.disabled = !routeState.inRoute || routeState.complete;
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
    const detail = renderNodeDetail(node, { prerequisites, next }, catalog.sources);
    const tabs = root.querySelector('.detail-tabs');
    const tabButtons = [...root.querySelectorAll('[role="tab"][data-tab]')];
    const summary = detail.querySelector('[data-detail-kind="summary"]');
    summary?.after?.(tabs);
    const formulaElement = detail.querySelector?.('.detail-section .formula');
    if (formulaElement) renderFormula(formulaElement, { text: node.formula, latex: formulaLatexFor(node) });
    if (currentTab === 'experiment' && node.simulationId === 'pendulum' && formulaElement) {
      const explanation = (detailHost.ownerDocument ?? document).createElement('p');
      explanation.className = 'experiment-formula-reading';
      explanation.textContent = '摆长增大 4 倍，周期增大 2 倍。';
      formulaElement.parentElement?.append(explanation);
    }
    if (currentTab === 'experiment' && !node.simulationId) currentTab = 'understand';
    workspace.classList.toggle('has-experiment', currentTab === 'experiment');
    detail.setAttribute('data-tab', currentTab);
    detail.setAttribute('role', 'tabpanel');
    detail.setAttribute('aria-labelledby', `detail-tab-${currentTab}`);
    tabButtons.forEach((button) => {
      const isExperiment = button.dataset.tab === 'experiment';
      button.classList.toggle('is-hidden', isExperiment && !node.simulationId);
      button.setAttribute('aria-selected', String(button.dataset.tab === currentTab));
      button.setAttribute('tabindex', button.dataset.tab === currentTab ? '0' : '-1');
      button.setAttribute('id', `detail-tab-${button.dataset.tab}`);
      button.setAttribute('aria-controls', 'detail-content');
    });
    if (node.simulationId) {
      const ownerDocument = detailHost.ownerDocument ?? document;
      if (currentTab === 'experiment') {
        const predictionPanel = renderPredictionPanel(node.simulationId);
        if (predictionPanel) {
          const disclosure = ownerDocument.createElement('details');
          disclosure.className = 'prediction-disclosure';
          const label = ownerDocument.createElement('summary');
          label.textContent = '先预测，再观察';
          disclosure.append(label, predictionPanel);
          detail.append(disclosure);
        }
      }
      const launch = ownerDocument.createElement('button');
      launch.type = 'button';
      launch.className = 'simulation-launch-button';
      launch.textContent = '重置演示';
      launch.setAttribute('data-action', 'open-simulation');
      launch.setAttribute('data-node-id', node.id);
      const simulationMount = ownerDocument.createElement('div');
      simulationMount.className = 'simulation-mount';
      simulationMount.setAttribute('aria-label', `${node.title}微型演示区域`);
      detail.append(launch, simulationMount);
      activeSimulationMount = simulationMount;
    }
    if (currentTab === 'practice') detail.append(renderPracticePanel(node.id));
    detailHost.replaceChildren(detail);
    renderDirectory();
    const status = progress.getAll()[id] ?? 'new';
    feedback.textContent = status === 'mastered' ? '已自评掌握；做题记录另行计算。' : status === 'review' ? '已加入待复习。' : '尚未自评。';
    updateRouteMeta();
    if (currentTab === 'experiment' && node.simulationId && activeSimulationMount) {
      try { activeSimulationCleanup = mountSimulation(activeSimulationMount, node.simulationId); }
      catch (error) { activeSimulationMount.textContent = `演示无法加载：${error.message}`; }
      const playback = activeSimulationMount.querySelector('.simulation-playback');
      const reset = detail.querySelector('.simulation-launch-button');
      if (playback && reset) playback.append(reset);
    }
  }

  function selectNode(id, { focus = false } = {}) {
    if (!byId.has(id)) return;
    selectedId = id;
    currentChapter = catalog.chapters.find((chapter) => chapter.id === byId.get(id).chapterId) ?? currentChapter;
    graph?.selectNode(id);
    updateDetail(id);
    syncLocation();
    if (focus) focusDetail();
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
    workspace.classList.toggle('is-full-graph', label === '完整图谱');
    root.querySelector('#view-select').value = label;
    root.querySelectorAll('.nav-button').forEach((button) => button.setAttribute('aria-current', button.dataset.view === label ? 'page' : 'false'));
    root.querySelector('.view-status span').textContent = label;
    const isKnownView = ['速学路线', '完整图谱', '章节地图', '教材评估'].includes(label);
    const isGraphView = label === '速学路线' || label === '完整图谱';
    viewNotice.classList.toggle('is-hidden', isKnownView);
    root.querySelector('.detail-panel').classList.toggle('is-hidden', !isGraphView);
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
    syncLocation();
  }

  function selectRoute(routeId) {
    currentRoute = allRoutes.find((route) => route.id === routeId) ?? allRoutes[0];
    root.querySelector('#route-select').value = currentRoute.id;
    selectedId = currentRoute.nodeIds[0];
    searchIds = null;
    root.querySelector('.search-input').value = '';
    noResults.classList.add('is-hidden');
    if (activeView !== '速学路线') changeView('速学路线');
    else renderGraphForView();
    updateDetail(selectedId);
    syncLocation();
  }

  root.querySelector('#route-select').addEventListener('change', (event) => selectRoute(event.target.value));
  root.querySelector('#chapter-select').addEventListener('change', (event) => {
    currentChapter = catalog.chapters.find((chapter) => chapter.id === event.target.value) ?? catalog.chapters[0];
    if (activeView === '章节地图') renderStudyView();
    syncLocation();
  });

  root.querySelectorAll('[role="tab"][data-tab]').forEach((button) => button.addEventListener('click', () => {
    currentTab = button.dataset.tab;
    updateDetail(selectedId);
    syncLocation();
    focusDetail();
  }));

  root.querySelector('.detail-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...root.querySelectorAll('[role="tab"][data-tab]')].filter((tab) => !tab.classList.contains('is-hidden'));
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    currentTab = tabs[nextIndex].dataset.tab;
    updateDetail(selectedId);
    syncLocation();
    tabs[nextIndex].focus();
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
    const directoryNode = event.target.closest?.('[data-directory-node]');
    if (directoryNode) {
      closeDirectory();
      selectNode(directoryNode.getAttribute('data-directory-node'), { focus: true });
      return;
    }
    const relatedNode = event.target.closest?.('.related-node[data-node-id]');
    if (relatedNode) {
      const id = relatedNode.getAttribute('data-node-id');
      const chapterRoute = activeView === '章节地图' ? chapterRouteById.get(currentChapter.id) : null;
      if (chapterRoute?.nodeIds.includes(id)) {
        currentRoute = chapterRoute;
        selectedId = id;
        root.querySelector('#route-select').value = chapterRoute.id;
        changeView('速学路线');
      } else if (activeView !== '完整图谱') changeView('完整图谱');
      else if (searchIds) clearSearch();
      selectNode(id, { focus: true });
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
    if (action?.dataset.action === 'start-practice') {
      currentTab = 'practice';
      updateDetail(selectedId);
      syncLocation();
      focusDetail();
    } else if (action?.dataset.action === 'today-review') {
      const open = action.getAttribute('aria-expanded') !== 'true';
      updateReviewQueue();
      action.setAttribute('aria-expanded', String(open));
      root.querySelector('#review-queue').classList.toggle('is-hidden', !open);
      if (open) root.querySelector('#review-queue').scrollIntoView?.({ block: 'start', behavior: 'instant' });
    } else if (action?.dataset.action === 'start-review') {
      const question = questions.find((item) => item.id === action.getAttribute('data-question-id'));
      if (question && byId.has(question.nodeId)) mutateLearning(() => practice.beginAttempt(question), () => {
        currentTab = 'practice';
        if (activeView !== '速学路线' && activeView !== '完整图谱') changeView('速学路线');
        selectNode(question.nodeId);
        const heading = detailHost.querySelector(`[data-question-id="${question.id}"] h3`);
        heading?.setAttribute('tabindex', '-1');
        heading?.focus?.({ preventScroll: true });
        heading?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
        progressMessage.textContent = persistenceNotice('已开始复习，请独立作答后提交');
      });
    } else if (action?.dataset.action === 'open-simulation') {
      const node = byId.get(action.getAttribute('data-node-id'));
      if (node?.simulationId && node.id === selectedId && activeSimulationMount) {
        activeSimulationCleanup?.();
        try {
          activeSimulationCleanup = mountSimulation(activeSimulationMount, node.simulationId);
          activeSimulationMount.querySelector('.simulation-playback')?.append(action);
        } catch (error) {
          activeSimulationMount.textContent = `演示无法加载：${error.message}`;
        }
      }
    } else if (action?.dataset.action === 'share-location') {
      const shareUrl = typeof window !== 'undefined' ? window.location?.href ?? '' : '';
      const writeText = typeof navigator !== 'undefined' ? navigator.clipboard?.writeText?.bind(navigator.clipboard) : null;
      Promise.resolve(writeText ? writeText(shareUrl) : Promise.reject(new Error('clipboard unavailable'))).then(() => {
        progressMessage.textContent = '当前位置链接已复制，可以发给同学。';
      }).catch(() => {
        revealProgress();
        const fallback = root.querySelector('#share-fallback');
        fallback.value = shareUrl;
        root.querySelector('#share-fallback-label').classList.remove('is-hidden');
        fallback.select();
        progressMessage.textContent = '无法自动复制，请选中下方完整链接复制。';
      });
    } else if (action?.dataset.action === 'clear-progress') {
      if (typeof window === 'undefined' || !window.confirm || window.confirm('清空此浏览器中的自评状态？练习作答记录仍会保留。')) {
        mutateLearning(() => progress.clear(), () => {
          refreshLearningView();
          progressMessage.textContent = persistenceNotice('本地自评已清空，练习记录仍保留');
        });
      }
    } else if (action?.dataset.action === 'export-progress') {
      const blob = new Blob([exportBackupJson(progress, practice)], { type: 'application/json' });
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
      const nodeId = selectedId;
      mutateLearning(() => progress.setStatus(nodeId, 'mastered'), () => {
        refreshLearningView();
        const routeState = getRouteState(currentRoute, selectedId, progress);
        progressMessage.textContent = persistenceNotice(routeState.complete ? '整条路线已自评掌握' : '已记录自评掌握，继续学习请点“下一节”');
      });
    }
    if (event.target.closest?.('.mark-review')) {
      const nodeId = selectedId;
      mutateLearning(() => progress.setStatus(nodeId, 'review'), () => {
        refreshLearningView();
        progressMessage.textContent = persistenceNotice('已加入待复习，可在图谱进度筛选中查看');
      });
    }
    if (event.target.closest?.('.next-station')) {
      const state = getRouteState(currentRoute, selectedId, progress);
      const nextId = state.inRoute ? advanceRoute(currentRoute, selectedId) ?? state.nextUnfinishedId : null;
      if (nextId) selectNode(nextId, { focus: true });
      else progressMessage.textContent = state.complete ? '这条路线已自评完成，可选择另一条路线。' : '此知识点不在当前路线，选择章节继续学习。';
    }
  });

  root.querySelector('#progress-import').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const serialized = await file.text();
      const knownNodes = new Set(catalog.nodes.map((node) => node.id));
      const knownQuestions = new Set(questions.map((question) => question.id));
      const preview = previewBackup(serialized, { progress, practice, knownNodes, knownQuestions });
      const mode = root.querySelector('#progress-import-mode').value;
      const verb = mode === 'replace' ? '替换当前全部记录' : '合并并保留本机已有状态';
      const questionSummary = preview.practice ? `；练习 ${preview.practice.imported} 条，新增 ${preview.practice.added} 条、冲突 ${preview.practice.conflicts} 条` : '；旧版文件不含练习记录，现有练习不受影响';
      const message = `文件中自评 ${preview.progress.imported} 条，新增 ${preview.progress.added} 条、冲突 ${preview.progress.conflicts} 条${questionSummary}。将${verb}，是否继续？`;
      if (typeof window !== 'undefined' && window.confirm && !window.confirm(message)) {
        progressMessage.textContent = '已取消导入，原进度保持不变。';
        return;
      }
      mutateLearning(() => {
        // Revalidate against the snapshot obtained under the granted lock.
        const currentPreview = previewBackup(serialized, { progress, practice, knownNodes, knownQuestions });
        const oldProgress = progress.exportJson();
        const oldPractice = { schemaVersion: 2, records: practice.getAll() };
        const progressPayload = currentPreview.version === 1 ? currentPreview.payload : currentPreview.payload.selfAssessment;
        if (learningStorage.storage) learningStorage.beginTransaction();
        try {
          progress.importJson(JSON.stringify(progressPayload), knownNodes, { mode });
          if (currentPreview.version === 2) practice.importSnapshot(currentPreview.payload.practice, { mode, knownQuestionIds: knownQuestions });
          if (learningStorage.storage) learningStorage.commitTransaction();
        } catch (error) {
          learningStorage.rollbackTransaction?.();
          progress = createProgressStore(null);
          progress.importJson(oldProgress, knownNodes, { mode: 'replace' });
          practice = createPracticeStore(null);
          practice.importSnapshot(oldPractice, { mode: 'replace', knownQuestionIds: knownQuestions });
          throw error;
        }
      }, () => {
        refreshLearningView();
        progressMessage.textContent = persistenceNotice(`自评${preview.version === 1 ? '' : '与练习'}记录已验证并${mode === 'replace' ? '替换' : '合并'}`);
      });
    } catch (error) {
      revealProgress();
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

  graphRoot.addEventListener('physics-node-select', (event) => selectNode(event.detail.id, { focus: true }));

  const restoreLocation = () => {
    if (typeof window === 'undefined') return;
    restoringLocation = true;
    const state = parseLocation(window.location.hash, { ...catalog, routes: allRoutes });
    currentRoute = allRoutes.find((route) => route.id === state.routeId) ?? allRoutes[0];
    currentChapter = catalog.chapters.find((chapter) => chapter.id === state.chapterId) ?? catalog.chapters[0];
    selectedId = state.nodeId ?? currentRoute.nodeIds[0];
    currentTab = state.tab;
    root.querySelector('#route-select').value = currentRoute.id;
    root.querySelector('#chapter-select').value = currentChapter.id;
    changeView({ graph: '完整图谱', chapter: '章节地图', guide: '教材评估' }[state.view] ?? '速学路线');
    updateDetail(selectedId);
    restoringLocation = false;
    focusDetail();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener?.('popstate', restoreLocation);
    window.addEventListener?.('hashchange', restoreLocation);
    window.addEventListener?.('storage', onLearningStorage);
    window.addEventListener?.('focus', onReturningFocus);
    document.addEventListener?.('visibilitychange', onVisibilityChange);
    scheduleDayRollover();
  }

  if (activeView === '章节地图' || activeView === '教材评估') changeView(activeView, true);
  else renderGraphForView();
  updateDetail(selectedId);
  if (learningStorage.state === 'damaged') progressMessage.textContent = '本地学习记录无法读取；原始存储未覆盖。此次使用仅保存在内存，请导出备份。';
  else if (learningStorage.getLegacySyncState?.() === 'out-of-sync') progressMessage.textContent = '旧版进度镜像未同步；若要回退页面，请先导出学习进度备份。';
  else if (progress.getPersistenceState() === 'memory' || practice.getPersistenceState() === 'memory') progressMessage.textContent = '进度仅在本次打开期间保存，请导出备份。';
  if (learningStorage.state === 'damaged' || learningStorage.getLegacySyncState?.() === 'out-of-sync' || progress.getPersistenceState() === 'memory' || practice.getPersistenceState() === 'memory') revealProgress();
  return { progress, selectNode, destroy() {
    destroyed = true;
    activeSimulationCleanup?.(); removeMotionListener?.(); graph?.destroy();
    if (typeof window !== 'undefined') {
      window.removeEventListener?.('popstate', restoreLocation);
      window.removeEventListener?.('hashchange', restoreLocation);
      window.removeEventListener?.('storage', onLearningStorage);
      window.removeEventListener?.('focus', onReturningFocus);
      document.removeEventListener?.('visibilitychange', onVisibilityChange);
      window.clearTimeout?.(rolloverTimer);
    }
    root.innerHTML = '';
  } };
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
