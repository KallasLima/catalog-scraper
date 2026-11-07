import { Catalog } from './catalog.js';
import { createApp } from './app.js';
const catalog = new Catalog({
  mode: process.env.CATALOG_MODE ?? 'demo',
  file: process.env.CACHE_FILE ?? 'data/catalog.json',
});
await catalog.init();
const port = Number(process.env.PORT ?? 4411);
const server = createApp(catalog, { clientOrigin: process.env.CLIENT_ORIGIN }).listen(
  port,
  '127.0.0.1',
  () => console.log(`Catalog: http://127.0.0.1:${port} (${catalog.mode})`),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit(0)));
