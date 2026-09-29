# 物理知识地图：正确性修订与视觉优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复复核中发现的物理、内容和学习流程缺陷，将现有网站改进为易读、可验证、有练习反馈的大学物理自学工具。

**Architecture:** 保留静态 HTML/CSS/ES modules 和原 GitHub Pages 仓库。将物理计算、模拟时钟与绘图分开；用统一学习状态连接正文、图谱、练习及分享定位。沿用现有深蓝/青绿色识别，重排内容优先级，明确桌面和手机的不同布局。

**Tech Stack:** 原生 HTML、CSS、JavaScript、SVG/Canvas 科学绘图；Node 内置测试、Playwright 浏览器回归；数学排版采用仓库内固定版本的 KaTeX 资源；GitHub Actions 发布静态 dist。

## Global Constraints

- 文档状态：待审阅的实施方案。本轮只写文档，不修改应用代码、不提交发布、不更改线上设置。
- 面向大学生自学与公开分享；教材为《物理学（第七版）下册》第 9—16 章。
- 原仓库：studysaber/My-First-Git。不得另建公开仓库替代它；不得覆盖无关文件或改写远程历史。
- 保持纯静态部署；运行时无 CDN、远程字体、账号和新增后端依赖。构建与测试依赖可以安装，但不进入运行时请求链。
- 显示文案为中文；公式符号、国际单位、程序标识保留正确形式。
- 既有节点 ID 保留。拆分节点时保留旧入口，不自动将一个旧“已掌握”扩散为多个新节点已掌握。
- 模型给出假设、单位、坐标范围和时间倍率；仅定性的概念图不显示无意义的播放按钮。
- 所有新说明、示例与练习原创；依据公开来源核验，不复制教材习题与答案。
- 按本方案任务增加有意义的物理、状态和浏览器测试，不以“截图变了”“HTML 字符串变了”代替物理验证。
- 以 2026-09-26 复核为问题基线；执行开始时再确认本地与远程版本、未提交修改和已完成修复，避免覆盖后续工作。

---

## 1. 方案选择与范围

| 方案 | 做法 | 适用性 |
|---|---|---|
| A：局部修补 | 修公式和已知跳转，放大字体，基本不动布局 | 改动最少，但手机阅读和图谱层次仍受现有布局限制 |
| **B：学习工作台优化，推荐** | 保留视觉识别与技术栈，修复物理模型，重新安排正文、实验、图谱和练习 | 同时回应“可靠学习”和“更美观”，可分阶段验收 |
| C：更换技术栈并全面重建 | 重建应用架构、组件体系和视觉品牌 | 迁移与兼容成本较高，当前缺陷并不要求先更换技术栈 |

本方案按 B 编写。以下视觉值和布局是具体建议，不能作为已经获得用户确认或已经上线的描述。

### 三个交付阶段

1. **可信修订版（任务 1—5）：** 内容错误、现有 8 类演示（含静态分类）的模型与表现、路线状态、进度保护、分享定位修正完毕。
2. **视觉与交互版（任务 6—7）：** 统一排版、实验视图、图谱取景、手机阅读和键盘交互。
3. **学习与发布版（任务 8—10）：** 教材覆盖、原创练习与复习、自动验收和原仓库发布。

阶段交付可以独立检视；阶段 1 完成不等于整项修订完成。新增核心练习和覆盖工作不因视觉版完成而自动取消。

### 阶段出口与交付证据

| 阶段 | 必须交付 | 进入下一阶段的条件 |
|---|---|---|
| 1：可信修订 | 修订清单、物理模型说明、数值测试报告、参数变化对照、旧进度恢复记录 | 已知错误有回归用例；无误导性运动、错误完成提示和无提示的数据丢失 |
| 2：视觉交互 | 学习页/实验页/图谱的桌面与手机截图、键盘流程记录、设计规范 | 先验收单摆学习页与实验页，再推广布局；阅读、触控、取景均符合第 5 节 |
| 3：学习发布 | 逐章覆盖表、例题和题库审查记录、发布检查表、线上版本与回退点 | 全部核心内容达到承诺覆盖；CI 和子路径验收通过；未验证事项明确列出 |

三个阶段先在本地验收，不默认每阶段自动发布。遇到无法核验的物理内容，标注“待核对”并停止相应演示，不用装饰动画填补；不能据此声称全书已经核验。优先级依次为：物理错误与数据保护 → 阅读和导航 → 内容、练习与视觉细节。

## 2. 审美方向：清晰的物理学习工作台

采用 Impeccable 的 Operate/Read 原则：界面帮助学生操作与理解，强调层次、可读性和状态一致性。现有源码、标识和实测截图是视觉依据。技能上下文脚本没有识别出视觉实现，不据此将已有网站认定为全新项目。

### 2.1 视觉语言

- **颜色：** 保留深蓝底和青绿色。建议背景 #0B1523、内容面 #122235、正文 #E8EEF6、次级文字 #AAB8C9、主操作 #78DCC8、焦点/提醒 #F1C676。最终以对比度测量为准。
- **语义：** 青绿只突出当前节点、关键操作和实验主曲线；蓝色表达对照曲线；琥珀用于待复习和模型条件提醒。状态同时有文字与形状。
- **字体：** 界面和正文使用系统中文无衬线字体；公式使用本地数学字体。正文 16 px、说明 14 px、主要标题 24—28 px，正文行高约 1.7。关键节点标题保持屏幕尺寸至少 14 px。
- **空间：** 以 4/8 px 为间距基准，主要区域使用 16/24/32 px 间隔；一层主内容容器，内部靠标题、空白与轻分隔组织。
- **形状：** 统一约 10 px 容器圆角、8 px 控件圆角；重要交互触控目标至少 44×44 CSS px。
- **科学图形：** 显式坐标、刻度、单位、零线和图例；可比较的物理量采用同一坐标尺。边缘出界有提示，不静默截成另一数值。
- **动态：** 界面状态切换约 150—200 ms；物理运动独立使用模拟时间，不能用界面缓动替代。尊重减少动态设置，提供暂停与时间步进。

### 2.2 桌面信息结构

建议在 ≥1100 px 下使用两列：左侧约 256 px 为章节/路线导航，右侧为主学习区。选中节点的正文与演示占主要宽度，图谱是可切换的探索视图。768—1099 px 收起固定侧栏，由章节按钮打开目录。

```text
物理知识地图      搜索知识点            我的复习 / 学习进度
┌──────────────┬──────────────────────────────────────┐
│ 第9—16章目录 │ 第9章 · 9-3                   分享此处 │
│ 当前路线     │ 单摆的小角振动                         │
│ 未完成节点   │ 一句话理解 + 本节学习目标               │
│              │ [理解] [实验] [练习] [知识关系]         │
│              │                                      │
│              │ 公式 / 条件 / 图像 / 分步算例           │
│              │ 实验模式：大画布 + 紧邻参数与读数         │
│              │                                      │
│              │ 上一节     自评状态 / 去练习     下一节  │
└──────────────┴──────────────────────────────────────┘
```

“理解/实验/练习/知识关系”是同一节点的视图，不复制节点数据。没有实验的节点不出现空实验标签。教材评估收进教材导读入口，保留原内容。

### 2.3 手机结构

- 顶部一行站点名、章节入口和搜索；下方直接显示节点名称与摘要。
- 路线用可点击的纵向清单；图谱以“查看知识关系”进入，筛选置于可展开区域。
- 实验时画布在前、参数紧随其后，结果与单位可同时辨认；横向空间不足时竖排。
- 下一节操作可以吸底，但必须给正文和软键盘留出空间，不能遮挡题目、反馈或焦点。
- 在 390×844 首屏中看到当前节点标题、摘要和主要学习入口。打开节点后，标题获得程序化焦点并滚入视口。

### 2.4 图谱的辨识度来自关系表达

- 总览先展示 8 个章节群及主要跨章关系；进入某章后显示该章节点。
- 选中节点突出先修、当前节点与下一步，其他关系降低视觉权重。
- 标签跟随屏幕字号，不随远距离缩放到不可读；节点文字和圆点共同可点击。
- 图谱旁有可键盘操作的节点列表；无结果时提供清除筛选，而不是空画布。
- 保留完整图谱模式，但采用按缩放程度展示不同信息的方式，避免默认同时堆叠所有 112 个标签。

## 3. 文件职责与接口约定

以下路径相对当前项目根 `C:/Users/extraordinary/Documents/ChatGPT/New project/.worktrees/physics-knowledge-map`；执行前以原仓库检出的实际根目录替换，不混用两份发布文件。

| 文件 | 职责 |
|---|---|
| dist/assets/data/physics-data.js | 原创节点、关系、跨章路线；保留既有标识 |
| dist/assets/data/validate.js | 引用、目录覆盖、字段完整性验证 |
| dist/assets/physics-models.js（新增） | 纯物理计算，不访问 DOM、不处理像素 |
| dist/assets/simulation-clock.js（新增） | 模拟时间、暂停、恢复、倍率与隐藏页面处理 |
| dist/assets/simulations.js | 控件、坐标投影、绘图和读数；兼容原有导出 |
| dist/assets/study.js | 节点正文、进度仓库、路线状态 |
| dist/assets/navigation.js（新增） | hash 定位、校验、恢复、前进后退 |
| dist/assets/graph.js | 取景、缩放、节点关系、键盘和触屏 |
| dist/assets/app.js | 顶层状态与事件协调，保留现有入口 |
| dist/assets/styles.css | 屏幕布局、排版、控件与主题变量 |
| dist/assets/data/practice-data.js（新增） | 原创概念题、计算/读图题和解释 |
| dist/assets/practice.js（新增） | 判题、反馈、学习证据、复习计划 |
| dist/assets/math.js（新增） | 公式排版及纯文本回退 |
| dist/assets/vendor/katex/（新增） | 固定版本本地数学资源及许可证 |
| docs/content-coverage.md（新增） | 出版社小节—节点—例题—练习—核对依据 |
| tests/physics-models.test.js 等 | 物理与状态单测 |
| tests/browser/*.spec.js（新增） | Playwright 真实浏览器测试 |
| package.json / package-lock.json（新增） | 固定开发工具版本、测试脚本 |
| .github/workflows/pages.yml（新增） | 测试后上传 dist 并部署 |

### 数据边界

```js
// physics-models.js：角度用 rad，长度用 m，时间用 s。
pendulumState({ length, gravity, amplitudeRad, time })
// -> { period, angle, angularVelocity, angularAcceleration, x, y }

// simulation-clock.js：主页面隐藏时暂停，返回时不补隐藏时长。
createSimulationClock({ onFrame })
// -> { play(), pause(), reset(), step(seconds), setSpeed(multiplier), destroy() }

// study.js：纯函数，不改变进度、不跳转 DOM。
getRouteState(route, selectedId, progress)
// -> { inRoute, done, total, complete, nextUnfinishedId }

// navigation.js：所有 ID 必须经过已加载目录校验。
parseLocation(hash, catalog)
// -> { view, nodeId, chapterId, routeId, tab }
serializeLocation(state)
// -> '#view=study&node=c9-simple-pendulum&tab=experiment'

// practice.js：初版用选择题与数值题；不自动评判自由文本。
gradeAnswer(question, answer)
// -> { correct, feedback, expectedUnit }
```

旧 progress v1 的 new/review/mastered 原样读取为自评状态。新增练习证据与复习日期使用独立 v2 命名空间；题目记录携带 questionVersion，修订题目不沿用旧版通过证据。迁移失败保留旧数据并给出提示。

### 状态与兼容规则

- **学习位置：** 顶层状态是当前节点与标签的唯一依据。筛选只影响图谱结果，不暗中替换当前正文；当前节点被排除时，提供可见提示和恢复定位操作。
- **实验生命周期：** 暂停保留相位；调物理参数重置 t=0 并保持暂停/播放意图；调播放倍率不改物理参数。切换节点销毁旧时钟；离开实验标签暂停，返回保留参数与相位但不自动播放。隐藏页面暂停，回到前台保持暂停，由学生显式继续。
- **减少动态：** 首次进入实验不自动播放，保留参数、读数和单步操作；正常模式也只有当前可见实验可以运行。
- **进度导出：** 新格式包含 schemaVersion、exportedAt、自评与练习记录。旧 v1 文件继续可导入；未知新版本拒绝导入且不修改当前数据。陌生节点 ID 单独列出，不静默记成已掌握，也不自动删除原备份。
- **导入提交：** 先解析、校验、预览，再生成完整候选快照；确认后一次写入新版本快照，成功后才切换活动记录。旧 v1 存储保留为迁移备份，不跨多个存储键做可能只成功一半的覆盖。写入失败不改变当前持久记录；若选择仅内存使用，明确提示并提供导出。
- **题目与自评：** 通过证据只针对当前题版；重复提交同一答案不重复增加尝试次数。新一次作答以题目重置/再次练习为边界，保留首次结果与最近结果，不把查看答案算作通过。

## 4. 实施任务

### Task 1：建立可复现基线并修正确定的内容错误

**Files:** 修改 dist/assets/data/physics-data.js、tests/data.test.js；新增 docs/content-coverage.md、package.json、package-lock.json、playwright.config.js、scripts/serve.mjs；更新 README.md。

**Interfaces:** 节点保留 formula、conditions、problemApproach；增加可选 formulaLatex、sourceRefs、reviewedAt，不覆盖现有纯文本。

- [ ] 查看工作树、原仓库最新提交和文件差异；保存基线提交号与部署来源，不覆盖用户改动。当前本地工作树未配置 remote，不能直接视为原仓库的可推送检出。
- [ ] 在任何应用修改前找到或检出原仓库，复用合适且干净的检出目录；若需新的隔离检出，按工作树工具规则建立。以原仓库最新 main 建立 codex/physics-learning-revision 分支，逐文件比对现有应用和复核基线，明确吸收哪些本地文件；不得把无关本地 Git 历史强推过去。记录实际执行根目录、源文件布局及远程 main 提交号。
- [ ] 在该分支内建立 dist 源文件布局，先保持页面行为等价；用文件清单证明原仓库根目录 assets/ 与 index.html 到 dist 的映射。发布配置切换前保留原根目录页面；后续只编辑 dist，禁止维护两份不断分叉的源码。
- [ ] 在本任务建立后续任务共用的测试入口：package.json 的 type=module，npm test 只发现 tests/*.test.js；npm run test:browser 调用 Playwright。安装并锁定 @playwright/test，配置 webServer 启动只服务 dist 的本地服务器，浏览器用例单独放 tests/browser，避免被 Node 测试器误发现。执行一次现有 98 项单测与页面加载检查，记录已知缺陷。
- [ ] 写两处错误的回归案例；迈克耳孙明确 Δℓ=Nλ/2，玻尔当前卡片明确 Z=1 的氢原子，另在扩展说明给类氢通式。
- [ ] 运行 `node --test tests/data.test.js`，确认旧数据不能满足新案例。
- [ ] 修改卡片并写出单位一致的例子：500 nm、100 条条纹对应 25 μm 镜面位移；氢 n=1 能量 −13.6 eV。
- [ ] 检查核心卡片的符号、适用条件和解题步骤；每个实际修订记录来源，不把目录核对标为正文核验。
- [ ] 重跑该文件测试；提交此任务的内容与测试。

```js
const card = nodes.find(n => n.id === 'c11-michelson');
assert.match(card.problemApproach, /乘/);
assert.doesNotMatch(card.problemApproach, /除以波长的一半/);
assert.match(nodes.find(n => n.id === 'c15-bohr').conditions, /Z\s*=\s*1/);
```

文字回归只用于已经定位的内容错误；物理数值和实际画面另由以下任务验证。

### Task 2：统一模拟时钟，修复单摆与波

**Files:** 新增 dist/assets/physics-models.js、dist/assets/simulation-clock.js、tests/physics-models.test.js、tests/simulation-clock.test.js；修改 dist/assets/simulations.js、dist/assets/styles.css、tests/simulations.test.js。

**Interfaces:** 产出第 3 节的 pendulumState、createSimulationClock；waveSample 保留旧导出名称，并统一驻波振幅定义。

- [ ] 为单摆四分之一周期过平衡、一个周期回原位、摆长四倍周期两倍写失败测试。
- [ ] 实现明确标注的小角模型：θ=θ₀cos(√(g/ℓ)t)，x=ℓsinθ，y=ℓcosθ；振幅角 1—10°，不将其称为任意摆角精确解。
- [ ] 固定悬点，统一长度到像素的比例；按状态逐帧更新，删除原 pendulum-sway 样式。
- [ ] 时钟以真实时间戳累计可见页面时间；暂停/恢复不丢相位，单步推进准确，改变物理参数后从 t=0 重置并提示。不得把每帧时间截至 0.1 秒导致低帧率变慢。
- [ ] 波图固定物理横轴范围 x∈[0,6] m、纵轴 y∈[−0.011,0.011] m（刻度显示 mm）。每列波的 A 控制为 1—5 mm，λ 为 0.5—3 m，以保持横波小斜率条件；纵横轴比例不同，图上明确说明。驻波波腹振幅为 2A；周期控制/读数和 u=λ/T 一致。
- [ ] 在同一模拟时刻比较 A、λ 改变后的坐标；驻波节点位置固定，波腹可振动。
- [ ] 运行 `node --test tests/physics-models.test.js tests/simulation-clock.test.js tests/simulations.test.js`；提交。

```js
const input = { length: 1, gravity: 9.8, amplitudeRad: Math.PI / 18 };
const start = pendulumState({ ...input, time: 0 });
const quarter = pendulumState({ ...input, time: start.period / 4 });
assert.ok(Math.abs(quarter.angle) < 1e-10);
assert.ok(Math.abs(pendulumState({ ...input, length: 4, time: 0 }).period / start.period - 2) < 1e-12);
```

### Task 3：修复统计、热学和光学演示

**Files:** 修改 dist/assets/physics-models.js、dist/assets/simulations.js、tests/physics-models.test.js、tests/simulations.test.js；新增 tests/browser/simulation-trends.spec.js。

**Interfaces:** maxwellDensity({speed,temperature,molarMass}) 返回概率密度（s/m）；carnotCycle({hotK,coldK}) 返回 {segments,work,heatIn,heatOut,efficiency}，segments 是包含过程名及 {volume,pressure} 采样点的四段数组，能量单位为 J；doubleSlitIntensity({y,wavelength,slitSeparation,screenDistance}) 返回归一化强度。保留现有数值函数并从 simulations.js 重导出。

- [ ] 麦克斯韦采用固定 x=0—5000 m/s、y=0—0.004 s/m；显示数值刻度和同气体的 300 K 参考曲线。图中标出窗口外尾部概率，不将有限窗口重新归一化。测试积分上限取当前方均根速率的 8 倍、误差容限 1e-4，确认全分布面积近似 1、升温峰值右移且降低、宽度增加。
- [ ] 卡诺明确工作物质为定热容理想气体，使用 n=1 mol、γ=1.4、V₁=1 m³、V₂=2 m³；由 V₃=V₂(Th/Tc)^(1/(γ−1))、V₄=V₁(Th/Tc)^(1/(γ−1)) 构造两等温两绝热路径。图中标注过程方向、W、Qh 与 η。
- [ ] Th=Tc 时退化为同一路径往返，净面积与净功为零；若缩放轴域，刻度同步更新。循环路径动画仅表示过程顺序，注明不表示真实过程耗时。
- [ ] 双缝采用理想等强窄缝：I/Imax=cos²(πdy/(λL))；显示两条真实缝隙及 y∈[−30,30] mm 固定刻度观察屏。不以最大像素间距替代实际间距；不暗示已包含有限缝宽衍射包络。
- [ ] 光电效应先以入射方向、能量分配 hf=Φ+Kmax 和 Kmax—频率曲线保证正确；删除电子固定往返。若提供运动，明确无外加场、最大初动能电子、慢放示意，速度来自 √(2Kmax/me)，不能把最大速率当全部电子的统一速率。
- [ ] 相对论补出同一实验室系定义下的 t 与 τ=t/γ 时钟对照；长度测量强调该参考系中的同时测量。粒子分类保留静态互动，移除播放控件。
- [ ] 为每类演示显示模型与单位；浏览器固定时刻验证图像和读数，运行本任务单测与 simulation-trends；提交。

```js
assert.ok(Math.abs(carnotEfficiency({ hotK: 600, coldK: 300 }) - 0.5) < 1e-12);
assert.equal(carnotCycle({ hotK: 300, coldK: 300 }).work, 0);
const a = fringeSpacing({ wavelength: 600e-9, slitSeparation: 0.1e-3, screenDistance: 2 });
const b = fringeSpacing({ wavelength: 700e-9, slitSeparation: 0.1e-3, screenDistance: 2 });
assert.ok(Math.abs(b / a - 7 / 6) < 1e-12);
```

### Task 4：修复自评状态、路线完成与进度保护

**Files:** 修改 dist/assets/study.js、dist/assets/app.js、tests/study.test.js；新增 tests/browser/progress.spec.js。

**Interfaces:** 实现 getRouteState；createProgressStore 新增 getPersistenceState() -> 'persistent'|'memory'，以及 importJson(serialized, knownIds, {mode:'merge'|'replace'})；返回旧接口所需进度对象。

- [ ] 测试不在路线中的节点没有“下一站”，部分完成不能返回 complete。
- [ ] 将“自评掌握”和“下一节”拆为两个操作；标记状态不改变当前节点或视图。路线未完成时提供“继续未完成节点”。
- [ ] 存储写入失败后提示“仅在本次打开期间保存，请导出备份”，不显示持久保存成功。
- [ ] 默认导入合并；冲突默认保留当前状态，预览新增/冲突数量。只有显式选择替换才整体覆盖，并提供导出当前记录入口。
- [ ] 旧进度读取失败保留原存储值，不先写空对象；所有导入先完整验证，失败不部分写入。
- [ ] 运行 `node --test tests/study.test.js` 和 progress 浏览器回归；提交。

```js
const route = { nodeIds: ['a', 'b', 'c'] };
assert.equal(getRouteState(route, 'outside', {}).nextUnfinishedId, null);
assert.equal(getRouteState(route, 'c', { c: 'mastered' }).complete, false);
assert.equal(getRouteState(route, 'c', { a: 'mastered', b: 'mastered', c: 'mastered' }).complete, true);
```

### Task 5：分享节点、恢复学习位置与导航一致性

**Files:** 新增 dist/assets/navigation.js、tests/navigation.test.js；修改 dist/assets/app.js；新增 tests/browser/navigation.spec.js。

**Interfaces:** parseLocation/serializeLocation 见第 3 节；view 允许 study/graph/chapter/guide，tab 允许 understand/experiment/practice/relations。

- [ ] 使用 hash 路由保持 GitHub Pages 子路径兼容，不引入需要服务端重写的 URL。
- [ ] 优先恢复有效分享 hash，其次恢复本地最近位置，最后默认路线；不存在的节点显示提示并回退，保留用户进度。
- [ ] 选择节点、标签或章节时更新 URL；浏览器前进后退恢复对应状态，避免事件循环反复 push。
- [ ] 分享只包含学习位置，不带姓名、成绩或进度；剪贴板不可用时显示可选中的完整链接。
- [ ] 点击章内节点后保持章内学习上下文，目标正文标题进入视口；图谱切换不会丢失当前节点。
- [ ] 运行 `node --test tests/navigation.test.js` 和 navigation 浏览器回归；提交。

```js
const hash = serializeLocation({ view: 'study', nodeId: 'c9-simple-pendulum', tab: 'experiment' });
assert.equal(parseLocation(hash, { nodes, chapters, routes }).nodeId, 'c9-simple-pendulum');
assert.equal(parseLocation('#node=missing', { nodes, chapters, routes }).nodeId, routes[0].nodeIds[0]);
```

### Task 6：落实学习工作台排版与手机结构

**Files:** 修改 dist/assets/app.js、dist/assets/study.js、dist/assets/assessment.js、dist/assets/styles.css、dist/index.html；新增 dist/assets/math.js、dist/assets/vendor/katex/；新增 tests/browser/layout.spec.js；执行完成后记录 DESIGN.md。

**Interfaces:** math.js 导出 renderFormula(element, {text,latex})；latex 缺省或解析失败时使用 textContent 回退；禁止信任题目内容中的任意 HTML。

- [ ] 执行 UI 编辑前阅读 Impeccable craft-floor。按第 2 节建议建立 tokens、主学习区和章节导航，移除占据首屏的大标题区。
- [ ] 所有现有入口都有去处：路线、图谱、章节、导读、搜索、动态控制、进度导入导出。组件统一按钮、选择框、焦点和消息样式。
- [ ] 正文按“理解—公式与条件—例子—易错点”组织；在实验标签中给科学图像充分宽度，控制项紧邻相关读数。
- [ ] 引入本地 KaTeX 的固定版本与许可证，不拼接不可信 HTML；已有纯文本字段继续服务搜索和回退。
- [ ] 手机首次进入显示当前节点和摘要；章节/筛选按需展开；长公式局部横向滚动，页面整体不横向溢出。
- [ ] 一轮批量检查 1440×1000、1024×768、390×844、320×720；修复后再做一轮确认。仅因新功能故障需要追加功能验证，不反复进行无范围的审美微调。
- [ ] 运行技能机械检查：`D:/CodexData/.codex/skills/impeccable/scripts/impeccable.cmd detect --json dist/assets/app.js dist/assets/styles.css dist/assets/study.js`；修复实际问题并记录剩余项。按技能完成独立视觉复核，交付真实桌面/手机截图及本方案中的验收标准；根据实现结果记录 DESIGN.md 和技能设计数据，不将未实施建议记为已落地。提交本任务。

```js
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('/');
const heading = page.locator('.node-detail h2');
await expect(heading).toBeInViewport();
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```

### Task 7：修复图谱可读性、点击和拖动

**Files:** 修改 dist/assets/graph.js、dist/assets/styles.css、tests/study.test.js；新增 tests/browser/graph.spec.js。

**Interfaces:** renderGraph 保留 selectNode/setFilters/zoomBy/destroy，新增 focusNode(id) 与 fitVisible()，不让筛选改变学习进度。

- [ ] 按第 2 节实现章节级总览和节点级聚焦；章节筛选后自动取景。节点 label 用屏幕稳定字号，拥挤时减少显示层级，不缩小到不可读。
- [ ] 文字与圆点共用明确命中区，保留原生按钮式键盘语义；Enter/Space 选择后焦点不丢失。
- [ ] 通过当前 SVG 的 getScreenCTM().inverse() 将指针坐标转换到绘图坐标；缩放以指针或视口中心为锚点，不混用固定画布尺寸。
- [ ] 小幅点击与拖动设置清晰阈值，拖动不误选节点；双指缩放和单指平移结束时释放捕获。
- [ ] 筛选无结果、选中节点不可见时给出可见说明与“定位当前节点”，不让两边静默矛盾。
- [ ] 在路线图和完整图谱、两种 zoom 下测试 40 px 拖动应约等于 40 px 位移；验证标签点击、键盘、长标题、中文阅读与手机控件尺寸；提交。

```js
await page.locator('.graph-node-title').first().click();
await expect(page.locator('.graph-node.is-selected')).toHaveCount(1);
// 拖动前后取同一节点圆心；屏幕位移与指针位移误差不超过 2 px。
expect(Math.abs((after.x - before.x) - 40)).toBeLessThanOrEqual(2);
```

### Task 8：补齐内容覆盖和例题

**Files:** 修改 dist/assets/data/physics-data.js、dist/assets/data/validate.js、tests/data.test.js、README.md；完善 docs/content-coverage.md。

**Interfaces:** 新增 chapterStudyPaths（按章排序的节点 ID）；既有 routes 继续表示六条跨章概览，不将其宣传为全书完整课程。

- [ ] 按出版社目录逐小节建立覆盖表，标为“已展开/部分展开/目录入口/需核对”，记录依据和核对日期。
- [ ] 首批补足两相互垂直振动合成、劳埃德镜、热力学第零定律、等容过程、等压过程。梳理第 15 章电子自旋与原子结构的目录对应，来源确认后补齐。
- [ ] 拆分薄膜、劈尖、牛顿环和偏振相关过大卡片；保留旧 ID 作为概览入口，增加子节点关联与独立进度。
- [ ] 八章都提供章内学习顺序，包括第 16 章；六条路线时长标为“概览约用时”。
- [ ] 为所有核心节点提供一段可核验的解释/推导和一个带条件、单位、步骤、结果检查的原创例子。定性节点使用定性比较或判断，不硬填计算公式。
- [ ] 将 90—120 的节点硬上限改为目录覆盖、字段和引用校验；保留六条既有跨章路线 ID，但章内路径不受原 6—12 站限制。
- [ ] 运行 data 测试；逐章复核覆盖表并提交，每章作为独立审查批次。

```js
for (const chapter of chapters) {
  const ids = chapterStudyPaths[chapter.id];
  assert.ok(ids.length > 0);
  assert.ok(ids.every(id => nodes.some(n => n.id === id && n.chapterId === chapter.id)));
}
assert.ok(nodes.filter(n => n.level === 'core').every(n => n.workedExample && n.sourceRefs?.length));
```

### Task 9：原创练习、学习证据与复习

**Files:** 新增 dist/assets/data/practice-data.js、dist/assets/practice.js、tests/practice.test.js、tests/browser/practice.spec.js；修改 dist/assets/app.js、dist/assets/study.js、dist/assets/styles.css。

**Interfaces:** practice-data 导出 questions；题目含 id、nodeId、version、kind（concept/numeric/interpretation）、prompt、answer、unit、tolerance、explanation。gradeAnswer 不接受未经解析的表达式执行。

- [ ] 先以 8 章各 1 个核心节点验证完整交互，再扩至每个核心节点至少 2 题：概念题 + 计算或读图题。
- [ ] 数值题明确输入单位、绝对/相对容差；拒绝 NaN、Infinity、空值和错误单位。用原生选择/输入控件，答后解释错误来源并链接回原节点。
- [ ] 自评状态、做题次数和当前题版的通过证据分开显示；旧自评记录不得自动变成测验通过。
- [ ] 实验绑定一条预测问题；学生先选择预期，再操作参数，最后解释观察结果。
- [ ] 复习采用明确可解释的 1/3/7 天间隔：首次独立答对后 1 天，到期复习答对后依次安排 3 天、7 天，此后维持 7 天；答错回到当前日待复习，重新答对从 1 天开始。未到期重复答对不提前升级间隔。按当地日历日期计算到期日，同时保存时间戳与时区；时区变更不删除记录。说明这是初版复习规则，不保证长期记忆效果。
- [ ] 不把题库中的客户端答案视为考试保密能力；产品定位为自学反馈。所有题目及解析进行内容审查，不以题数替代质量。
- [ ] 运行 practice 单测、键盘作答和刷新恢复回归；分章提交，所有核心节点覆盖后完成此任务。

```js
const q = { kind: 'numeric', answer: 25, unit: 'μm', tolerance: { absolute: 0.1, relative: 0 }, explanation: '镜面位移等于条纹数乘以半个波长。' };
assert.equal(gradeAnswer(q, { value: 25.05, unit: 'μm' }).correct, true);
assert.equal(gradeAnswer(q, { value: 25, unit: 'm' }).correct, false);
assert.equal(gradeAnswer(q, { value: '', unit: 'μm' }).correct, false);
```

### Task 10：原仓库自动验收与发布

**Files:** 新增 .github/workflows/pages.yml、docs/release-checklist.md；完善任务 1 已建立的 package.json、package-lock.json、playwright.config.js、scripts/serve.mjs；更新 README.md。

**Interfaces:** `npm test` 运行 Node 测试；`npm run test:browser` 运行 Playwright；静态服务器仅将 dist 暴露为根目录，测试/文档不发布。

- [ ] 复核任务 1 建立的原仓库分支和最新远程 main 差异；有并发变更时先合并或协调并重跑验收，不强推覆盖。确认所有拟发布文件均属于本次修订。
- [ ] 确认源码布局、测试和说明已纳入同一仓库；发布产物明确为 dist。根目录旧发布文件只作切换前保留物，发布稳定后另行安排清理，不混入本轮发布产物。
- [ ] 锁定开发依赖，CI 使用 `npm ci`；安装浏览器后运行单测、浏览器用例，再上传 Pages artifact。
- [ ] 测试分支只做验证，main 才部署；验证失败不进入部署任务，保留旧站。部署前确认 Pages 来源设置支持 Actions，记录切换及回退步骤。
- [ ] 对 GitHub 子路径 /My-First-Git/ 验证资源、公式字体、分享 hash 与刷新；检查无意外第三方运行时请求。
- [ ] 在桌面、手机做最终验收并留存截图。验证目标网络的真实访问；若没有中国大陆网络测点，将其列为未验证，不根据一次成功宣称全国可达。
- [ ] 本地结果完成后交付变更摘要与预览，再按届时已有发布授权提交/合并和部署；若权限缺失，只报告确切阻塞，不要求用户重复已完成的授权步骤。
- [ ] 记录部署 commit、Pages 来源配置和线上检查结果；需要回退时重新部署此前已验证的产物，必要时恢复原发布配置，不重写仓库历史。回退不执行任何浏览器存储清理；旧版程序可能不识别新版练习记录，因此发布前保留兼容导出与恢复说明。

```json
{
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "serve": "node scripts/serve.mjs",
    "test:browser": "playwright test"
  }
}
```

以上是脚本接口；实际 package.json 在执行时使用当时验证过的精确开发依赖版本与 lockfile，不能填浮动版本占位。

## 5. 验收标准

任务依赖：任务 1 先建立测试入口；任务 2 为 3 提供模型/时钟；任务 4 的状态接口供 5、6、9 使用；任务 6 定义的视图结构供 7、9 使用；任务 8 完成节点范围后，任务 9 完成全部核心题目；任务 10 汇总验证并发布。任一任务发现需求与实际源代码冲突，先更新方案及相关测试，不静默更改接口。

| 维度 | 验收条件 |
|---|---|
| 物理 | 周期与帧状态一致；A、λ、温度变化可在固定坐标上比较；卡诺零温差净功为零；双缝和光电子满足所声明模型 |
| 内容 | 已知错误消除；每章覆盖情况透明；核心节点具备条件、单位、例子、练习及来源 |
| 学习状态 | 非路线标记不跳章；1/7 不显示完成；自评与练习证据独立；导入失败不破坏原数据 |
| 导航 | 分享定位可恢复；前进后退可用；移动端点击节点后直接到内容 |
| 阅读 | 正文 16 px；关键标签至少 14 px 屏幕字号；390 px 无页面横向溢出；长公式和标签可访问 |
| 可访问性 | 键盘可完成主要流程；焦点可见；常规文字对比度目标 ≥4.5:1；200% 缩放可用；减少动态与手动步进可用 |
| 维护 | 新旧测试全部通过；真实浏览器覆盖关键流程；CI 测试失败不能发布；记录线上版本 |
| 国内访问 | 保留本地资源；只报告实际完成的网络验证。新增镜像/域名作为另行确定的部署选择 |

视觉验收关注“学生是否能看清内容、找到实验、理解参数变化并继续学习”，不能仅以换色、增加圆角或截图更亮作为完成依据。

### 5.1 独立物理验收基准

数值基准由公式和手算/独立计算获得，不用被测函数自己的输出生成期望值。单测验证模型，浏览器验证这些模型值确实用于画面，两个层面都通过才算修复。

| 对象 | 具体基准与边界 | 画面检查 |
|---|---|---|
| 单摆 | ℓ=1 m、g=9.8 m/s² 时 T≈2.00709 s，容差 1e-5 s；T/4 过平衡，T/2 到另一端；悬点到摆球距离恒为 ℓ | 暂停后读数不变；单步与标注时间一致；摆绳不伸缩，悬点不漂移 |
| 波与驻波 | 固定 t 比较振幅翻倍；λ 翻倍时空间周期翻倍；驻波节点间隔 λ/2、波腹幅值 2A | 改参数不能通过自动重缩放把变化抹掉；离散采样足以分辨最高频率 |
| 麦克斯韦 | 同种气体 300→900 K，最概然速率比 √3、峰高比 1/√3；正速率全域积分约 1 | 固定坐标上同时可见峰位右移、峰高降低；出界概率有说明 |
| 卡诺 | 600/300 K 时 η=0.5；W=Qh−Qc；相邻过程端点连续；等温 pV 不变，绝热 pV^γ 不变；300/300 K 时 W=0 | 面积和循环方向与模型一致；坐标缩放时更新刻度，不能保持任意不变闭环 |
| 双缝 | λ=600/700 nm、d=0.1 mm、L=2 m 时条纹间距分别 12/14 mm | 同一屏幕尺上间距比为 7/6；出界条纹可以裁切，但不裁切间距值 |
| 光电效应 | hf<Φ 无发射；hf=Φ 为理想阈值、Kmax=0；高于阈值时 Kmax=hf−Φ，eV/J 换算正确 | 阈值以下不出现逸出电子；入射光方向指向金属；动能图与频率联动 |
| 相对论 | v=0 时 γ=1；v=0.6c 时 γ=1.25、τ/t=0.8、L/L₀=0.8；v≥c 拒绝输入 | 同一参考系定义清楚；不能把动画播放倍率当作物理时间膨胀 |

默认模型恒等式使用适合数值量级的相对误差 1e-9（零附近另设绝对容差）；积分、离散采样和浏览器像素测试单独声明容差，不能一律精确相等。小角单摆验证的是谐振近似，不要求其同时精确满足任意角非线性方程。真实帧率有抖动，周期精度由可控时钟测试验证，不用脆弱的墙钟截图时间断言替代。

所有参数入口统一校验有限值与物理域：ℓ、g、温度、摩尔质量、λ、d、L 为正；卡诺 Th≥Tc>0；相对论 |v|<c。模型拒绝无效输入，界面在提交前显示中文原因，不默默改成另一物理条件。边界和非法输入均进入测试。

### 5.2 视觉、性能与发布检查矩阵

- **固定验收场景：** 单摆正常/暂停/参数变化，长公式与长标题，完整图谱/筛选空结果，答题正确/错误，进度存储失败/导入冲突。不只截取最漂亮的默认状态。
- **操作闭环：** 找到知识点 → 看公式与条件 → 预测并操作实验 → 完成一道题 → 查看解析 → 下一节 → 刷新/分享恢复。桌面鼠标、纯键盘和手机触摸分别验证。
- **无障碍：** 常规文字对比度 ≥4.5:1，大字与关键非文字控件目标 ≥3:1；弹层具有焦点约束、Escape 关闭和焦点返回；状态通知可由辅助技术读取，不能逐帧播报实验数值。系统减少动态时默认静止。自动化扫描不代替手动键盘验证。
- **性能：** 记录设备、浏览器、视口和 CPU 降速条件；持续运行的模拟最多 1 个，离开节点后无遗留 requestAnimationFrame。拖图只更新变换，不逐指针事件重建全部节点。以声明测试环境中交互响应 ≤200 ms 为目标，超出时记录瓶颈和修复结果，不承诺任意设备相同帧率。
- **资源与安全：** 公式资源本地化并保留许可证；首次字体失败有可读回退；题目和导入内容不经 eval/任意 HTML 执行。测试实际 /My-First-Git/ 前缀，不仅测试站点根路径。无跨站请求不等于 GitHub Pages 在所有大陆网络可达。
- **浏览器范围：** Chromium 桌面与移动视口为强制回归；Firefox/WebKit 和真实手机可用时补测，未执行的组合列为未验证。视口模拟不得写成已经在真实手机上测试。
- **发布否决条件：** 未解决的物理错误、已知进度损坏、关键流程无法键盘完成、资源 404、CI 失败均禁止发布。纯视觉微调可以记录为后续项，但必须满足基本阅读标准。Pages 权限或设置不具备时保留现站，不以新仓库或其他平台静默替代。

验收证据统一放入 docs/verification/<日期>/，包含版本、命令与结果、模型检查、截图、未验证项和线上检查链接；不要提交个人学习进度或其他敏感调试数据。

## 6. 与 16 类复核问题对应

| 复核项 | 对应任务 |
|---|---|
| 1—2 内容错误 | 1、8 |
| 3 物理演示 | 2、3 |
| 4—6 路线与保存 | 4 |
| 7—9 图谱、拖动、手机 | 6、7 |
| 10 学习反馈 | 9 |
| 11 内容覆盖 | 8 |
| 12 公式与算例 | 6、8 |
| 13 分享与恢复 | 5 |
| 14—15 发布与测试 | 各任务的回归测试、10 |
| 16 国内可达性 | 10；无真实测点时保留未验证状态 |

## 7. 实施前后的边界

本方案完成后，下一步先实施任务 1—3，形成可检查的物理修订；再按阶段逐项推进。没有必要先更换框架或购买服务。视觉方案先落在当前学习页与实验页，验证桌面/手机之后扩展到其他视图。

本次不生成或发布新界面，不把本方案当成设计已经验收，也不把 98 项旧测试通过当成修订已经完成。实施中的新增源码、依赖和发布变更均留在后续执行阶段。

## 8. 核对依据与证据边界

- 问题定位依据：本地 docs/reviews/2026-09-26/项目复核报告.md 及同目录截图、复核脚本（该路径相对父工作区，不是本应用根目录）。本次完善方案没有重跑线上全量审计；执行时必须刷新版本基线。
- 教材范围依据：[高等教育出版社书目页](https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=61704ca3938b7cc2960edcb7)。目录对应不等于获得全书正文，也不等于逐页校对完成；无法从公开目录确认的小节保留核对状态。
- 迈克耳孙关系核对：[OpenStax：The Michelson Interferometer](https://openstax.org/books/university-physics-volume-3/pages/3-5-the-michelson-interferometer)。
- 氢与类氢模型核对：[University of Tennessee：The hydrogen atom](https://labs.phys.utk.edu/mbreinig/phys222core/modules/m11/hydrogen_atom.html)。
- 后续逐章内容与练习需补充逐项来源和复核记录；本计划列出的模型约束是验收要求，不代表所有新卡片已经完成内容审查。
