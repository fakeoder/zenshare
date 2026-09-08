(function () {
  const site = window.ZenshareSite;
  site.init();

  const PAGE_SIZE = 20;
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => site.t(key, vars);

  const form = $('browseForm');
  const searchInput = $('searchInput');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  const meta = $('browseMeta');
  const list = $('browseList');
  const empty = $('browseEmpty');
  const errorEl = $('browseError');
  const pager = $('browsePager');
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const pageInfo = $('pageInfo');

  const state = {
    q: '',
    permanent: false,
    page: 1,
    total: 0,
    totalPages: 1,
  };
  let searchTimer = null;
  let requestId = 0;

  function locale() {
    return site.getLang() === 'zh' ? 'zh-CN' : 'en-US';
  }

  function formatDate(ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleString(locale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.permanent) params.set('permanent', '1');
    if (state.page > 1) params.set('page', String(state.page));
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  }

  function readInitialState() {
    const params = new URLSearchParams(location.search);
    state.q = (params.get('q') || '').trim();
    state.permanent = params.get('permanent') === '1';
    state.page = Math.max(1, Number(params.get('page')) || 1);
    searchInput.value = state.q;
    filterButtons.forEach((btn) => {
      const active = (btn.dataset.filter === 'permanent') === state.permanent;
      btn.classList.toggle('active', active);
    });
  }

  function addMetaRow(container, label, value) {
    const span = document.createElement('span');
    span.textContent = `${label}: ${value}`;
    container.append(span);
  }

  function renderItem(item) {
    const card = document.createElement('a');
    card.className = 'share-item';
    card.href = `/s/${encodeURIComponent(item.alias)}`;

    const title = document.createElement('h2');
    title.className = 'share-item-title';
    title.textContent = item.title || t('untitled');
    card.append(title);

    const path = document.createElement('span');
    path.className = 'share-item-path';
    path.textContent = `/${item.alias}`;
    card.append(path);

    if (item.description) {
      const description = document.createElement('p');
      description.className = 'share-item-desc';
      description.textContent = item.description;
      card.append(description);
    }

    if (item.tags.length) {
      const tags = document.createElement('div');
      tags.className = 'share-item-tags';
      item.tags.forEach((tag) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.textContent = tag;
        tags.append(tagEl);
      });
      card.append(tags);
    }

    const detail = document.createElement('div');
    detail.className = 'share-item-meta';
    if (item.author) addMetaRow(detail, t('authorMeta'), item.author);
    addMetaRow(detail, t('createdMeta'), formatDate(item.createdAt));
    addMetaRow(
      detail,
      t('expiresMeta'),
      item.isPermanent ? t('permanent') : formatDate(item.expiresAt)
    );
    card.append(detail);

    return card;
  }

  function render(items) {
    list.replaceChildren(...items.map(renderItem));
    if (!state.total) {
      meta.textContent = '';
      empty.hidden = false;
      pager.hidden = true;
      updateUrl();
      return;
    }
    empty.hidden = true;
    meta.textContent = t('resultCount', { total: state.total });
    pager.hidden = false;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.totalPages;
    pageInfo.textContent = t('pageInfo', {
      page: state.page,
      totalPages: state.totalPages,
    });
    updateUrl();
  }

  async function load() {
    const id = ++requestId;
    clearTimeout(searchTimer);
    errorEl.hidden = true;
    empty.hidden = true;
    meta.textContent = t('searching');
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    const params = new URLSearchParams({
      page: String(state.page),
      page_size: String(PAGE_SIZE),
    });
    if (state.q) params.set('q', state.q);
    if (state.permanent) params.set('permanent', '1');

    try {
      const response = await fetch(`/api/shares?${params}`);
      if (!response.ok) throw new Error('browse failed');
      const data = await response.json();
      if (id !== requestId) return;
      state.total = data.total;
      state.totalPages = data.totalPages;
      state.page = data.page;
      render(data.items);
    } catch {
      if (id !== requestId) return;
      list.replaceChildren();
      meta.textContent = '';
      errorEl.textContent = t('browseFailed');
      errorEl.hidden = false;
      pager.hidden = true;
    }
  }

  function onSearch() {
    state.q = searchInput.value.trim();
    state.page = 1;
    load();
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(onSearch, 250);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onSearch();
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const permanent = btn.dataset.filter === 'permanent';
      if (permanent === state.permanent) return;
      state.permanent = permanent;
      state.page = 1;
      filterButtons.forEach((other) => {
        other.classList.toggle('active', other === btn);
      });
      load();
    });
  });

  prevBtn.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    load();
  });

  nextBtn.addEventListener('click', () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    load();
  });

  document.addEventListener('zenshare:locale', load);

  readInitialState();
  load();
})();
