import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Catalog, parseCatalog } from '../src/catalog.js';
import { createApp } from '../src/app.js';
test('parser handles decimal prices and rejects off-site/malformed cards', () => {
  const html =
    '<article class="thumbnail"><a class="title" href="/test-sites/e-commerce/allinone/product/1">Tiny</a><b class="price">$12.3</b></article>';
  assert.equal(parseCatalog(html)[0].price, 1230);
  assert.throws(() =>
    parseCatalog(
      html.replace('/test-sites/e-commerce/allinone/product/1', 'https://bad.example/1'),
    ),
  );
  assert.throws(() => parseCatalog(html.replace('$12.3', 'free')));
});
test('real HTTP demo list, search, details, invalid query and 404', async (t) => {
  const catalog = new Catalog();
  const server = createApp(catalog).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const all = await (await fetch(base + '/api/laptops')).json();
  assert.equal(all.items.length, 6);
  assert.equal(all.source, 'demo');
  assert.equal((await (await fetch(base + '/api/laptops?q=atlas')).json()).total, 1);
  assert.equal(
    (await (await fetch(base + '/api/laptops/' + all.items[0].id)).json()).item.title,
    'Atlas 14',
  );
  assert.equal((await fetch(base + '/api/laptops/missing')).status, 404);
  assert.equal((await fetch(base + '/api/laptops?q[a]=x')).status, 200); // literal unknown parameter does not alter q
  assert.equal((await fetch(base + '/api/laptops?q=' + 'a'.repeat(101))).status, 400);
});
test('refresh coalesces calls, persists, and preserves good data on provider failure', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'catalog-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const html = await readFile(new URL('../fixtures/catalog.html', import.meta.url), 'utf8');
  let calls = 0,
    fail = false;
  const fetcher = async () => {
    calls++;
    if (fail) throw new Error('network');
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  };
  const catalog = new Catalog({ mode: 'live', file: join(dir, 'cache.json'), fetcher, ttl: 0 });
  await catalog.init();
  await Promise.all([catalog.get(), catalog.get(), catalog.get()]);
  assert.equal(calls, 1);
  fail = true;
  const stale = await catalog.get();
  assert.equal(stale.stale, true);
  assert.equal(stale.items.length, 6);
  const reloaded = new Catalog({ mode: 'live', file: join(dir, 'cache.json'), fetcher });
  await reloaded.init();
  assert.equal((await reloaded.get()).items.length, 6);
  const empty = new Catalog({ mode: 'live', fetcher });
  await assert.rejects(empty.get());
});
