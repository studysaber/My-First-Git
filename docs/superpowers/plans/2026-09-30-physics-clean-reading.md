# Physics Clean Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 修复七项复查问题，并将原仓库网站重做为用户选定的浅色学习手册。

**Architecture:** 保留静态模块、节点 ID 和备份格式；存储层负责新鲜读取、条目级冲突合并和跨标签页串行写入，练习层负责记录语义，应用层负责复习入口和事件同步。界面替换为列表目录与阅读工作区，完整图谱独立显示；科学 SVG 始终由已有模型生成。

**Tech Stack:** 原生 HTML/CSS/JavaScript、站内 KaTeX、Node 24、Playwright Chromium、GitHub Pages。

## Global Constraints

- 默认浅色：暖白页面、白色阅读区、深灰文字、少量墨绿强调。
- 保持原节点 ID、题目 ID、已保存记录和 v1/v2 备份兼容。
- 导入默认真正“合并，保留本机冲突项”：自评和练习遵循同一承诺。
- 手机首先显示当前知识点；可点击区域至少 44×44 px，页面无整体横向滚动。
- 不增加登录、后端、付费托管或外部运行时 CDN。继续使用原 GitHub 仓库和 GitHub Pages。
- 本轮不虚构教材全文、不复制整本教材、不宣称 29 张扩展卡片已完整审校。
- 使用 apply_patch 编辑文件；任务边界内 TDD。不要修改其他任务文件或重置他人工作。任务完成前跑全体单元测试，浏览器仅跑对应任务测试；全体浏览器测试在集成末尾跑。

### Task 1: Safe shared learning storage

**Files:** Modify `dist/assets/learning-storage.js`, `dist/assets/practice.js`; Test `tests/learning-storage.test.js`, `tests/practice.test.js`, Create `tests/shared-learning.test.js`.

**Interfaces:** Preserve existing synchronous stores. Add adapter `refresh()` and `runExclusive(action)`; `runExclusive` uses Web Locks when available and invokes synchronously when unavailable. Add practice `refresh()` to reload latest records without discarding temporary records after persistence failure. Do not change import merge policy in this task (Task 2).

- [ ] Add tests exercising two real adapters and stores over one Storage-compatible map. B submits `c9-shm-concept`; A updates `c9-shm` self-assessment; fresh store must retain the answered record. Distinct questions written by older store instances must both survive.

```js
const a = createLearningStorage(native), b = createLearningStorage(native);
const pa = createPracticeStore(a.storage), pb = createPracticeStore(b.storage);
pb.submit(q1, q1.answer);
createProgressStore(a.storage).setStatus('c9-shm', 'mastered');
assert.equal(createPracticeStore(createLearningStorage(native).storage).getRecord(q1).passed, true);
pa.submit(q2, q2.answer);
assert.equal(createPracticeStore(createLearningStorage(native).storage).getRecord(q1).attempts, 1);
```

- [ ] Run `node --test tests/shared-learning.test.js`; observe actual lost-record failure before implementation.
- [ ] Read latest canonical envelope before mutation; preserve untouched fields. Where the same field changed, apply local entry deltas to latest only if the same entry was not concurrently changed; reject conflicting same-entry updates with a Chinese recovery error. No silent last-writer replacement. Transactions maintain their starting snapshot and validate freshness on commit; failed first write leaves prior persistent state intact.

```js
// Delta reconciliation contract, not raw whole-snapshot last-writer-wins:
// unchanged local entries use latest; locally changed entries may replace
// only entries still equal to the transaction/session baseline.
// runExclusive(action): navigator.locks.request(storageKey, action) where supported.
```

- [ ] Make practice read latest persistent records before get/submit/beginAttempt/export/import, while preserving memory-mode records on read/write failure. Keep malformed data safety and old-site rollback mirror behavior. Tests cover same-entry conflict, damaged fresh canonical, transaction conflict, quota failure and legacy mirror recovery.
- [ ] Run `node --test tests/shared-learning.test.js tests/learning-storage.test.js tests/practice.test.js` and `npm test`; record RED/GREEN evidence, self-review, commit task files.

### Task 2: Honest practice feedback and due-review workflow

**Files:** Modify `dist/assets/practice.js`, `dist/assets/app.js`, `dist/assets/learning-backup.js`; optionally create `dist/assets/review.js` for focused rendering/date helpers; Test `tests/practice.test.js`, `tests/learning-backup.test.js`, Create `tests/browser/review-workflow.spec.js` and `tests/browser/shared-learning.spec.js`. Existing `tests/browser/backup.spec.js` may wait for the visible async save-completion message before inspecting storage; retain its original recovery assertions.

**Interfaces:** Consume adapter `runExclusive(action)`/`refresh()` and practice `refresh()`. Preserve getRecord/submit/beginAttempt and existing backup schema. Practice preview may extend returned properties with `added`, `conflicts`, `imported` counts; adjust tests intentionally when contract grows.

- [ ] Write failing tests for a newer imported wrong-answer record not replacing local correct record in merge mode; preview reports each conflict. Confirm failure with `node --test tests/practice.test.js`.

```js
target.importSnapshot(newerSnapshot, {mode:'merge', knownQuestionIds:[q.id]});
assert.deepEqual(target.getRecord(q), localRecord);
// replace mode still explicitly replaces; unrelated incoming questions are added.
```

- [ ] Add browser tests: retry hides prior feedback until submission; correct then incorrect retry shows historical pass and latest error separately; wrong answer appears in today queue, queue link opens that exact question, later correct answer removes it from due queue. Add two-page tests retaining both questions and self-assessment, and reflecting remote saved state without refresh.

```js
await question.getByRole('button',{name:'再试一次'}).click();
await expect(question.getByRole('status')).toBeEmpty();
await question.getByLabel('两者都最大').check();
await question.getByRole('button',{name:'提交答案'}).click();
await expect(question.locator('.practice-record')).toContainText('本次错误');
await page.getByRole('button',{name:/今日复习/}).click();
await expect(page.locator('.review-queue')).toContainText('简谐运动');
```

- [ ] Run focused Playwright tests before implementation, record expected missing workflow/status failures.
- [ ] Merge only absent practice keys; preview separately reports self/quiz additions/conflicts. Hide old feedback in new attempt; allow deliberate reveal via a labeled help control, recording hint use if exposed (omitting this optional reveal is acceptable; no answer leakage). Do not lose historical passed evidence; latest failed answers display `曾通过 · 本次错误 · 待复习`. Label historical pass totals explicitly.
- [ ] Implement a discoverable `今日复习` button and sorted queue with title, due date, latest result and “开始复习” action. Queue shows only known current question versions. Clicking starts a new attempt, selects its node and practice tab, focuses/scrolls the requested question. Update count after answers/import and on day rollover/returning focus.
- [ ] Wrap all learning mutations (self-rating, quiz submit/retry, clear, import transaction) in adapter runExclusive. Sync stores under the lock; handle errors with visible Chinese recovery/backup notice. Register storage event synchronization, updating counters/current feedback without deleting an in-progress typed answer; remove listeners on destroy. Add proper tab keyboard semantics while touching handlers.
- [ ] Run focused unit/browser tests and `npm test`; self-review, commit task files. Preserve existing tests' learning/navigation meaning; do not loosen a test to conceal a regression.

### Task 3: Scientific plot clarity in the light system

**Files:** Modify `dist/assets/simulations.js`, `dist/assets/graph.js`, `dist/assets/physics-mark.svg`; Test `tests/simulations.test.js`, `tests/browser/simulation-trends.spec.js`, Create `tests/browser/scientific-labels.spec.js`.

**Interfaces:** Preserve all physics-model functions and parameter ranges. SVG colors may use CSS custom property fallbacks. Runtime charts remain semantic vectors, not the generated image's illustration.

- [ ] Add failing browser tests confirming Carnot visible state labels `1` through `4`, actual segment direction marks, distinct line styles and readable process names; ensure marker/labels still update when temperatures change, including equal-temperature degenerate state. Tests compare plotted quantities with independent physical relationships, not source text.

```js
await page.goto('./#view=study&node=c13-cycle-carnot&tab=experiment');
await expect(page.locator('[data-cycle-state]')).toHaveCount(4);
await expect(page.locator('[data-cycle-segment][marker-end]')).toHaveCount(4);
await expect(page.locator('.simulation-plot')).toContainText('等温膨胀');
```

- [ ] Run `npx playwright test tests/browser/scientific-labels.spec.js`; observe missing-label failure.
- [ ] Add state point markers, direction arrows along segments, process labels, intermediate ticks, and an accessible explanation connecting enclosed area to net work. Provide a non-color discriminator. Handle overlapping/degenerate plots gracefully rather than inventing a finite cycle.
- [ ] Move dark-background-only colors in all simulations and graph SVGs to accessible dark green/blue/ochre/purple roles with neutral axes; maintain readable Chinese labels, original units, fixed scales where used, threshold handling and paused state. Match orbital mark to green reading identity.
- [ ] Run `npm test` and focused scientific/trend browser tests; self-review and commit. No unrelated physics-model rewrites.

### Task 4: Replace the old template with the approved reading workspace

**Files:** Modify `dist/assets/app.js`, `dist/assets/styles.css`, `dist/index.html`; `dist/assets/simulations.js` may receive bounded semantic markup changes to align playback, controls and readout with the approved experiment composition without changing physics or parameter ranges. `dist/assets/graph.js` may wrap advanced filters in a semantic disclosure and retain its open state, without changing layout/geometry/selection logic. Optionally Create `dist/assets/reading-navigation.js`; Test `tests/browser/graph.spec.js`, `tests/browser/layout.spec.js`, `tests/browser/visual-audit.spec.js`, Create `tests/browser/reading-design.spec.js`; Update `docs/content-coverage.md`, `README.md`, `PRODUCT.md`.

**Interfaces:** Preserve node/tab/view URL semantics and all prior workflows; consume review button/queue from Task 2. Approved reference is `docs/design-reference/handbook-preview.png`; retain user-pinned design even if the concept-seed tooling suggests unrelated catalog styles. Seed key `7886ee29` is provenance, not permission to replace the chosen direction.

- [ ] Add behavioral layout tests: guided reading has an accessible list-based directory, full node titles, collapsible advanced filters, no visible tall route SVG in reading mode; complete graph remains a functional expanded view. Mobile directory can open/close without obstructing focus or content, 44 px controls, no horizontal overflow.

```js
await page.goto('./#view=study&node=c9-simple-pendulum&tab=experiment');
await expect(page.getByRole('navigation',{name:'学习目录'})).toBeVisible();
await expect(page.locator('.route-only-graph')).not.toBeVisible();
await page.getByRole('button',{name:'完整图谱',exact:true}).click();
await expect(page.locator('.graph-canvas')).toBeVisible();
```

- [ ] Run focused new tests before code; confirm old reading layout fails. Update graph tests that specifically assumed route diagram always visible to test actual full-graph drag/hitboxes instead; preserve physical drag conversion, chapter selection, keyboard and label readability assertions.
- [ ] Build actual approved two-column topology: slim header; approx 240 px quiet sidebar; flexible white content pane; one modest heading; tasks below heading; single airy experiment area and adjacent controls/readout. Guided directory shows route selection and chapter accordion/list links. On full graph, graph uses a wide work area and detail remains accessible. Keep 4 learning tasks and chapter/book metadata without hero copy. Reduce master/save controls' visual weight without hiding their actions.
- [ ] Replace—not merely append overrides to—the old dark CSS with a coherent light token system. Base text 16–18 px/1.7; no decorative gradients/glows; few thin neutral rules; muted secondary text still meets contrast. Preserve formula local scrolling. Focus, selection, caret, hover/error/disabled states use the palette. On small screens use disclosure directory above/outside reading rather than a permanently long secondary region. View navigation/search/review accessible. Progress management is a labeled disclosure, automatically revealed for action errors/share fallback.
- [ ] Preserve every runtime class needed by app, graph, assessment and simulations. Add CSS to smaller existing error/empty states and review queue. Avoid repeating intro, breadcrumb, summary or source lists.
- [ ] Capture approved example and actual understanding/practice/graph/review at 1440/1024/390/320 in one batched round; compare spacing and composition, not only palette. Main thread supplies independent finish review after this task; one correction batch before final confirmation.
- [ ] Run `npm test` and focused layout/graph/navigation/reading browser tests. Update content coverage's stale “later task 9” statement and deployment status; preserve extension/manual textbook-review limitations. Self-review, commit task files, report remaining material mismatches.

### Task 5: Independent review, final verification and original-repository deployment

**Files:** Update `DESIGN.md`, `.impeccable/design.json`, `docs/release-checklist.md`; retain all new regression tests. Release `dist` via existing `.github/workflows/pages.yml`.

**Interfaces:** No additional product features. Use original repository `studysaber/My-First-Git`, GitHub Pages workflow; do not create a new repository/hosting service.

- [ ] Main thread runs full `npm test` and `npm run test:browser` once after integration. Run Impeccable detector once for changed UI targets. Verify desktop/mobile captures and compare approved reference. Dispatch fresh finish reviewer and whole-branch code reviewer, passing actual screenshots/diff and spec. Resolve material review findings in one scoped batch, then scoped re-review.
- [ ] Document built tokens and components from actual code via independent documenter; mark release checklist with real test counts and constraints, not blanket physics correctness claims.
- [ ] Verify git diff/check/status, push branch, open PR, attach created PR, await Actions, merge only verified commits within authorized original-repository deployment scope. Await main Pages deployment success.
- [ ] Use clean browser online to verify light appearance, critical multi-tab preservation, deep links, equation resources and one scientific plot. Verify online app version matches release. On network/deploy failure, preserve work and accurately report pending stage; never announce deployment from a successful local test alone.
- [ ] Final handoff: public URL, implemented improvements, fresh test counts, remaining 29-extension/full-text-review limitations only if relevant.
