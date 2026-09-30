import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function mountPreviewApp() {
  const originalHTMLElement = globalThis.HTMLElement;
  const originalDocument = globalThis.document;
  globalThis.HTMLElement = class TestHTMLElement {};
  globalThis.document = { querySelector: () => null };

  class TestElement {
    constructor({ className = '', dataset = {}, textContent = '' } = {}) {
      this.classes = new Set(className.split(/\s+/).filter(Boolean));
      this.classList = {
        toggle: (name, force = !this.classes.has(name)) => {
          if (force) this.classes.add(name);
          else this.classes.delete(name);
          return force;
        },
        contains: (name) => this.classes.has(name),
      };
      this.dataset = dataset;
      this.textContent = textContent;
      this.innerHTML = textContent;
      this.attributes = {};
      this.listeners = new Map();
      this.value = '';
    }
    get innerHTML() { return this.textContent; }
    set innerHTML(markup) { this.textContent = String(markup).replace(/<[^>]*>/g, ''); }
    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }
    dispatchEvent(event) {
      const dispatchedEvent = {
        ...event,
        currentTarget: this,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
      };
      for (const listener of this.listeners.get(dispatchedEvent.type) ?? []) listener(dispatchedEvent);
      return !dispatchedEvent.defaultPrevented;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() {}
  }

  class TestRoot extends globalThis.HTMLElement {
    constructor() {
      super();
      this.classes = new Set();
      this.classList = {
        toggle: (name, force = !this.classes.has(name)) => {
          if (force) this.classes.add(name);
          else this.classes.delete(name);
          return force;
        },
        contains: (name) => this.classes.has(name),
      };
      this.nodeElements = [];
      this.elements = new Map();
      this._innerHTML = '';
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(markup) {
      this._innerHTML = markup;
      this.nodeElements = [...markup.matchAll(/<g class="([^"]*\bgraph-node\b[^"]*)"[^>]*data-node-index="(\d+)"/g)].map(([, className, index]) => new TestElement({ className, dataset: { nodeIndex: index } }));

      const textFor = (selector) => {
        const patterns = {
          '#detail-title': /<h2 id="detail-title">([^<]*)<\/h2>/,
          '.detail-summary': /<p class="detail-summary">([^<]*)<\/p>/,
          '.formula': /<div class="formula"[^>]*>([^<]*)<\/div>/,
          '.detail-note': /<div class="detail-note">([^<]*)<\/div>/,
          '.detail-step': /<span class="detail-step">([^<]*)<\/span>/,
          '#node-announcement': /<p id="node-announcement"[^>]*>([^<]*)<\/p>/,
          '.no-results': /<p class="no-results[^>]*>([^<]*)/,
        };
        return markup.match(patterns[selector])?.[1] ?? '';
      };
      for (const selector of ['#detail-title', '.detail-summary', '.formula', '.detail-note', '.detail-step', '#node-announcement', '.no-results']) {
        this.elements.set(selector, new TestElement({ textContent: textFor(selector) }));
      }
    }
    querySelectorAll(selector) {
      if (selector === '.graph-node') return this.nodeElements;
      if (selector === '.nav-button') return Array.from({ length: 4 }, () => new TestElement());
      return [];
    }
    querySelector(selector) {
      if (!this.elements.has(selector)) this.elements.set(selector, new TestElement());
      return this.elements.get(selector);
    }
  }

  try {
    const appUrl = pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'app.js')).href;
    const { mountApp } = await import(appUrl);
    const root = new TestRoot();
    mountApp(root, null);
    return root;
  } finally {
    if (originalHTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = originalHTMLElement;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

test('fallback preview uses a Chinese page kicker', async () => {
  const markup = (await mountPreviewApp()).innerHTML;
  assert.match(markup, /物理学 · 下册/);
  assert.doesNotMatch(markup, /PHYSICS · LOWER VOLUME/);
});

function mobileRuleDeclarations(styles, selector) {
  const mediaStart = styles.indexOf('@media (max-width: 760px)');
  assert.notEqual(mediaStart, -1, 'a narrow-screen layout should be defined at 760px');
  const open = styles.indexOf('{', mediaStart);
  let depth = 1;
  let close = open + 1;
  while (depth > 0 && close < styles.length) {
    if (styles[close] === '{') depth += 1;
    if (styles[close] === '}') depth -= 1;
    close += 1;
  }
  const mobileStyles = styles.slice(open + 1, close - 1);
  const rule = [...mobileStyles.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, selectors]) => selectors.split(',').map((item) => item.trim()).includes(selector));
  assert.ok(rule, selector + ' should have a narrow-screen rule');
  return Object.fromEntries(rule[2].split(';').map((declaration) => declaration.trim()).filter(Boolean).map((declaration) => {
    const [property, ...value] = declaration.split(':');
    return [property.trim(), value.join(':').trim()];
  }));
}

test('site document has the required metadata, app region, and resolvable local assets', () => {
  const htmlPath = path.join(projectRoot, 'dist', 'index.html');
  assert.ok(fs.existsSync(htmlPath), 'dist/index.html should exist');

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /<html\b[^>]*\blang=["']zh-CN["']/i, 'document language should be zh-CN');
  assert.match(html, /<title>[^<]*(?:物理|Physics)[^<]*<\/title>/i, 'title should describe the physics knowledge map');
  assert.match(html, /<meta\b[^>]*name=["']viewport["'][^>]*>/i, 'document should include a viewport meta tag');
  assert.match(html, /<main\b[^>]*id=["']app["'][^>]*>/i, 'document should include the #app main region');

  const localReferences = [
    ...html.matchAll(/\b(?:src|href)=["'](\.\/?[^"']+)["']/gi),
  ].map((match) => match[1]);
  assert.ok(localReferences.some((reference) => /\.m?js(?:[?#].*)?$/i.test(reference)), 'a relative module script reference should exist');
  assert.ok(localReferences.some((reference) => /\.css(?:[?#].*)?$/i.test(reference)), 'a relative stylesheet reference should exist');
  assert.ok(localReferences.some((reference) => /\.svg(?:[?#].*)?$/i.test(reference)), 'a relative SVG favicon reference should exist');

  for (const reference of localReferences) {
    const fileReference = reference.split(/[?#]/, 1)[0];
    assert.ok(fs.existsSync(path.resolve(path.dirname(htmlPath), fileReference)), `${reference} should resolve to a local file`);
  }
});

test('rendered route nodes remain separately named keyboard controls in a non-atomic SVG group', async () => {
  const markup = (await mountPreviewApp()).innerHTML;
  const svg = markup.match(/<svg class="route-graph"[^>]*>/)?.[0];
  assert.ok(svg, 'the route graph should render as an SVG');
  assert.match(svg, /\brole="group"/, 'the SVG should expose a non-atomic group');
  assert.match(svg, /\baria-label="[^"]+"/, 'the SVG group should have a readable label');
  assert.doesNotMatch(svg, /\brole="img"/, 'an atomic image role must not hide interactive descendants');

  const nodes = [...markup.matchAll(/<g class="graph-node[^\"]*"[^>]*>/g)].map(([element]) => element);
  assert.equal(nodes.length, 3, 'the preview route should expose each of its three stations');
  for (const node of nodes) {
    assert.match(node, /\brole="button"/, 'each station should remain an individual control');
    assert.match(node, /\btabindex="0"/, 'each station should be reachable by keyboard');
    assert.match(node, /\baria-label="[^"]+"/, 'each station should have its own accessible name');
  }
});

test('rendered app has labeled page landmarks, a heading hierarchy, and named search controls', async () => {
  const markup = (await mountPreviewApp()).innerHTML;
  assert.match(markup, /<header\b/, 'the app should expose its page header landmark');
  assert.match(markup, /<nav class="primary-nav" aria-label="主导航">/, 'navigation should have an accessible name');
  assert.match(markup, /<h1\b[^>]*id="page-title"/, 'the page should have one semantic top-level heading');
  assert.match(markup, /<section class="workspace" aria-label="[^"]+">/, 'the learning workspace should have a named region');
  assert.match(markup, /<input class="search-input"[^>]*aria-label="搜索概念或公式"/, 'search should have an explicit accessible label');
  assert.match(markup, /<button class="motion-button" type="button" aria-pressed="false">暂停动态<\/button>/, 'motion control should have a visible accessible name');
  assert.match(markup, /<footer class="bottom-note">/, 'the app should expose its footer landmark');
});

test('the study views render chapter structure and all five evidence-based assessment sections', async () => {
  const markup = (await mountPreviewApp()).innerHTML;
  for (const view of ['速学路线', '完整图谱', '章节地图', '教材评估']) {
    assert.match(markup, new RegExp(`data-view="${view}"`), `${view} should remain available in the rendered navigation`);
  }

  const moduleUrl = pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'assessment.js')).href;
  const views = await import(moduleUrl).catch(() => null);
  assert.ok(views, 'chapter and assessment view renderers should be available');

  const { assessment, chapters, nodes, routes } = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'data', 'physics-data.js')).href);
  const chapterMarkup = views.renderChapter(chapters[0], nodes.filter((node) => node.chapterId === chapters[0].id), {});
  const assessmentMarkup = views.renderAssessment(assessment);
  assert.match(chapterMarkup, /核心路径/, 'chapter view should distinguish a core route');
  assert.match(chapterMarkup, /扩展分支/, 'chapter view should distinguish extension content');
  assert.match(chapterMarkup, /0%/, 'an unstarted chapter should report zero mastery');
  assert.ok(routes.some((route) => chapterMarkup.includes(route.id)), 'chapter view should link its relevant study route');
  for (const label of ['内容结构', '数学先修', '难点分布', '工程联系', '学习策略']) {
    assert.ok(assessmentMarkup.includes(label), `assessment view should include the ${label} section`);
  }
});

test('chapter 16 has a clickable local core sequence when no global route covers it', async () => {
  const views = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'assessment.js')).href);
  const { chapters, nodes, chapterStudyPaths } = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'data', 'physics-data.js')).href);
  const chapter = chapters.find((item) => item.id === 'ch-16');
  const chapterNodes = nodes.filter((node) => node.chapterId === chapter.id);
  const coreIds = chapterStudyPaths[chapter.id].filter((id) => chapterNodes.find((node) => node.id === id)?.level === 'core');
  const markup = views.renderChapter(chapter, chapterNodes, {});
  const pathMarkup = markup.match(/<section class="chapter-section" aria-labelledby="chapter-route-title">([\s\S]*?)<\/section>/)?.[1] ?? '';

  assert.match(pathMarkup, /本章核心路径/, 'chapter 16 should offer its directory-order local core path');
  assert.deepEqual([...pathMarkup.matchAll(/data-node-id="([^"]+)"/g)].map((match) => match[1]), coreIds, 'each core step should be an existing clickable node in data order');
});

test('a chapter with cross-chapter routes still exposes its complete local core sequence', async () => {
  const views = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'assessment.js')).href);
  const { chapters, nodes, chapterStudyPaths } = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'data', 'physics-data.js')).href);
  const chapter = chapters.find((item) => item.id === 'ch-13');
  const chapterNodes = nodes.filter((node) => node.chapterId === chapter.id);
  const coreIds = chapterStudyPaths[chapter.id].filter((id) => chapterNodes.find((node) => node.id === id)?.level === 'core');
  const markup = views.renderChapter(chapter, chapterNodes, {});
  const pathMarkup = markup.match(/<section class="chapter-section" aria-labelledby="chapter-route-title">([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.deepEqual([...pathMarkup.matchAll(/data-node-id="([^"]+)"/g)].map((match) => match[1]), coreIds);
});

test('assessment distinguishes the publisher audience from this site audience and links the HEP source', async () => {
  const views = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'assessment.js')).href);
  const { assessment, sourceNotes } = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'data', 'physics-data.js')).href);
  const markup = views.renderAssessment(assessment);

  assert.match(markup, /教材适用对象/, 'assessment should explicitly label the publisher-described book audience');
  assert.doesNotMatch(markup, /本书可作为高等学校理工科非物理学类专业大学物理课程的教材，也可供文科相关专业选用和社会读者阅读/, 'publisher audience should be summarized in original prose rather than closely repeating the source');
  assert.doesNotMatch(markup, /内容涵盖课程基本要求中的核心内容，并选入一定数量的扩展内容供不同专业选用/, 'publisher content scope should also be paraphrased');
  assert.match(markup, /高校理工类非物理专业.*大学物理教学/, 'book audience should retain its primary course context');
  assert.match(markup, /文科相关专业.*读者.*按需参考/, 'book audience should retain its additional humanities and general-reader scope');
  assert.match(markup, /课程要求中的基础内容.*主线/, 'book scope should retain its core-course foundation');
  assert.match(markup, /拓展主题.*各专业按需选读/, 'book scope should retain optional extension content');
  assert.match(markup, /本站面向.*大学生.*自学/, 'site audience should be separately identified as university students studying independently');
  assert.ok(markup.includes('href="' + sourceNotes[0].url + '"'), 'assessment should link to the existing official HEP source note');
});

test('Enter selects the focused route node and updates its details', async () => {
  const root = await mountPreviewApp();
  const [firstNode, secondNode] = root.querySelectorAll('.graph-node');

  secondNode.dispatchEvent({ type: 'keydown', key: 'Enter' });

  assert.equal(root.querySelector('#detail-title').textContent, '振动合成');
  assert.equal(root.querySelector('.detail-summary').textContent, '同一位置的多个振动遵循叠加原理；相位差决定合振幅，频率接近时会出现拍。');
  assert.equal(root.querySelector('.formula').textContent, 'x = x₁ + x₂');
  assert.equal(root.querySelector('.detail-note').textContent, '从振动叠加出发，下一步可以理解波的干涉与驻波。');
  assert.equal(root.querySelector('.detail-step').textContent, '02 / 03');
  assert.equal(root.querySelector('#node-announcement').textContent, '已选择知识点：振动合成。');
  assert.equal(firstNode.classList.contains('is-selected'), false);
  assert.equal(secondNode.classList.contains('is-selected'), true);
});

test('Space selects the focused route node and updates its details', async () => {
  const root = await mountPreviewApp();
  const [firstNode, , thirdNode] = root.querySelectorAll('.graph-node');

  thirdNode.dispatchEvent({ type: 'keydown', key: ' ' });

  assert.equal(root.querySelector('#detail-title').textContent, '机械波');
  assert.equal(root.querySelector('.detail-summary').textContent, '波把振动状态从一处传到另一处，介质质点在平衡位置附近振动，能量随波传播。');
  assert.equal(root.querySelector('.formula').textContent, 'y(x,t) = A cos(ωt − kx + φ)');
  assert.equal(root.querySelector('.detail-note').textContent, '波的叠加带来干涉、驻波，也为光的波动现象建立直觉。');
  assert.equal(root.querySelector('.detail-step').textContent, '03 / 03');
  assert.equal(root.querySelector('#node-announcement').textContent, '已选择知识点：机械波。');
  assert.equal(firstNode.classList.contains('is-selected'), false);
  assert.equal(thirdNode.classList.contains('is-selected'), true);
});

test('the live reading shell gives mobile learners a closed directory before the concept', () => {
  const app = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'app.js'), 'utf8');
  const markup = app.slice(app.indexOf('function mountStudyApp'), app.indexOf('export function mountApp'));
  const styles = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'styles.css'), 'utf8');
  assert.doesNotMatch(markup, /class="intro"|从一个知识点，走进整章物理/);
  assert.match(markup, /class="directory-toggle" aria-expanded="false" aria-controls="reading-directory-panel"/);
  assert.match(markup, /《物理学》第七版 · 下册/);
  assert.equal(mobileRuleDeclarations(styles, '.directory-toggle').display, 'block');
  assert.equal(mobileRuleDeclarations(styles, '#reading-directory-panel').display, 'none');
  assert.equal(mobileRuleDeclarations(styles, '.directory-open #reading-directory-panel').display, 'block');
});

test('mobile navigation uses a labeled compact selector while the graph keeps its pan/zoom surface', () => {
  const app = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'styles.css'), 'utf8');
  assert.match(app, /<select id="view-select"[^>]*aria-label="切换学习视图"/, 'narrow-screen navigation should expose a native labeled view selector');
  assert.match(app, /#view-select[\s\S]*?addEventListener\('change'/, 'the view selector should switch views');
  assert.equal(mobileRuleDeclarations(styles, '.primary-nav .nav-button').display, 'none', 'wide navigation buttons should yield to the selector');
  assert.equal(mobileRuleDeclarations(styles, '.view-select-label').display, 'block', 'the compact selector should appear on narrow screens');
  assert.match(styles, /\.graph-canvas\s*\{[^}]*overflow:\s*hidden[^}]*touch-action:\s*none/s, 'the graph should retain its pan/zoom interaction surface');
  assert.equal(mobileRuleDeclarations(styles, '.workspace').display, 'flex', 'the detail panel should remain in mobile page flow');
  assert.equal(mobileRuleDeclarations(styles, '.workspace')['flex-direction'], 'column', 'the directory and concept should stack on mobile');
  assert.match(styles, /\.detail-panel\s*\{[^}]*min-width:\s*0/s, 'the in-flow detail panel should shrink without forcing horizontal overflow');
});

test('the native view selector updates the current view announcement', async () => {
  const root = await mountPreviewApp();
  const selector = root.querySelector('#view-select');
  selector.value = '章节地图';
  selector.dispatchEvent({ type: 'change', target: selector });
  assert.equal(root.querySelector('.view-status span').textContent, '章节地图');
});

test('node selection has a polite live announcement and the graph keeps its keyboard node list', () => {
  const app = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'app.js'), 'utf8');
  const graph = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'graph.js'), 'utf8');
  assert.match(app, /<p id="node-announcement"[^>]*aria-live="polite"[^>]*aria-atomic="true"/, 'the selected node should be announced without moving focus');
  assert.match(app, /nodeAnnouncement\.textContent\s*=/, 'selection should update the live region');
  assert.match(graph, /<details class="graph-node-index"[^>]*><summary>按章节键盘浏览全部知识点/, 'the graph should keep its chapter keyboard index');
  assert.match(graph, /<button type="button" class="graph-node-list/, 'the index should provide ordinary keyboard buttons for graph nodes');
});

test('all loaded assets stay local and motion controls respect reduced-motion settings', async () => {
  const html = fs.readFileSync(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'app.js'), 'utf8');
  const simulations = fs.readFileSync(path.join(projectRoot, 'dist', 'assets', 'simulations.js'), 'utf8');
  const loadedElements = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)].map(([, reference]) => reference);
  assert.ok(loadedElements.every((reference) => !/^https?:\/\//i.test(reference) && !reference.startsWith('//')), 'scripts and stylesheets should load only from the static site');
  assert.doesNotMatch(styles, /@import\s+url\s*\(\s*["']?https?:|url\(\s*["']?https?:/i, 'styles should not request remote fonts or assets');
  assert.doesNotMatch(app, /(?:from\s*|import\s*\()\s*["']https?:\/\//i, 'runtime modules should not import over the network');
  assert.match(app, /<button class="motion-button" type="button" aria-pressed="false">暂停动态<\/button>/, 'the motion toggle should expose its action and pressed state');
  assert.match(styles, /:focus-visible[^\{]*\{[^}]*outline:\s*2px/s, 'keyboard controls should retain a visible focus indicator');
  assert.match(styles, /\.graph-node:focus-visible \.node-orbit, \.graph-node:hover \.node-orbit\s*\{[^}]*stroke:\s*var\(--amber\)/, 'SVG graph focus should remain visible after suppressing the default outline');
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'CSS should respect the system reduced-motion preference');
  assert.match(simulations, /class="simulation-result" data-role="result" aria-live="polite"/, 'simulation results should be announced when values change');

  const root = await mountPreviewApp();
  const motionButton = root.querySelector('.motion-button');
  motionButton.dispatchEvent({ type: 'click', currentTarget: motionButton });
  assert.equal(motionButton.attributes['aria-pressed'], 'true');
  assert.equal(motionButton.textContent, '恢复动态');
  assert.equal(root.classList.contains('reduced-motion'), true);
});

test('progress stays available in memory when browser storage throws', async () => {
  const { createProgressStore } = await import(pathToFileURL(path.join(projectRoot, 'dist', 'assets', 'study.js')).href);
  const unavailableStorage = {
    getItem() { throw new Error('storage is blocked'); },
    setItem() { throw new Error('storage is blocked'); },
    removeItem() { throw new Error('storage is blocked'); },
  };
  const progress = createProgressStore(unavailableStorage);
  progress.setStatus('c9-shm', 'mastered');
  assert.deepEqual(progress.getAll(), { 'c9-shm': 'mastered' });
  progress.clear();
  assert.deepEqual(progress.getAll(), {});
});

test('empty search restores route nodes and an unmatched query exposes a no-results status', async () => {
  const root = await mountPreviewApp();
  const search = root.querySelector('.search-input');
  const noResults = root.querySelector('.no-results');
  search.value = 'no physics concept can match this';
  search.dispatchEvent({ type: 'input', target: search });
  assert.equal(noResults.classList.contains('is-hidden'), false);
  assert.match(noResults.textContent, /没有找到匹配的路线节点/);
  assert.equal(root.nodeElements.every((node) => node.classList.contains('is-hidden')), true);

  search.value = '   ';
  search.dispatchEvent({ type: 'input', target: search });
  assert.equal(noResults.classList.contains('is-hidden'), true);
  assert.equal(root.nodeElements.every((node) => !node.classList.contains('is-hidden')), true);
});
