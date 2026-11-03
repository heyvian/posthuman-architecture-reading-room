const cards = document.querySelector('#cards');
const search = document.querySelector('#search');
const filterBox = document.querySelector('#filters');
const drawer = document.querySelector('#drawer');
const scrim = document.querySelector('#scrim');
const drawerContent = document.querySelector('#drawer-content');
const allThemes = [...new Set(window.readings.map((item) => item.theme))];
let activeTheme = 'All ideas';

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function renderFilters() {
  filterBox.innerHTML = ['All ideas', ...allThemes].map((theme) => `<button class="filter-chip ${activeTheme === theme ? 'selected' : ''}" data-theme="${escapeHTML(theme)}" aria-pressed="${activeTheme === theme}">${escapeHTML(theme)}</button>`).join('');
  filterBox.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    activeTheme = button.dataset.theme;
    renderFilters();
    renderCards();
  }));
}

function visibleReadings() {
  const query = search.value.trim().toLowerCase();
  return window.readings.filter((item) => {
    const matchesTheme = activeTheme === 'All ideas' || item.theme === activeTheme;
    const sourceText = item.sources.map((source) => `${source.label} ${source.note}`).join(' ');
    const haystack = [item.title, item.subtitle, item.type, item.theme, item.summary, item.why, item.quote, item.quoteType, item.quoteCredit || '', item.citation, sourceText, item.tags.join(' ')].join(' ').toLowerCase();
    return matchesTheme && (!query || haystack.includes(query));
  });
}

function renderCards() {
  const results = visibleReadings();
  document.querySelector('#result-count').textContent = String(results.length).padStart(2, '0');
  document.querySelector('#empty').hidden = results.length > 0;
  cards.innerHTML = results.map((item, index) => `
    <button class="reading-card ${escapeHTML(item.color)}" data-id="${escapeHTML(item.id)}" aria-label="Open ${escapeHTML(item.title)}">
      <span class="card-meta"><span>${escapeHTML(item.type)}</span><span>${String(index + 1).padStart(2, '0')} / ${escapeHTML(item.year)}</span></span>
      <span class="card-art" aria-hidden="true"><span class="art-symbol">${escapeHTML(item.symbol)}</span><span class="art-caption">${escapeHTML(item.theme.toUpperCase())}<br />STUDIES IN RELATION</span></span>
      <span class="card-copy"><span class="card-theme">${escapeHTML(item.theme)}</span><span class="card-title">${escapeHTML(item.title)}</span><span class="card-subtitle">${escapeHTML(item.subtitle)}</span><span class="card-quote"><span class="quote-kind">${escapeHTML(item.quoteType || 'Reading prompt')}</span><span class="quote-text">${escapeHTML(item.quote)}</span>${item.quoteCredit ? `<span class="quote-credit">— ${escapeHTML(item.quoteCredit)}</span>` : ''}</span><span class="card-tags">${item.tags.slice(0, 3).map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</span></span>
      <span class="card-open" aria-hidden="true">↗</span>
    </button>`).join('');
  cards.querySelectorAll('.reading-card').forEach((card) => card.addEventListener('click', () => openReading(card.dataset.id)));
}

function openReading(id) {
  const item = window.readings.find((reading) => reading.id === id);
  if (!item) return;
  drawerContent.innerHTML = `
    <p class="eyebrow drawer-kicker">${escapeHTML(item.type)} &nbsp;·&nbsp; ${escapeHTML(item.year)}</p>
    <div class="drawer-art ${escapeHTML(item.color)}"><span>${escapeHTML(item.symbol)}</span><small>${escapeHTML(item.theme.toUpperCase())} / FIELD NOTE</small></div>
    <p class="card-theme">${escapeHTML(item.theme)}</p>
    <h2>${escapeHTML(item.title)}</h2><p class="drawer-subtitle">${escapeHTML(item.subtitle)}</p>
    <blockquote><span class="quote-kind">${escapeHTML(item.quoteType || 'Reading prompt')}</span><span class="quote-text">${escapeHTML(item.quote)}</span>${item.quoteCredit ? `<cite class="quote-credit">— ${escapeHTML(item.quoteCredit)}</cite>` : ''}</blockquote>
    <section class="detail-section"><h3>In brief</h3><p>${escapeHTML(item.summary)}</p></section>
    <section class="detail-section"><h3>Why it matters</h3><p>${escapeHTML(item.why)}</p></section>
    <section class="detail-section"><h3>Explore through</h3><div class="detail-tags">${item.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</div></section>
    <section class="detail-section"><h3>References & further reading</h3>${item.sources.length ? `<ul class="source-list">${item.sources.map((source) => `<li><a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label)} <span aria-hidden="true">↗</span></a><p>${escapeHTML(source.note)}</p></li>`).join('')}</ul>` : '<p>No external link is attached to this card. Use the full citation above to locate a copy.</p>'}</section>
    <section class="detail-section citation"><h3>Citation</h3><p>${escapeHTML(item.citation)}</p></section>`;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  scrim.classList.add('visible');
  document.body.classList.add('drawer-open');
  document.querySelector('#close-drawer').focus();
}

function closeReading() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  scrim.classList.remove('visible');
  document.body.classList.remove('drawer-open');
}

search.addEventListener('input', renderCards);
document.querySelector('#close-drawer').addEventListener('click', closeReading);
scrim.addEventListener('click', closeReading);
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); }
  if (event.key === 'Escape') closeReading();
});

renderFilters();
renderCards();
document.querySelector('#reading-total').textContent = String(window.readings.length).padStart(2, '0');
