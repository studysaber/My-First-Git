const VIEWS = new Set(['study', 'graph', 'chapter', 'guide']);
const TABS = new Set(['understand', 'experiment', 'practice', 'relations']);

export function serializeLocation({ view = 'study', nodeId, chapterId, routeId, tab } = {}) {
  const params = new URLSearchParams();
  params.set('view', VIEWS.has(view) ? view : 'study');
  if (nodeId) params.set('node', String(nodeId));
  if (chapterId) params.set('chapter', String(chapterId));
  if (routeId) params.set('route', String(routeId));
  if (tab && TABS.has(tab) && (view === 'study' || view === 'graph' || !VIEWS.has(view))) params.set('tab', tab);
  return `#${params.toString()}`;
}

export function parseLocation(hash, catalog) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const nodes = Array.isArray(catalog?.nodes) ? catalog.nodes : [];
  const chapters = Array.isArray(catalog?.chapters) ? catalog.chapters : [];
  const routes = Array.isArray(catalog?.routes) ? catalog.routes : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const requestedRoute = routeById.get(params.get('route'));
  const requestedChapter = chapterById.get(params.get('chapter'));
  const requestedNode = nodeById.get(params.get('node'));
  const node = requestedNode
    ?? nodes.find((item) => item.chapterId === requestedChapter?.id)
    ?? nodeById.get(requestedRoute?.nodeIds?.[0])
    ?? nodeById.get(routes[0]?.nodeIds?.[0])
    ?? nodes[0];
  const route = requestedRoute?.nodeIds?.includes(node?.id)
    ? requestedRoute
    : routes.find((item) => item.nodeIds?.includes(node?.id)) ?? routes[0];
  const view = VIEWS.has(params.get('view')) ? params.get('view') : 'study';
  const tab = (view === 'study' || view === 'graph') && TABS.has(params.get('tab')) ? params.get('tab') : 'understand';
  return {
    view,
    nodeId: node?.id ?? null,
    chapterId: (view === 'chapter' ? requestedChapter?.id : null) ?? node?.chapterId ?? chapters[0]?.id ?? null,
    routeId: route?.id ?? null,
    tab,
  };
}
