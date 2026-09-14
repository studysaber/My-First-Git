import { edges, nodes as catalogNodes, routes, sourceNotes } from './data/physics-data.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const nodeById = new Map(catalogNodes.map((node) => [node.id, node]));
const routeById = new Map(routes.map((route) => [route.id, route]));

function renderNodeLinks(ids = [], className = 'related-node') {
  return ids.map((id) => {
    const node = nodeById.get(id);
    if (!node) return '';
    return `<button class="${className} chapter-node-link" type="button" data-node-id="${escapeHtml(id)}">${escapeHtml(node.title)}<span>${escapeHtml(node.section ?? '')}</span></button>`;
  }).join('');
}

function renderRouteLinks(ids = []) {
  return ids.map((id) => {
    const route = routeById.get(id);
    if (!route) return '';
    return `<button class="assessment-route-link" type="button" data-route-id="${escapeHtml(id)}">${escapeHtml(route.title)}<span>${route.minutes} 分钟</span></button>`;
  }).join('');
}

export function renderChapter(chapter, chapterNodes = [], progress = {}) {
  const core = chapterNodes.filter((node) => node.level === 'core');
  const extension = chapterNodes.filter((node) => node.level === 'extension');
  const mastered = core.filter((node) => (progress?.[node.id] ?? progress?.get?.(node.id)) === 'mastered').length;
  const mastery = core.length ? Math.round(mastered / core.length * 100) : 0;
  const coreIds = new Set(core.map((node) => node.id));
  const linkedRoutes = routes.filter((route) => route.nodeIds.some((id) => coreIds.has(id)));
  const prerequisiteIds = [...new Set(edges
    .filter((edge) => edge.type === '先修' && coreIds.has(edge.target))
    .map((edge) => edge.source)
    .concat(core.flatMap((node) => node.prerequisites ?? [])))]
    .filter((id) => !chapterNodes.some((node) => node.id === id));
  const prerequisites = prerequisiteIds.map((id) => nodeById.get(id)).filter(Boolean);
  const simulationNodes = chapterNodes.filter((node) => node.simulationId);
  const corePath = linkedRoutes.length
    ? '<p>选择一条已有路线建立本章与相邻主题的联系。</p><div class="chapter-route-list">' + linkedRoutes.map((route) => '<button class="assessment-route-link" type="button" data-route-id="' + escapeHtml(route.id) + '">' + escapeHtml(route.title) + '<span>' + route.minutes + ' 分钟</span></button>').join('') + '</div>'
    : '<p>当前没有跨章路线覆盖本章核心节点。以下按目录与数据顺序列出本章核心路径。</p><div class="chapter-node-list">' + renderNodeLinks(core.map((node) => node.id)) + '</div>';

  return `<article class="study-view chapter-view" aria-labelledby="chapter-view-title">
    <header class="study-view-heading">
      <div><p class="view-eyebrow">第 ${String(chapter.number).padStart(2, '0')} 章</p><h2 id="chapter-view-title">${escapeHtml(chapter.title)}</h2><p>${escapeHtml(chapter.summary)}</p></div>
      <div class="chapter-mastery" role="status" aria-label="本章核心内容掌握进度">${mastery}%<span>核心掌握 · ${mastered}/${core.length}</span></div>
    </header>
    <div class="chapter-sections">
      <section class="chapter-section" aria-labelledby="chapter-goals-title">
        <h3 id="chapter-goals-title">学习目标 · 核心节点</h3>
        <p>按小节浏览核心概念；选择标题可打开对应知识点详情。</p>
        <div class="chapter-node-list">${renderNodeLinks(core.map((node) => node.id)) || '<p>本章暂无核心节点。</p>'}</div>
      </section>
      <section class="chapter-section" aria-labelledby="chapter-route-title">
        <h3 id="chapter-route-title">${linkedRoutes.length ? '核心路径' : '本章核心顺序'}</h3>
        ${corePath || '<p>本章尚无核心节点。</p>'}
      </section>
      <section class="chapter-section" aria-labelledby="chapter-prereq-title">
        <h3 id="chapter-prereq-title">先修概览</h3>
        <p>${prerequisites.length ? '图谱中标出的章外先修概念：' : '核心节点从本章内容起步；可按需要沿图谱查看章内先修关系。'}</p>
        ${prerequisites.length ? `<div class="chapter-node-list">${renderNodeLinks(prerequisites.map((node) => node.id))}</div>` : ''}
      </section>
      <section class="chapter-section" aria-labelledby="chapter-sim-title">
        <h3 id="chapter-sim-title">微型演示</h3>
        <p>打开知识点详情后，可从那里启动对应演示。</p>
        <div class="chapter-node-list">${simulationNodes.length ? renderNodeLinks(simulationNodes.map((node) => node.id), 'related-node simulation-node-link') : '<p>本章没有配置微型演示。</p>'}</div>
      </section>
      <section class="chapter-section extension-section" aria-labelledby="chapter-extension-title">
        <h3 id="chapter-extension-title">扩展分支</h3>
        <p>核心内容之外的扩展节点单独列出，可在核心概念稳定后按兴趣继续。</p>
        <div class="chapter-node-list">${renderNodeLinks(extension.map((node) => node.id)) || '<p>本章暂无扩展节点。</p>'}</div>
      </section>
    </div>
  </article>`;
}

const sectionTitles = {
  'content-structure': '内容结构',
  mathematics: '数学先修',
  'difficulty-distribution': '难点分布',
  'engineering-applications': '工程联系',
  'study-strategy': '学习策略',
};

export function renderAssessment(assessment) {
  const records = Array.isArray(assessment) ? assessment : [];
  const sections = records.map((record) => {
    const title = sectionTitles[record.id] ?? record.title;
    const fit = record.learnerFit ?? {};
    return `<section class="assessment-section" aria-labelledby="assessment-${escapeHtml(record.id)}">
      <h3 id="assessment-${escapeHtml(record.id)}">${escapeHtml(title)}</h3>
      <div class="assessment-observation"><span>从目录与图谱可见</span><p>${escapeHtml(record.textbookView)}</p></div>
      <div class="assessment-advice"><span>可尝试</span><p>${escapeHtml(fit.advice)}</p></div>
      ${fit.nodeIds?.length ? `<div class="assessment-links"><span>相关知识点</span><div class="chapter-node-list">${renderNodeLinks(fit.nodeIds, 'related-node assessment-node-link')}</div></div>` : ''}
      ${fit.routeIds?.length ? `<div class="assessment-links"><span>相关路线</span><div class="chapter-route-list">${renderRouteLinks(fit.routeIds)}</div></div>` : ''}
    </section>`;
  }).join('');

  return `<article class="study-view assessment-view" aria-labelledby="assessment-view-title">
    <header class="study-view-heading assessment-intro">
      <div><p class="view-eyebrow">教材导读</p><h2 id="assessment-view-title">教材评估与自学建议</h2>
        <div class="audience-summary">
          <p><strong>教材适用对象</strong>：本书主要服务高校理工类非物理专业的大学物理教学；文科相关专业的修读者和一般读者也可按需参考。全书以大学物理课程要求中的基础内容为主线，并补充拓展主题，供各专业按需选读。</p>
          <p><strong>本站面向</strong>：希望独立学习本册内容、先快速建立章节总览的大学生自学者。</p>
          <a class="assessment-source-link" href="${escapeHtml(sourceNotes[0].url)}" target="_blank" rel="noreferrer">出版社图书信息与目录 <span aria-hidden="true">↗</span></a>
        </div>
        <p>目录依次覆盖振动、波动与光学，气体动理论与热力学，相对论、量子物理，以及原子核与粒子物理。图谱把核心节点和扩展节点分开，作为学习导航；公开目录未说明星号代表正式教学层级。</p>
        <p>一个可执行的顺序是先走振动—波动—光学路线，再学习气体统计与热力学，随后进入相对论、量子和核物理；遇到数学工具或应用主题时，沿下面的节点与路线链接回看先修。</p>
      </div>
    </header>
    <div class="assessment-sections">${sections}</div>
  </article>`;
}
