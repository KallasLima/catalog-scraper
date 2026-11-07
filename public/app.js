const status = document.querySelector('#status'),
  results = document.querySelector('#results');
const text = (tag, value, cls) => {
  const element = document.createElement(tag);
  element.textContent = value;
  if (cls) element.className = cls;
  return element;
};
async function load() {
  status.textContent = 'Loading catalog…';
  document.querySelectorAll('button').forEach((x) => (x.disabled = true));
  const query = document.querySelector('#query').value;
  const endpoint = '/api/laptops' + (query ? '?q=' + encodeURIComponent(query) : '');
  document.querySelector('#request-path').textContent = endpoint;
  document.querySelector('#open-json').href = endpoint;
  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Catalog unavailable.');
    results.replaceChildren();
    document.querySelector('#source').textContent =
      data.source === 'demo' ? 'Offline demo fixture' : 'Live HTML snapshot';
    document.querySelector('#fetched').textContent = new Date(data.fetchedAt).toLocaleString();
    document.querySelector('#count').textContent = data.total;
    const table = document.createElement('table');
    const caption = text('caption', 'Scraped laptop records, prices in USD', 'sr-only');
    table.append(caption);
    const head = document.createElement('thead'),
      header = document.createElement('tr');
    for (const label of ['ID', 'TITLE', 'DESCRIPTION', 'PRICE', 'JSON']) {
      const th = text('th', label);
      th.scope = 'col';
      header.append(th);
    }
    head.append(header);
    table.append(head);
    const body = document.createElement('tbody');
    for (const item of data.items) {
      const row = document.createElement('tr');
      for (const value of [
        item.id,
        item.title,
        item.description,
        new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(
          item.price / 100,
        ),
      ])
        row.append(text('td', value));
      const cell = document.createElement('td'),
        link = text('a', 'View JSON →');
      link.href = '/api/laptops/' + encodeURIComponent(item.id);
      link.setAttribute('aria-label', 'View JSON for ' + item.title);
      cell.append(link);
      row.append(cell);
      body.append(row);
    }
    table.append(body);
    if (data.items.length) results.append(table);
    else results.append(text('p', 'No matching laptops. Try a different search.'));
    status.textContent = `${data.total} results · ${data.stale ? 'Stale snapshot. Refresh failed.' : 'Snapshot ready'}`;
  } catch (error) {
    results.replaceChildren();
    for (const id of ['source', 'fetched', 'count'])
      document.querySelector('#' + id).textContent = '—';
    status.textContent = error.message || 'Unable to load. Please retry.';
    results.append(text('p', 'Reload to try the request again.'));
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
