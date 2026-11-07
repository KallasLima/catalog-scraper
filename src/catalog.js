import { load } from 'cheerio';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
export const SOURCE = 'https://webscraper.io/test-sites/e-commerce/allinone/computers/laptops';
const ORIGIN = new URL(SOURCE).origin;
export function parseCatalog(html) {
  const $ = load(html);
  const items = [];
  $('.thumbnail').each((_, card) => {
    const el = $(card),
      link = el.find('a.title');
    const href = link.attr('href') ?? '';
    if (!/^\/test-sites\/e-commerce\/allinone\/product\/[a-zA-Z0-9-]+$/.test(href)) return;
    const rawPrice = el.find('.price').text().replace('$', '').trim();
    const title = (link.attr('title') || link.text()).trim();
    if (!title || !/^\d+(\.\d{1,2})?$/.test(rawPrice)) return;
    const [whole, cents = ''] = rawPrice.split('.');
    const price = Number(whole) * 100 + Number(cents.padEnd(2, '0'));
    if (!Number.isSafeInteger(price) || price < 0) return;
    items.push({
      id: href.split('/').at(-1),
      title,
      price,
      description: el.find('.description').text().trim(),
      reviews: Number.parseInt(el.find('.review-count').text()) || 0,
      url: new URL(href, ORIGIN).href,
    });
  });
  const unique = [...new Map(items.map((x) => [x.id, x])).values()];
  if (!unique.length)
    throw new Error('The catalog page contains no valid products. Its structure may have changed.');
  return unique;
}
export async function fetchHtml(fetcher = fetch) {
  const response = await fetcher(SOURCE, {
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
    headers: { 'User-Agent': 'CatalogPortfolio/1.0 (learning project)', Accept: 'text/html' },
  });
  if (!response.ok) throw new Error(`Catalog provider returned HTTP ${response.status}.`);
  if (!response.headers.get('content-type')?.includes('text/html'))
    throw new Error('Catalog provider did not return HTML.');
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2_000_000) {
      await response.body.cancel().catch(() => {});
      throw new Error('Catalog page exceeded the size limit.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export class Catalog {
  constructor({ mode = 'demo', file, fetcher = fetch, ttl = 300000 } = {}) {
    if (!['demo', 'live'].includes(mode)) throw new Error('CATALOG_MODE must be demo or live.');
    this.mode = mode;
    this.file = file;
    this.fetcher = fetcher;
    this.ttl = ttl;
  }
  async init() {
    if (this.file) {
      try {
        const saved = JSON.parse(await readFile(this.file, 'utf8'));
        if (
          saved.source === this.mode &&
          Array.isArray(saved.items) &&
          saved.items.length &&
          Number.isFinite(Date.parse(saved.fetchedAt))
        )
          this.snapshot = saved;
      } catch (error) {
        if (error.code !== 'ENOENT') console.warn('Ignoring unreadable catalog cache.');
      }
    }
  }
  async get() {
    if (this.snapshot && Date.now() - Date.parse(this.snapshot.fetchedAt) < this.ttl)
      return { ...this.snapshot, stale: false };
    this.pending ??= this.refresh().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  async refresh() {
    try {
      const html =
        this.mode === 'demo'
          ? await readFile(new URL('../fixtures/catalog.html', import.meta.url), 'utf8')
          : await fetchHtml(this.fetcher);
      const next = {
        source: this.mode,
        currency: 'USD',
        fetchedAt: new Date().toISOString(),
        items: parseCatalog(html),
      };
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file + '.tmp', JSON.stringify(next));
        await rename(this.file + '.tmp', this.file);
      }
      this.snapshot = next;
      return { ...next, stale: false };
    } catch (error) {
      if (this.snapshot)
        return {
          ...this.snapshot,
          stale: true,
          warning: 'Refresh failed. Showing the last successful snapshot.',
        };
      throw error;
    }
  }
}
