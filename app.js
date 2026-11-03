const cards = document.querySelector('#cards');
const search = document.querySelector('#search');
const filterBox = document.querySelector('#filters');
const drawer = document.querySelector('#drawer');
const scrim = document.querySelector('#scrim');
const drawerContent = document.querySelector('#drawer-content');
const pickedView = document.querySelector('#picked-view');
const pickedMain = document.querySelector('#picked-main');
const relatedCards = document.querySelector('#related-cards');
const library = document.querySelector('#library');
const allThemes = [...new Set(window.readings.map((item) => item.theme))];
let activeTheme = 'All ideas';
let returnFocusId = null;
const pilePositions = [
  [23, 28, -14], [41, 25, 11], [61, 29, -5], [79, 25, 17], [84, 44, -11],
  [68, 48, 9], [49, 42, -17], [30, 49, 6], [16, 45, -8], [25, 70, 12],
  [46, 65, -7], [64, 70, 15], [82, 65, -6], [76, 75, 9], [56, 74, -14],
  [37, 74, 5], [18, 73, -12], [34, 30, 7], [56, 26, -10], [72, 42, 13],
  [43, 55, -5], [60, 54, 8], [28, 60, -11]
];
const pileScales = [0.94, 1.03, 0.98, 1.08, 0.92];

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
  cards.classList.toggle('sparse-pile', results.length === 1);
  document.querySelector('#result-count').textContent = String(results.length).padStart(2, '0');
  document.querySelector('#empty').hidden = results.length > 0;
  cards.innerHTML = results.map((item, index) => renderCard(item, index)).join('');
  cards.querySelectorAll('.reading-card').forEach((card) => card.addEventListener('click', () => openReading(card.dataset.id)));
}

function renderCard(item, index, mode = 'pile') {
  const pile = mode === 'pile' ? pilePositions[index % pilePositions.length] : null;
  const pileStyle = pile
    ? `style="--pile-x:${pile[0]}%;--pile-y:${pile[1]}%;--pile-angle:${pile[2]}deg;--pile-scale:${pileScales[index % pileScales.length]};--pile-depth:${index}"`
    : '';
  return `
    <button class="reading-card ${escapeHTML(item.color)} ${mode === 'picked' ? 'picked-card' : ''}" ${pileStyle} data-id="${escapeHTML(item.id)}" aria-label="Pick up ${escapeHTML(item.title)}">
      <span class="card-meta"><span>${escapeHTML(item.type)}</span><span>${String(index + 1).padStart(2, '0')} / ${escapeHTML(item.year)}</span></span>
      <span class="card-art" aria-hidden="true"><span class="art-symbol">${escapeHTML(item.symbol)}</span><span class="art-caption">${escapeHTML(item.theme.toUpperCase())}<br />STUDIES IN RELATION</span></span>
      <span class="card-copy"><span class="card-theme">${escapeHTML(item.theme)}</span><span class="card-title">${escapeHTML(item.title)}</span><span class="card-subtitle">${escapeHTML(item.subtitle)}</span><span class="card-quote"><span class="quote-kind">${escapeHTML(item.quoteType || 'Reading prompt')}</span><span class="quote-text">${escapeHTML(item.quote)}</span>${item.quoteCredit ? `<span class="quote-credit">— ${escapeHTML(item.quoteCredit)}</span>` : ''}</span><span class="card-tags">${item.tags.slice(0, 3).map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</span></span>
      <span class="card-open" aria-hidden="true">↗</span>
    </button>`;
}

function relatedReadings(selected) {
  const stopWords = new Set(['about', 'after', 'against', 'among', 'architecture', 'architectural', 'being', 'between', 'could', 'design', 'from', 'into', 'more', 'other', 'their', 'there', 'these', 'those', 'through', 'what', 'when', 'where', 'which', 'while', 'with', 'would']);
  const terms = (item) => new Set(
    [item.title, item.subtitle, item.summary, ...item.tags]
      .join(' ')
      .toLowerCase()
      .match(/[a-z0-9]{4,}/g)
      .filter((term) => !stopWords.has(term))
  );
  const selectedTerms = terms(selected);
  const selectedTags = new Set(selected.tags.map((tag) => tag.toLowerCase()));
  const ranked = window.readings
    .filter((item) => item.id !== selected.id && item.theme !== selected.theme)
    .map((item, index) => {
      const itemTerms = terms(item);
      const sharedTerms = [...selectedTerms].filter((term) => itemTerms.has(term)).length;
      const sharedTags = item.tags.filter((tag) => selectedTags.has(tag.toLowerCase())).length;
      const score = sharedTags * 4 + sharedTerms / Math.sqrt(selectedTerms.size * itemTerms.size);
      return { item, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const distinctCategories = [];
  const usedThemes = new Set();

  for (const candidate of ranked) {
    if (!usedThemes.has(candidate.item.theme)) {
      distinctCategories.push(candidate.item);
      usedThemes.add(candidate.item.theme);
    }
    if (distinctCategories.length === 3) break;
  }

  return distinctCategories;
}

function openReading(id) {
  const item = window.readings.find((reading) => reading.id === id);
  if (!item) return;
  if (!drawer.classList.contains('open')) returnFocusId = id;
  const cardIndex = window.readings.findIndex((reading) => reading.id === item.id);
  pickedMain.innerHTML = renderCard(item, cardIndex, 'picked');
  pickedMain.querySelector('.reading-card').addEventListener('click', () => openReading(item.id));
  relatedCards.innerHTML = relatedReadings(item).map((related, index) => `
    <button class="related-card ${escapeHTML(related.color)}" data-id="${escapeHTML(related.id)}" aria-label="Pick up related reading: ${escapeHTML(related.title)}">
      <span class="related-art">${escapeHTML(related.symbol)}</span>
      <span class="related-copy"><span class="card-theme">${escapeHTML(related.theme)}</span><strong>${escapeHTML(related.title)}</strong><small>${escapeHTML(related.type)}</small></span>
    </button>`).join('');
  relatedCards.querySelectorAll('.related-card').forEach((card) => card.addEventListener('click', () => openReading(card.dataset.id)));
  pickedView.hidden = false;
  library.classList.add('has-selection');
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
  document.body.classList.add('drawer-open', 'reading-selected');
  document.querySelector('#close-drawer').focus();
}

function closeReading() {
  const wasOpen = drawer.classList.contains('open');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  scrim.classList.remove('visible');
  pickedView.hidden = true;
  library.classList.remove('has-selection');
  document.body.classList.remove('drawer-open', 'reading-selected');
  if (wasOpen) {
    const returnTarget = [...cards.querySelectorAll('.reading-card')].find((card) => card.dataset.id === returnFocusId);
    (returnTarget || search).focus();
    returnFocusId = null;
  }
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
