import test from 'node:test';
import assert from 'node:assert/strict';
import { assessment, chapters, edges, nodes, routes } from '../dist/assets/data/physics-data.js';

const liveMotionObservers = new Set();

function notifyMotionMutation(target) {
  for (const observer of liveMotionObservers) {
    if (observer.targets.has(target)) observer.callback([], observer);
  }
}

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; this.targets = new Set(); liveMotionObservers.add(this); }
  observe(target) { this.targets.add(target); }
  disconnect() { liveMotionObservers.delete(this); this.targets.clear(); }
}

async function loadOptionalModule(url) {
  try {
    return { module: await import(url), error: null };
  } catch (error) {
    return { module: null, error };
  }
}

const studyLoad = await loadOptionalModule('../dist/assets/study.js');
const graphLoad = await loadOptionalModule('../dist/assets/graph.js');

function loaded(result, name) {
  assert.ok(result.module, `${name} module should load (current import result: ${result.error?.code ?? result.error?.name})`);
  return result.module;
}

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.get(String(key)) ?? null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
  clear() { this.#values.clear(); }
}

class MiniElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = '';
    this._textContent = '';
  }
  set textContent(value) { this._textContent = String(value); this.children = []; }
  get textContent() { return this._textContent + this.children.map((child) => child.textContent).join(''); }
  append(...children) {
    for (const child of children) {
      if (child.parentElement?.children) child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
      child.parentElement = this;
      this.children.push(child);
    }
  }
  after(...children) {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    for (const child of children) child.parentElement = this.parentElement;
    siblings.splice(siblings.indexOf(this) + 1, 0, ...children);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      const candidate = { tagName: child.tagName, attributes: child.attributes ?? {}, classes: new Set((child.className ?? '').split(/\s+/)) };
      if (FakeControl.prototype.matches.call(candidate, selector)) matches.push(child);
      matches.push(...(child.querySelectorAll?.(selector) ?? []));
    }
    return matches;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  click() {}
}

class FakeControl {
  constructor(owner, { tagName = 'div', attributes = {} } = {}) {
    this.owner = owner;
    this.ownerDocument = owner.ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.dataset = Object.fromEntries(Object.entries(attributes)
      .filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.classes = new Set(String(attributes.class ?? '').split(/\s+/).filter(Boolean));
    this.listeners = new Map();
    this.classList = {
      toggle: (name, force = !this.classes.has(name)) => {
        if (force) this.classes.add(name);
        else this.classes.delete(name);
        return force;
      },
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
    };
    this.value = attributes.value ?? '';
    this.textContent = '';
    this.files = [];
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  matches(selector) {
    return selector.split(',').some((part) => {
      const candidate = part.trim();
      const tag = candidate.match(/^[a-z]+/i)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      const classes = [...candidate.matchAll(/\.([\w-]+)/g)].map(([, name]) => name);
      if (!classes.every((name) => this.classes.has(name))) return false;
      const attributes = [...candidate.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)];
      return attributes.every(([, name, value]) => this.attributes[name] !== undefined && (value === undefined || this.attributes[name] === value));
    });
  }
  closest(selector) { return this.matches(selector) ? this : null; }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  dispatch(type, properties = {}) {
    const event = { type, target: this, currentTarget: this, preventDefault() {}, ...properties };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  focus() { this.ownerDocument.activeElement = this; }
  replaceChildren(...children) { this.children = children; }
  append(...children) {
    this.children ??= [];
    for (const child of children) {
      if (child.parentElement?.children) child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
      child.parentElement = this;
      this.children.push(child);
    }
  }
}

function parseMarkupAttributes(markup) {
  return Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
}

class FakeWaveVisual extends FakeControl {
  querySelector(selector) {
    if (!selector.includes('data-wave-path') || !this.innerHTML?.includes('data-wave-path="true"')) return null;
    const visual = this;
    return {
      getAttribute(name) {
        if (name !== 'd') return null;
        const tag = visual.innerHTML.match(/<path\b[^>]*\bdata-wave-path="true"[^>]*>/)?.[0];
        return tag?.match(/\bd="([^"]*)"/)?.[1] ?? null;
      },
      setAttribute(name, value) {
        if (name !== 'd') return;
        const tag = visual.innerHTML.match(/<path\b[^>]*\bdata-wave-path="true"[^>]*>/)?.[0];
        if (tag) visual.innerHTML = visual.innerHTML.replace(tag, tag.replace(/\bd="[^"]*"/, `d="${value}"`));
      },
    };
  }
}

class FakeAppWaveContainer {
  initialize(parentElement) {
    this.parentElement = parentElement;
    this.ownerDocument = parentElement.ownerDocument;
    this.classes = new Set();
    this.controls = [];
    this.elements = new Map();
    const mutate = () => notifyMotionMutation(this);
    this.classList = {
      add: (...names) => { names.forEach((name) => this.classes.add(name)); mutate(); },
      remove: (...names) => { names.forEach((name) => this.classes.delete(name)); mutate(); },
      contains: (name) => this.classes.has(name),
      toggle: (name, force = !this.classes.has(name)) => {
        if (force) this.classes.add(name);
        else this.classes.delete(name);
        mutate();
        return force;
      },
    };
    return this;
  }

  set innerHTML(markup) {
    this.markup = String(markup);
    const inputs = [...this.markup.matchAll(/<input\b([^>]*)>/g)].map(([, attributes]) => new FakeControl(this, { tagName: 'input', attributes: parseMarkupAttributes(attributes) }));
    const selects = [...this.markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].map(([, attributes, options]) => {
      const parsed = parseMarkupAttributes(attributes);
      const selected = options.match(/<option\b[^>]*value="([^"]*)"[^>]*\bselected\b/);
      if (selected) parsed.value = selected[1];
      return new FakeControl(this, { tagName: 'select', attributes: parsed });
    });
    this.controls = [...inputs, ...selects];
    this.elements = new Map([
      ['result', new FakeControl(this, { attributes: { 'data-role': 'result' } })],
      ['validation', new FakeControl(this, { attributes: { 'data-role': 'validation' } })],
      ['visual', new FakeWaveVisual(this, { attributes: { 'data-role': 'visual' } })],
    ]);
    const pauseMarkup = this.markup.match(/<button\b([^>]*data-action="pause"[^>]*)>([\s\S]*?)<\/button>/);
    const pause = new FakeControl(this, {
      tagName: 'button',
      attributes: parseMarkupAttributes(pauseMarkup?.[1] ?? 'data-action="pause"'),
    });
    pause.textContent = pauseMarkup?.[2] ?? '';
    this.elements.set('pause', pause);
  }

  get innerHTML() { return this.markup; }
  querySelectorAll(selector) { return selector.includes('data-param') ? this.controls : []; }
  querySelector(selector) {
    const role = selector.match(/data-role=["']([^"']+)["']/)?.[1];
    if (role) return this.elements.get(role) ?? null;
    if (selector.includes('data-action') && selector.includes('pause')) return this.elements.get('pause') ?? null;
    return null;
  }
  closest(selector) {
    if (selector !== '.reduced-motion') return null;
    for (let node = this; node; node = node.parentElement) {
      if (node.classList?.contains('reduced-motion')) return node;
    }
    return null;
  }
}

function withMiniDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tagName) => new MiniElement(tagName) };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

function fakeGraphRoot(ownerDocument = { activeElement: null }) {
  const events = new Map();
  const viewport = { setAttribute(name, value) { this[name] = value; }, style: {} };
  const svg = { getBoundingClientRect: () => ({ width: 800, height: 450 }) };
  const root = {
    ownerDocument,
    markup: '',
    graphNodes: [],
    listNodes: [],
    filters: [],
    zoomControls: [],
    nodeIndexDetails: null,
    set innerHTML(markup) {
      if (this.ownerDocument.activeElement?.owner === this) this.ownerDocument.activeElement = null;
      this.markup = markup;
      this.graphNodes = [...markup.matchAll(/<g class="([^"]*\bgraph-node\b[^"]*)"[^>]*data-node-id="([^"]+)"/g)]
        .map(([, className, nodeId]) => new FakeControl(this, { tagName: 'g', attributes: { class: className, 'data-node-id': nodeId } }));
      this.listNodes = [...markup.matchAll(/<button type="button" class="([^"]*\bgraph-node-list\b[^"]*)" data-node-id="([^"]+)"/g)]
        .map(([, className, nodeId]) => new FakeControl(this, { tagName: 'button', attributes: { class: className, 'data-node-id': nodeId } }));
      this.filters = [...markup.matchAll(/<select data-filter="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)].map(([, name, options]) => {
        const entries = [...options.matchAll(/<option value="([^"]*)"([^>]*)>/g)];
        const selected = entries.find(([, , attributes]) => /\bselected\b/.test(attributes)) ?? entries[0];
        return new FakeControl(this, { tagName: 'select', attributes: { 'data-filter': name, value: selected?.[1] ?? '' } });
      });
      this.zoomControls = [...markup.matchAll(/<button type="button" data-zoom="([^"]+)"/g)]
        .map(([, action]) => new FakeControl(this, { tagName: 'button', attributes: { 'data-zoom': action } }));
      this.nodeIndexDetails = new FakeControl(this, { tagName: 'details', attributes: { class: 'graph-node-index' } });
      this.nodeIndexDetails.open = /<details class="graph-node-index"[^>]*\bopen(?:\s|>)/.test(markup);
    },
    get innerHTML() { return this.markup; },
    contains(element) { return element?.owner === this; },
    addEventListener(type, listener) {
      const listeners = events.get(type) ?? [];
      listeners.push(listener);
      events.set(type, listeners);
    },
    removeEventListener(type, listener) {
      events.set(type, (events.get(type) ?? []).filter((item) => item !== listener));
    },
    emit(type, event) {
      const dispatched = { type, target: this, ...event, currentTarget: this };
      for (const listener of events.get(type) ?? []) listener(dispatched);
    },
    dispatchEvent(event) { this.emit(event.type, { target: this, detail: event.detail }); return true; },
    querySelector(selector) {
      if (selector === '.graph-world') return viewport;
      if (selector === '.route-graph') return svg;
      if (selector === '.graph-node-index') return this.nodeIndexDetails;
      return this.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      if (selector === '.graph-node') return this.graphNodes;
      if (selector === '.graph-node-list') return this.listNodes;
      if (selector === 'select[data-filter]') return this.filters;
      if (selector === '[data-zoom]') return this.zoomControls;
      const filter = selector.match(/^select\[data-filter="([^"]+)"\]$/);
      if (filter) return this.filters.filter((control) => control.getAttribute('data-filter') === filter[1]);
      return [...this.graphNodes, ...this.listNodes, ...this.filters, ...this.zoomControls]
        .filter((control) => control.matches(selector));
    },
  };
  return root;
}

function fakeAppRoot(ownerDocument) {
  const elements = new Map();
  const listeners = new Map();
  const classes = new Set();
  const root = {
    ownerDocument,
    markup: '',
    classes,
    classList: null,
    graphRoot: null,
    navButtons: [],
    set innerHTML(markup) { this.markup = markup; },
    get innerHTML() { return this.markup; },
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? [];
      current.push(listener);
      listeners.set(type, current);
    },
    emit(type, event) {
      const dispatched = { type, target: this, ...event, currentTarget: this };
      for (const listener of listeners.get(type) ?? []) listener(dispatched);
    },
    querySelector(selector) {
      if (selector === '#graph-mount') return this.graphRoot;
      if (!elements.has(selector)) {
        const id = selector.match(/^#([\w-]+)/)?.[1];
        const tagName = selector === '#route-select' ? 'select' : selector === '#progress-import' || selector === '.search-input' ? 'input' : 'div';
        elements.set(selector, new FakeControl(this, { tagName, attributes: id ? { id } : {} }));
      }
      return elements.get(selector);
    },
    querySelectorAll(selector) { return selector === '.nav-button' ? this.navButtons : []; },
  };
  root.classList = {
    toggle(name, force = !classes.has(name)) {
      if (force) classes.add(name);
      else classes.delete(name);
      notifyMotionMutation(root);
      return force;
    },
    add(...names) { names.forEach((name) => classes.add(name)); notifyMotionMutation(root); },
    remove(...names) { names.forEach((name) => classes.delete(name)); notifyMotionMutation(root); },
    contains: (name) => classes.has(name),
  };
  root.graphRoot = fakeGraphRoot(ownerDocument);
  root.navButtons = ['速学路线', '完整图谱', '章节地图', '教材评估'].map((view, index) =>
    new FakeControl(root, { tagName: 'button', attributes: { class: 'nav-button', 'data-view': view, 'aria-current': index === 0 ? 'page' : 'false' } }));
  return root;
}

async function withMountedStudyApp(run, { matchMedia = () => ({ matches: false }) } = {}) {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const ownerDocument = {
    activeElement: null,
    defaultView: { CustomEvent: globalThis.CustomEvent },
    querySelector: () => null,
    createElement: (tagName) => new MiniElement(tagName),
  };
  globalThis.document = ownerDocument;
  globalThis.window = { localStorage: new MemoryStorage(), matchMedia };
  globalThis.HTMLElement = class FakeHTMLElement {};
  try {
    const appUrl = new URL('../dist/assets/app.js?study-integration=' + Date.now(), import.meta.url);
    const { mountApp } = await import(appUrl.href);
    const root = fakeAppRoot(ownerDocument);
    Object.setPrototypeOf(root, globalThis.HTMLElement.prototype);
    const app = mountApp(root, { chapters, edges, nodes, routes });
    try {
      return await run({ root, app, ownerDocument });
    } finally {
      app.destroy();
    }
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalHTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = originalHTMLElement;
  }
}

test('live study shell, chapter, and assessment headings are Chinese', async () => {
  const { renderChapter, renderAssessment } = await import('../dist/assets/assessment.js');
  await withMountedStudyApp(({ root }) => {
    assert.match(root.markup, /物理知识地图/);
    assert.match(root.markup, /学习目录/);
    assert.doesNotMatch(root.markup, /从一个知识点，走进整章物理/);
    assert.match(root.markup, /导出学习进度/);
    assert.match(root.markup, /导入学习进度/);
    assert.doesNotMatch(root.markup, /PHYSICS · LOWER VOLUME|导出 JSON|导入 JSON/);
  });
  const chapterMarkup = renderChapter(chapters[0], nodes.filter(({ chapterId }) => chapterId === chapters[0].id));
  const assessmentMarkup = renderAssessment(assessment);
  assert.match(chapterMarkup, /第 09 章/);
  assert.match(assessmentMarkup, /教材导读/);
  assert.doesNotMatch(chapterMarkup + assessmentMarkup, /CHAPTER|TEXTBOOK ORIENTATION/);
});

test('progress export reports a Chinese success message after starting the download', async () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:progress';
  URL.revokeObjectURL = () => {};
  try {
    await withMountedStudyApp(({ root }) => {
      const action = new FakeControl(root, { tagName: 'button', attributes: { 'data-action': 'export-progress' } });
      root.emit('click', { target: action });
      assert.equal(root.querySelector('#progress-message').textContent, '学习进度已导出。');
    });
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test('invalid progress files show a Chinese message in the live app', async () => {
  await withMountedStudyApp(async ({ root }) => {
    const input = root.querySelector('#progress-import');
    input.files = [{ text: async () => '{broken' }];
    input.dispatch('change');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(root.querySelector('#progress-message').textContent, '未导入：进度文件格式无效，无法读取。');
  });
});

test('mountApp initializes the data-driven study view without a storage ReferenceError', async () => {
  await withMountedStudyApp(({ root }) => {
    assert.match(root.graphRoot.innerHTML, /data-node-id="c9-shm"/);
    assert.ok(root.querySelector('#detail-content').children[0].textContent.includes(nodes.find(({ id }) => id === 'c9-shm').title));
  });
});

test('mountStudyApp synchronizes system motion changes without overriding user pause and removes the listener on destroy', async () => {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const previousObserver = globalThis.MutationObserver;
  const pendingFrames = new Map();
  let nextFrameId = 1;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    pendingFrames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => pendingFrames.delete(id);
  globalThis.MutationObserver = FakeMutationObserver;

  const listeners = new Set();
  const media = {
    matches: true,
    addEventListener(type, listener) { if (type === 'change') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'change') listeners.delete(listener); },
    change(matches) {
      this.matches = matches;
      for (const listener of [...listeners]) listener({ matches });
    },
  };
  let mountedRoot;
  try {
    await withMountedStudyApp(({ root, app }) => {
      mountedRoot = root;
      assert.equal(root.classList.contains('reduced-motion'), true, 'initial system reduce preference should pause the app');
      app.selectNode('c10-wave-function');
      const detail = root.querySelector('#detail-content').children[0];
      const simulationMount = detail.children.find((child) => child.className === 'simulation-mount');
      assert.ok(simulationMount, 'wave node should expose the real app simulation mount');
      Object.setPrototypeOf(simulationMount, FakeAppWaveContainer.prototype);
      FakeAppWaveContainer.prototype.initialize.call(simulationMount, root);
      const launchAction = {
        dataset: { action: 'open-simulation' },
        getAttribute: (name) => name === 'data-node-id' ? 'c10-wave-function' : null,
        textContent: '打开演示',
      };
      root.emit('click', { target: { closest: (selector) => selector === '[data-action]' ? launchAction : null } });
      assert.equal(pendingFrames.size, 0, 'system reduced motion should prevent wave RAF scheduling');

      media.change(false);
      assert.equal(root.classList.contains('reduced-motion'), false, 'system no-preference should clear the app-level reduced-motion class');
      assert.equal(pendingFrames.size, 1, 'clearing the system preference should resume the mounted wave animation');

      const motionButton = root.querySelector('.motion-button');
      motionButton.dispatch('click');
      assert.equal(root.classList.contains('reduced-motion'), true);
      assert.equal(pendingFrames.size, 0, 'manual pause should stop the wave animation');
      media.change(true);
      media.change(false);
      assert.equal(root.classList.contains('reduced-motion'), true, 'system changes must not clear the independent user pause');
      assert.equal(pendingFrames.size, 0, 'system changes must not resume a manually paused wave');

      motionButton.dispatch('click');
      assert.equal(root.classList.contains('reduced-motion'), false);
      assert.equal(pendingFrames.size, 1, 'user resume should restore motion when system allows it');
    }, { matchMedia: () => media });

    assert.equal(pendingFrames.size, 0, 'destroy should clean up the mounted wave RAF');
    assert.equal(listeners.size, 0, 'destroy should remove the app and simulation media listeners');
    media.change(true);
    assert.equal(mountedRoot.classList.contains('reduced-motion'), false, 'a destroyed app should not respond to later media events');
  } finally {
    if (previousRequest === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousRequest;
    if (previousCancel === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = previousCancel;
    if (previousObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousObserver;
  }
});

test('starting a search clears conflicting graph facets and reveals matches from other chapters', async () => {
  await withMountedStudyApp(({ root }) => {
    root.navButtons[1].dispatch('click');
    for (const [name, value] of [['chapterId', 'ch-10'], ['type', 'concept'], ['level', 'extension'], ['status', 'mastered']]) {
      const control = root.graphRoot.querySelector(`select[data-filter="${name}"]`);
      control.value = value;
      root.graphRoot.emit('change', { target: control });
    }

    const search = root.querySelector('.search-input');
    search.value = '简谐运动的状态方程';
    search.dispatch('input');

    assert.match(root.graphRoot.innerHTML, /data-node-id="c9-shm"/);
    assert.equal(root.graphRoot.querySelector('select[data-filter="chapterId"]').value, '');
    assert.equal(root.graphRoot.querySelector('select[data-filter="type"]').value, 'all');
    assert.equal(root.graphRoot.querySelector('select[data-filter="level"]').value, 'all');
    assert.equal(root.graphRoot.querySelector('select[data-filter="status"]').value, 'all');
  });
});

test('clear search action resets the query and every facet in the full-graph view', async () => {
  await withMountedStudyApp(({ root }) => {
    root.navButtons[1].dispatch('click');
    const search = root.querySelector('.search-input');
    search.value = 'this query cannot match';
    search.dispatch('input');
    for (const [name, value] of [['chapterId', 'ch-10'], ['type', 'concept'], ['level', 'extension'], ['status', 'mastered']]) {
      const control = root.graphRoot.querySelector(`select[data-filter="${name}"]`);
      control.value = value;
      root.graphRoot.emit('change', { target: control });
    }

    root.emit('click', { target: new FakeControl(root, { attributes: { class: 'clear-search' } }) });

    assert.equal(search.value, '');
    assert.equal(root.graphRoot.querySelector('select[data-filter="chapterId"]').value, '');
    assert.equal(root.graphRoot.querySelector('select[data-filter="type"]').value, 'all');
    assert.equal(root.graphRoot.querySelector('select[data-filter="level"]').value, 'all');
    assert.equal(root.graphRoot.querySelector('select[data-filter="status"]').value, 'all');
    assert.match(root.graphRoot.innerHTML, new RegExp(`当前显示 ${nodes.length} 个知识点`));
  });
});

test('search from the guided route opens full exploration and clearing keeps that context', async () => {
  await withMountedStudyApp(({ root }) => {
    const outsideRoute = nodes.find((node) => !routes[0].nodeIds.includes(node.id));
    const search = root.querySelector('.search-input');
    search.value = outsideRoute.title;
    search.dispatch('input');

    assert.equal(root.querySelector('.view-status span').textContent, '完整图谱');
    assert.match(root.graphRoot.innerHTML, new RegExp(`data-node-id="${outsideRoute.id}"`));
    assert.doesNotMatch(root.graphRoot.innerHTML, /route-only-graph/);

    search.value = '';
    search.dispatch('input');
    assert.equal(root.querySelector('.view-status span').textContent, '完整图谱');
    assert.match(root.graphRoot.innerHTML, new RegExp(`当前显示 ${nodes.length} 个知识点`));
    assert.doesNotMatch(root.graphRoot.innerHTML, /route-only-graph/);
  });
});

test('search matches title, section, summary, formula, and keywords in stable title/ID order', () => {
  const { searchKnowledge } = loaded(studyLoad, 'study');
  const sample = [
    { id: 'z', title: '速度', section: '10-2', summary: '频率决定传播快慢', formula: 'v=λf', keywords: ['传播'] },
    { id: 'b', title: '速度', section: '10-2', summary: '波长与频率相连', formula: 'v=λf', keywords: ['传播'] },
    { id: 'm', title: '加速度', section: '9-1', summary: '牛顿第二定律', formula: 'a=F/m', keywords: ['动力学'] },
  ];

  assert.deepEqual(searchKnowledge(sample, '传播').map(({ id }) => id), ['b', 'z']);
  assert.deepEqual(searchKnowledge(sample, 'λf').map(({ id }) => id), ['b', 'z']);
  assert.deepEqual(searchKnowledge(sample, '9-1').map(({ id }) => id), ['m']);
  assert.deepEqual(searchKnowledge(sample, '牛顿').map(({ id }) => id), ['m']);
  assert.deepEqual(searchKnowledge(sample, '加速度').map(({ id }) => id), ['m']);
  assert.deepEqual(searchKnowledge(sample, '   '), []);
});

test('route advancement moves forward within bounds and stops after the final node', () => {
  const { advanceRoute } = loaded(studyLoad, 'study');
  const route = routes[0];

  assert.equal(advanceRoute(route, null), route.nodeIds[0]);
  assert.equal(advanceRoute(route, route.nodeIds[0]), route.nodeIds[1]);
  assert.equal(advanceRoute(route, route.nodeIds.at(-1)), null);
  assert.equal(advanceRoute(route, 'not-in-this-route'), null);
});

test('node details expose the authored formula, units, conditions, pitfalls, and learning sequence', () => {
  const { renderNodeDetail } = loaded(studyLoad, 'study');
  const node = nodes.find(({ id }) => id === 'c9-shm');
  const nextNode = nodes.find(({ id }) => id === 'c9-phasor');
  const detail = withMiniDocument(() => renderNodeDetail(node, {
    prerequisites: [],
    next: [nextNode],
  }));

  assert.equal(detail.tagName, 'ARTICLE');
  assert.ok(detail.textContent.includes('30 秒理解'));
  assert.match(detail.textContent, new RegExp(node.summary));
  assert.match(detail.textContent, new RegExp(node.formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(detail.textContent.includes(node.variables));
  assert.ok(detail.textContent.includes(node.conditions));
  assert.ok(detail.textContent.includes(node.pitfalls));
  assert.ok(detail.textContent.includes(node.problemApproach));
  assert.ok(detail.textContent.includes('为什么成立'));
  assert.ok(detail.textContent.includes(node.explanation));
  assert.ok(detail.textContent.includes('带数值走一遍'));
  assert.ok(detail.textContent.includes(node.workedExample));
  assert.ok(detail.textContent.includes('先修知识'));
  assert.ok(detail.textContent.includes('下一步'));
  assert.ok(detail.textContent.includes(nextNode.title));
});

test('progress statuses persist in a real in-memory Storage and clear cleanly', () => {
  const { createProgressStore } = loaded(studyLoad, 'study');
  const storage = new MemoryStorage();
  const first = createProgressStore(storage);
  first.setStatus('c9-shm', 'mastered');
  first.setStatus('c10-standing', 'review');

  const afterReload = createProgressStore(storage);
  assert.deepEqual(afterReload.getAll(), { 'c9-shm': 'mastered', 'c10-standing': 'review' });
  assert.equal(storage.getItem('physics-atlas-progress-v1') !== null, true);
  afterReload.clear();
  assert.deepEqual(first.getAll(), {});
});

test('progress export and import round-trip every supported status', () => {
  const { createProgressStore } = loaded(studyLoad, 'study');
  const source = createProgressStore(new MemoryStorage());
  source.setStatus('c9-shm', 'new');
  source.setStatus('c9-phasor', 'review');
  source.setStatus('c10-standing', 'mastered');
  const serialized = source.exportJson();

  const destination = createProgressStore(new MemoryStorage());
  destination.importJson(serialized, ['c9-shm', 'c9-phasor', 'c10-standing']);
  assert.deepEqual(destination.getAll(), source.getAll());
});

test('progress import rejects malformed JSON and unknown IDs without changing storage', () => {
  const { createProgressStore } = loaded(studyLoad, 'study');
  const storage = new MemoryStorage();
  const store = createProgressStore(storage);
  store.setStatus('c9-shm', 'mastered');
  const before = storage.getItem('physics-atlas-progress-v1');
  const payload = JSON.parse(store.exportJson());
  payload.progress['c10-wave-function'] = 'review';
  payload.progress['unknown-node'] = 'new';

  assert.throws(() => store.importJson('{broken', ['c9-shm']), {
    name: 'TypeError',
    message: '进度文件格式无效，无法读取。',
  });
  assert.throws(() => store.importJson(JSON.stringify({ version: 1, progress: [] }), ['c9-shm']), {
    name: 'TypeError',
    message: '进度文件结构不符合要求。',
  });
  assert.throws(() => store.importJson(JSON.stringify(payload), ['c9-shm', 'c10-wave-function']), {
    name: 'TypeError',
    message: '进度文件含有无法识别的知识点，未导入任何内容。',
  });
  assert.equal(storage.getItem('physics-atlas-progress-v1'), before);
  assert.deepEqual(store.getAll(), { 'c9-shm': 'mastered' });
});

test('progress import rejects invalid statuses atomically', () => {
  const { createProgressStore } = loaded(studyLoad, 'study');
  const storage = new MemoryStorage();
  const store = createProgressStore(storage);
  store.setStatus('c9-shm', 'mastered');
  const before = storage.getItem('physics-atlas-progress-v1');
  const payload = JSON.parse(store.exportJson());
  payload.progress['c9-phasor'] = 'done';

  assert.throws(() => store.importJson(JSON.stringify(payload), ['c9-shm', 'c9-phasor']), {
    name: 'TypeError',
    message: '进度文件含有无效的学习状态，未导入任何内容。',
  });
  assert.equal(storage.getItem('physics-atlas-progress-v1'), before);
  assert.deepEqual(store.getAll(), { 'c9-shm': 'mastered' });
});

test('malformed saved progress falls back to empty progress without blocking updates', () => {
  const { createProgressStore } = loaded(studyLoad, 'study');
  const storage = new MemoryStorage();
  storage.setItem('physics-atlas-progress-v1', '{broken');
  const store = createProgressStore(storage);

  assert.deepEqual(store.getAll(), {});
  store.setStatus('c9-shm', 'review');
  assert.deepEqual(store.getAll(), { 'c9-shm': 'review' });
});

test('Enter on a graph node restores focus to its replacement after selection renders', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  const ownerDocument = { activeElement: null };
  const root = fakeGraphRoot(ownerDocument);
  renderGraph({ root, nodes, edges, chapters, filters: {}, selectedId: nodes[0].id, routeIds: routes[0].nodeIds });
  const original = root.graphNodes.find((control) => control.getAttribute('data-node-id') === 'c9-shm');
  original.focus();

  root.emit('keydown', { target: original, key: 'Enter', preventDefault() {} });

  assert.ok(root.graphNodes.includes(ownerDocument.activeElement), 'focus should move to the replacement control, not remain detached');
  assert.equal(ownerDocument.activeElement?.getAttribute('data-node-id'), 'c9-shm');
});

test('keyboard list selection and graph filters preserve their control focus after rerender', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  const ownerDocument = { activeElement: null };
  const root = fakeGraphRoot(ownerDocument);
  renderGraph({ root, nodes, edges, chapters, filters: {}, selectedId: nodes[0].id, routeIds: routes[0].nodeIds });
  const listButton = root.listNodes.find((control) => control.getAttribute('data-node-id') === 'c9-shm');
  listButton.focus();
  root.emit('click', { target: listButton });
  assert.ok(root.listNodes.includes(ownerDocument.activeElement), 'list focus should return to the replacement list button');
  assert.equal(ownerDocument.activeElement?.getAttribute('data-node-id'), 'c9-shm');

  const chapterFilter = root.filters.find((control) => control.getAttribute('data-filter') === 'chapterId');
  chapterFilter.focus();
  chapterFilter.value = 'ch-10';
  root.emit('change', { target: chapterFilter });
  assert.ok(root.filters.includes(ownerDocument.activeElement), 'filter focus should return to the replacement select');
  assert.equal(ownerDocument.activeElement?.getAttribute('data-filter'), 'chapterId');
});

test('expanded chapter list stays open while selecting a node and returns focus to that list item', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  const ownerDocument = { activeElement: null };
  const root = fakeGraphRoot(ownerDocument);
  const graph = renderGraph({ root, nodes, edges, chapters, filters: {}, selectedId: nodes[0].id, routeIds: routes[0].nodeIds });
  root.nodeIndexDetails.open = true;
  const listButton = root.listNodes.find((control) => control.getAttribute('data-node-id') === 'c9-shm');
  listButton.focus();

  root.emit('click', { target: listButton });

  assert.equal(root.nodeIndexDetails.open, true, 'the chapter list should remain expanded after its item is selected');
  assert.ok(root.listNodes.includes(ownerDocument.activeElement), 'focus should remain on the replacement list item');
  assert.equal(ownerDocument.activeElement?.getAttribute('data-node-id'), 'c9-shm');
  graph.destroy();
});

test('chapter 15 frame contains the fifth row of its 20 displayed nodes', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  const root = fakeGraphRoot();
  const chapter15Nodes = nodes.filter((node) => node.chapterId === 'ch-15');
  assert.equal(chapter15Nodes.length, 20);
  renderGraph({ root, nodes, edges, chapters, filters: { chapterId: 'ch-15' }, selectedId: nodes[0].id, routeIds: routes[0].nodeIds });

  const height = Number(root.innerHTML.match(/data-chapter-id="ch-15"[^>]*>\s*<rect class="chapter-frame"[^>]*height="(\d+)"/)?.[1]);
  assert.ok(height >= 440, `chapter 15 frame should extend below its fifth-row labels (received ${height})`);
});

test('graph zoom clamps and chapter filters constrain rendered nodes', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  const root = fakeGraphRoot();
  const graph = renderGraph({ root, nodes, edges, chapters, filters: {}, selectedId: nodes[0].id, routeIds: routes[0].nodeIds });
  const canvas = {};
  const canvasTarget = { closest: (selector) => selector === '.graph-canvas' ? canvas : null };
  root.emit('pointerdown', { target: canvasTarget, pointerId: 1, clientX: 0, clientY: 0 });
  root.emit('pointerdown', { target: canvasTarget, pointerId: 2, clientX: 0, clientY: 100 });
  root.emit('pointermove', { target: canvasTarget, pointerId: 2, clientX: 0, clientY: 200 });
  assert.equal(graph.zoomBy(1), 2, 'two-pointer touch movement should zoom the graph');
  root.emit('pointerup', { pointerId: 1 });
  root.emit('pointerup', { pointerId: 2 });
  const upper = graph.zoomBy(100);
  assert.ok(upper <= 2 && upper > 0, 'zoom should clamp to a finite upper bound');
  assert.equal(graph.zoomBy(100), upper, 'repeated zoom-in at the limit should remain clamped');
  graph.setFilters({ chapterId: 'ch-9' });
  assert.equal((root.innerHTML.match(/class="graph-node[^"]*"[^>]*data-node-index=/g) ?? []).length, nodes.filter(({ chapterId }) => chapterId === 'ch-9').length);
  assert.match(root.innerHTML, /role="group"/);
  graph.setFilters({ chapterId: null, routeOnly: true });
  const routeViewBox = root.innerHTML.match(/<svg class="route-graph route-only-graph" viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(routeViewBox, 'the guided route should use its compact graph layout');
  assert.ok(Number(routeViewBox[1]) < 1760, 'the route viewBox should be narrower than the full graph');
  assert.equal((root.innerHTML.match(/class="graph-node[^"]*"[^>]*data-node-index=/g) ?? []).length, routes[0].nodeIds.length);
  graph.destroy();
});

test('graph pan converts a 40 px pointer move to drawing coordinates at both zoom levels', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  for (const routeOnly of [false, true]) {
    for (const targetZoom of [1, 2]) {
      const root = fakeGraphRoot();
      const graph = renderGraph({ root, nodes, edges, chapters, filters: { routeOnly }, routeIds: routes[0].nodeIds });
      graph.zoomBy(targetZoom);
      const width = Number(root.innerHTML.match(/<svg class="route-graph[^"]*" viewBox="0 0 (\d+)/)?.[1]);
      root.querySelector('.route-graph').getScreenCTM = () => ({ inverse: () => ({ transformPoint: ({ x, y }) => ({ x: x * width / 800, y }) }) });
      const canvas = {};
      const target = { closest: (selector) => selector === '.graph-canvas' ? canvas : null };
      root.emit('pointerdown', { target, pointerId: 1, clientX: 100, clientY: 100 });
      root.emit('pointermove', { target, pointerId: 1, clientX: 140, clientY: 100 });
      const pan = Number(root.querySelector('.graph-world').transform.match(/translate\(([-\d.]+)/)?.[1]);
      assert.ok(Math.abs(pan * 800 / width - 40) <= 0.01, `routeOnly=${routeOnly}, zoom=${targetZoom}, pan=${pan}`);
      graph.destroy();
    }
  }
});

test('graph gives an empty result a clear reset action and can refocus a hidden selection', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  const root = fakeGraphRoot();
  const graph = renderGraph({ root, nodes, edges, chapters, selectedId: nodes[0].id });
  graph.setFilters({ searchIds: [] });
  assert.match(root.innerHTML, /当前筛选没有匹配的知识点/);
  assert.match(root.innerHTML, /data-action="clear-filters"/);
  assert.match(root.innerHTML, /定位当前节点/);
  assert.equal(graph.focusNode(nodes[0].id), true);
  assert.match(root.innerHTML, /class="graph-node is-selected/);
  assert.equal(graph.focusNode('missing-id'), false);
  graph.destroy();
});

test('graph type filter renders Chinese labels while preserving filter keys', () => {
  const { renderGraph } = loaded(graphLoad, 'graph');
  const root = fakeGraphRoot();
  const graphNodes = [...nodes, { ...nodes[0], id: 'unmapped-type-test', type: 'unmapped-type' }];
  const graph = renderGraph({
    root,
    nodes: graphNodes,
    edges,
    chapters,
    filters: { type: 'model' },
    selectedId: nodes[0].id,
    routeIds: routes[0].nodeIds,
  });
  const typeSelect = root.innerHTML.match(/<select data-filter="type"[^>]*>[\s\S]*?<\/select>/)?.[0];
  assert.ok(typeSelect);
  const actual = [...typeSelect.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)]
    .map(([, value, label]) => [value, label]);
  const labels = {
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
  };
  const expected = [...new Set(nodes.map(({ type }) => type))]
    .map((type) => [type, labels[type]]);
  assert.deepEqual(actual.slice(1, 1 + expected.length), expected);
  assert.match(typeSelect, /value="unmapped-type"[^>]*>其他知识类型/);
  assert.equal(root.filters.find((filter) => filter.getAttribute('data-filter') === 'type').value, 'model');
  assert.match(root.innerHTML, new RegExp(`当前显示 ${nodes.filter(({ type }) => type === 'model').length} 个知识点`));
  assert.ok(root.graphNodes.length <= nodes.filter(({ type }) => type === 'model').length);
  graph.destroy();
});
