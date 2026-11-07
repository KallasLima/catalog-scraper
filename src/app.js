import express from 'express';
import { fileURLToPath } from 'node:url';
export function createApp(catalog, { clientOrigin } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (clientOrigin && req.headers.origin === clientOrigin) {
      res.set('Access-Control-Allow-Origin', clientOrigin);
      res.vary('Origin');
    }
    res.set('X-Content-Type-Options', 'nosniff');
    res.set(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
    );
    next();
  });
  app.get('/api/laptops', async (req, res) => {
    if (
      typeof req.query.q !== 'undefined' &&
      (typeof req.query.q !== 'string' || req.query.q.length > 100)
    )
      return res.status(400).json({ error: 'q must be at most 100 characters.' });
    const snapshot = await catalog.get();
    const q = (req.query.q ?? '').trim().toLowerCase();
    const items = snapshot.items.filter((x) =>
      (x.title + ' ' + x.description).toLowerCase().includes(q),
    );
    res.json({ ...snapshot, items, total: items.length });
  });
  app.get('/api/laptops/:id', async (req, res) => {
    const snapshot = await catalog.get();
    const item = snapshot.items.find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Laptop not found.' });
    res.json({ ...snapshot, items: undefined, item });
  });
  app.get('/health', (_, res) => res.json({ status: 'ok', mode: catalog.mode }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((_, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    console.error(error.message);
    res.status(502).json({ error: 'Catalog unavailable. Please try again shortly.' });
  });
  return app;
}
