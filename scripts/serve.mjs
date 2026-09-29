import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

export function createStaticServer({ directory = resolve('dist'), basePath = '/' } = {}) {
  const base = `/${basePath.split('/').filter(Boolean).join('/')}`;
  const prefix = base === '/' ? '/' : `${base}/`;
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (!url.pathname.startsWith(prefix)) {
        response.writeHead(404).end('Not found');
        return;
      }
      const tail = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
      const file = resolve(directory, tail);
      const rel = relative(resolve(directory), file);
      if (rel.startsWith(`..${sep}`) || rel === '..' || rel.startsWith(sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(file);
      const target = info.isDirectory() ? resolve(file, 'index.html') : file;
      const body = await readFile(target);
      response.writeHead(200, {
        'content-type': mime[extname(target)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      }).end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4173);
  const server = createStaticServer({ basePath: process.env.BASE_PATH || '/' });
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Serving dist on http://127.0.0.1:${port}${process.env.BASE_PATH || '/'}\n`);
  });
}
