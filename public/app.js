const status = document.querySelector('#status'),
  results = document.querySelector('#results');
async function load() {
  status.textContent = 'Loading catalog…';
  document.querySelectorAll('button').forEach((x) => (x.disabled = true));
  try {
    const response = await fetch(
      '/api/laptops?q=' + encodeURIComponent(document.querySelector('#query').value),
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    results.replaceChildren();
    for (const item of data.items) {
      const card = document.createElement('article');
      card.className = 'card';
      for (const [tag, text, cls] of [
        ['span', item.id, 'tag'],
        ['h2', item.title, ''],
        [
          'div',
          new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(
            item.price / 100,
          ),
          'price',
        ],
        ['p', item.description, ''],
      ]) {
        const el = document.createElement(tag);
        el.textContent = text;
        el.className = cls;
        card.append(el);
      }
      const a = document.createElement('a');
      a.textContent = 'View JSON →';
      a.href = '/api/laptops/' + encodeURIComponent(item.id);
      card.append(a);
      results.append(card);
    }
    status.textContent = `${data.total} results · ${data.source === 'demo' ? 'Offline demo fixture' : 'Live HTML snapshot'} · ${data.stale ? 'Stale snapshot. Refresh failed.' : 'Fetched ' + new Date(data.fetchedAt).toLocaleString()}`;
    if (!data.items.length) results.textContent = 'No matching laptops. Try a different search.';
  } catch (error) {
    results.replaceChildren();
    status.textContent = error.message || 'Unable to load. Please retry.';
  } finally {
    document.querySelectorAll('button').forEach((x) => (x.disabled = false));
  }
}
document.querySelector('#search').addEventListener('submit', (e) => {
  e.preventDefault();
  load();
});
document.querySelector('#reload').addEventListener('click', load);
load();
