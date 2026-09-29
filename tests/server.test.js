import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStaticServer } from '../scripts/serve.mjs';

test('the Pages project path serves the app and local modules', async (context) => {
  const server = createStaticServer({ basePath: '/My-First-Git/' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(`${base}/My-First-Git/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /物理知识地图/);

  const module = await fetch(`${base}/My-First-Git/assets/app.js`);
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /text\/javascript/);
  assert.match(await module.text(), /mountApp/);

  const unrelated = await fetch(`${base}/assets/app.js`);
  assert.equal(unrelated.status, 404);
});
