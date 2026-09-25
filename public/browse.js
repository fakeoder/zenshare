(function () {
  const site = window.ZenshareSite;
  site.init();
  const tokenStore = window.ZenshareToken;

  const PAGE_SIZE = 20;
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => site.t(key, vars);

  const form = $('browseForm');
  const searchInput = $('searchInput');
  const tabs = Array.from(document.querySelectorAll('[data-tab]'));
  const pageTitle = document.querySelector('.browse-head .page-title');
  const pageSubtitle = document.querySelector('.browse-head .upload-subtitle');
  const meta = $('browseMeta');
  const list = $('browseList');
  const empty = $('browseEmpty');
  const emptyText = empty.querySelector('p');
  const errorEl = $('browseError');
  const pager = $('browsePager');
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const pageInfo = $('pageInfo');
  const mineTokenBar = $('mineTokenBar');
  const mineTokenStatus = $('mineTokenStatus');
  const minePrompt = $('minePrompt');
  const promptOpenBtn = $('promptOpenTokenModal');

  const editModal = $('editModal');
  const editForm = $('editForm');
  const editTitleInput = $('editTitleInput');
  const editAuthorInput = $('editAuthorInput');
  const editDescInput = $('editDescInput');
  const editTagsInput = $('editTagsInput');
  const editExpirySelect = $('editExpirySelect');
  const editVisibilityButtons = Array.from(
    document.querySelectorAll('[data-edit-visibility]')
  );
  const editVisibilityHint = $('editVisibilityHint');
  const editFileText = $('editFileText');
  const editFileBtn = $('editFileBtn');
  const editFileInput = $('editFileInput');
  const editPasswordField = $('editPasswordField');
  const editPasswordLabel = $('editPasswordLabel');
  const editPasswordInput = $('editPasswordInput');
  const editPasswordHint = $('editPasswordHint');
  const editError = $('editError');
  const editSaveBtn = $('editSaveBtn');
  const editSaveLabel = $('editSaveLabel');
  const editCancelBtn = $('editCancelBtn');

  const FILE_TYPES = {
    html: ['html', 'htm', 'xhtml'],
    ics: ['ics'],
    csv: ['csv'],
    json: ['json'],
    md: ['md', 'markdown'],
    txt: ['txt', 'log'],
    xml: ['xml'],
    yaml: ['yaml', 'yml'],
  };
  const EXT_TO_TYPE = {};
  Object.entries(FILE_TYPES).forEach(([type, exts]) => {
    exts.forEach((ext) => {
      EXT_TO_TYPE[ext] = type;
    });
  });
  const MAX_BYTES = 512 * 1024;

  const state = {
    tab: 'public',
    q: '',
    page: 1,
    total: 0,
    totalPages: 1,
  };
  let searchTimer = null;
  let requestId = 0;
  let editItem = null;
  let editFile = null;
  let editVisibility = 'public';
  let editExpiry = 'keep';
  let editSaving = false;

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

  function generatePassword() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function inferFileType(name) {
    const match = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    if (!match) return null;
    return EXT_TO_TYPE[match[1].toLowerCase()] || null;
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (state.tab !== 'public') params.set('tab', state.tab);
    if (state.q) params.set('q', state.q);
    if (state.page > 1) params.set('page', String(state.page));
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  }

  function readInitialState() {
    const params = new URLSearchParams(location.search);
    state.q = (params.get('q') || '').trim();
    state.page = Math.max(1, Number(params.get('page')) || 1);
    state.tab = params.get('tab') === 'mine' ? 'mine' : 'public';
    searchInput.value = state.q;
    tabs.forEach((btn) => {
      const active = btn.dataset.tab === state.tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
  }

  function syncChrome() {
    const mine = state.tab === 'mine';
    pageTitle.setAttribute('data-i18n', mine ? 'myShares' : 'browseTitle');
    pageTitle.textContent = t(mine ? 'myShares' : 'browseTitle');
    pageSubtitle.setAttribute(
      'data-i18n',
      mine ? 'mySharesSubtitle' : 'browseSubtitle'
    );
    pageSubtitle.textContent = t(mine ? 'mySharesSubtitle' : 'browseSubtitle');
    emptyText.setAttribute('data-i18n', mine ? 'manageTabEmpty' : 'noResults');
    emptyText.textContent = t(mine ? 'manageTabEmpty' : 'noResults');
    renderTokenChrome();
  }

  function renderTokenChrome() {
    if (state.tab !== 'mine') {
      mineTokenBar.hidden = true;
      minePrompt.hidden = true;
      form.hidden = false;
      return;
    }
    const record = tokenStore.read();
    if (!record) {
      mineTokenBar.hidden = true;
      form.hidden = true;
      minePrompt.hidden = false;
      return;
    }
    minePrompt.hidden = true;
    form.hidden = false;
    mineTokenBar.hidden = false;
    const label = record.label;
    mineTokenStatus.textContent = label
      ? t('tokenLoadedLabel', { label })
      : t('tokenLoaded', { short: tokenStore.short(record) });
    mineTokenStatus.classList.add('loaded');
  }

  function addMetaRow(container, label, value) {
    const span = document.createElement('span');
    span.textContent = `${label}: ${value}`;
    container.append(span);
  }

  function appendBadges(container, item) {
    if (item.fileType && item.fileType !== 'html') {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'type-badge';
      typeBadge.textContent = String(item.fileType).toUpperCase();
      container.append(typeBadge);
    }
    if (item.passwordProtected) {
      const badge = document.createElement('span');
      badge.className = 'type-badge locked';
      badge.textContent = t('encrypted');
      container.append(badge);
    }
  }

  function appendDescription(card, item) {
    if (!item.description) return;
    const description = document.createElement('p');
    description.className = 'share-item-desc';
    description.textContent = item.description;
    card.append(description);
  }

  function appendTags(card, item) {
    if (!item.tags.length) return;
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

  function appendMeta(card, item) {
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
  }

  function renderItem(item) {
    const card = document.createElement('a');
    card.className = 'share-item';
    card.href = `/s/${encodeURIComponent(item.alias)}`;

    const head = document.createElement('div');
    head.className = 'share-item-head';
    const title = document.createElement('h2');
    title.className = 'share-item-title';
    title.textContent = item.title || item.alias || t('untitled');
    head.append(title);
    const dateSpan = document.createElement('span');
    dateSpan.className = 'share-item-date';
    dateSpan.textContent = formatDate(item.createdAt);
    head.append(dateSpan);
    card.append(head);

    const path = document.createElement('span');
    path.className = 'share-item-path';
    path.textContent = `/s/${item.alias}`;
    card.append(path);

    const badges = document.createElement('div');
    badges.className = 'share-item-badges';
    appendBadges(badges, item);
    if (badges.childElementCount) card.append(badges);

    appendDescription(card, item);
    appendTags(card, item);
    appendMeta(card, item);
    return card;
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.append(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
    }
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = t('copied');
    setTimeout(() => {
      button.textContent = button.dataset.label;
    }, 1600);
  }

  function actionButton(labelKey, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn ghost small';
    button.textContent = t(labelKey);
    button.dataset.label = t(labelKey);
    button.addEventListener('click', onClick);
    return button;
  }

  function renderMineItem(item) {
    const card = document.createElement('div');
    card.className = 'share-item manage-item';

    const head = document.createElement('div');
    head.className = 'manage-head';
    const titleLink = document.createElement('a');
    titleLink.className = 'share-item-title';
    titleLink.href = `/s/${encodeURIComponent(item.alias)}`;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener';
    titleLink.textContent = item.title || item.alias || t('untitled');
    head.append(titleLink);
    const dateSpan = document.createElement('span');
    dateSpan.className = 'share-item-date';
    dateSpan.textContent = formatDate(item.createdAt);
    head.append(dateSpan);
    const badges = document.createElement('span');
    badges.className = 'share-item-badges';
    appendBadges(badges, item);
    if (badges.childElementCount) head.append(badges);
    card.append(head);

    const path = document.createElement('span');
    path.className = 'share-item-path';
    path.textContent = `/s/${item.alias}`;
    card.append(path);

    appendDescription(card, item);
    appendTags(card, item);
    appendMeta(card, item);

    const shareUrl = new URL(
      `/s/${encodeURIComponent(item.alias)}`,
      location.origin
    ).href;
    const actions = document.createElement('div');
    actions.className = 'share-item-actions';
    actions.append(
      actionButton('copyLink', (event) =>
        copyText(shareUrl, event.currentTarget)
      )
    );
    if (!item.passwordProtected) {
      const rawUrl = new URL(
        `/s/${encodeURIComponent(item.alias)}/raw`,
        location.origin
      ).href;
      actions.append(
        actionButton('copyRawLink', (event) =>
          copyText(rawUrl, event.currentTarget)
        )
      );
    } else {
      actions.append(
        actionButton('copyPassword', async (event) => {
          const button = event.currentTarget;
          try {
            const password = await recoverPassword(item, tokenStore.read());
            errorEl.hidden = true;
            await copyText(password, button);
          } catch (error) {
            showListError(error);
          }
        })
      );
      actions.append(
        actionButton('copyDecryptLink', async (event) => {
          const button = event.currentTarget;
          try {
            const password = await recoverPassword(item, tokenStore.read());
            errorEl.hidden = true;
            await copyText(decryptLink(item, password), button);
          } catch (error) {
            showListError(error);
          }
        })
      );
    }
    actions.append(actionButton('editShare', () => openEdit(item)));
    const deleteBtn = actionButton('deleteShare', () => removeItem(item));
    deleteBtn.classList.add('danger');
    actions.append(deleteBtn);
    card.append(actions);

    return card;
  }

  function resetPager() {
    pager.hidden = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }

  function renderPublic(items) {
    list.replaceChildren(
      ...items.map((item) =>
        item.manageable ? renderMineItem(item) : renderItem(item)
      )
    );
    if (!state.total) {
      meta.textContent = '';
      empty.hidden = false;
      resetPager();
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

  function renderMine(items) {
    list.replaceChildren(...items.map(renderMineItem));
    if (!state.total) {
      meta.textContent = '';
      empty.hidden = false;
      resetPager();
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

  function queryBase() {
    const params = new URLSearchParams({
      page: String(state.page),
      page_size: String(PAGE_SIZE),
    });
    if (state.q) params.set('q', state.q);
    return params;
  }

  function authHeaders() {
    const record = tokenStore.read();
    return record ? { authorization: `Bearer ${record.token}` } : {};
  }

  async function loadPublic() {
    const id = ++requestId;
    clearTimeout(searchTimer);
    errorEl.hidden = true;
    empty.hidden = true;
    meta.textContent = t('searching');
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    try {
      const response = await fetch(`/api/shares?${queryBase()}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('browse failed');
      const data = await response.json();
      if (id !== requestId) return;
      state.total = data.total;
      state.totalPages = data.totalPages;
      state.page = data.page;
      renderPublic(data.items);
    } catch {
      if (id !== requestId) return;
      list.replaceChildren();
      meta.textContent = '';
      errorEl.textContent = t('browseFailed');
      errorEl.hidden = false;
      resetPager();
    }
  }

  async function loadMine() {
    renderTokenChrome();
    const record = tokenStore.read();
    if (!record) {
      list.replaceChildren();
      meta.textContent = '';
      errorEl.hidden = true;
      empty.hidden = true;
      resetPager();
      return;
    }

    const id = ++requestId;
    clearTimeout(searchTimer);
    errorEl.hidden = true;
    empty.hidden = true;
    meta.textContent = t('searching');
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    try {
      const response = await fetch(`/api/my-shares?${queryBase()}`, {
        headers: { authorization: `Bearer ${record.token}` },
      });
      if (response.status === 401 || response.status === 404) {
        throw new Error('token rejected');
      }
      if (!response.ok) throw new Error('browse failed');
      const data = await response.json();
      if (id !== requestId) return;
      state.total = data.total;
      state.totalPages = data.totalPages;
      state.page = data.page;
      renderMine(data.items);
    } catch {
      if (id !== requestId) return;
      list.replaceChildren();
      meta.textContent = '';
      errorEl.textContent = t('browseFailed');
      errorEl.hidden = false;
      resetPager();
    }
  }

  function load() {
    if (state.tab === 'mine') {
      loadMine();
    } else {
      loadPublic();
    }
  }

  function setTab(tab) {
    const next = tab === 'mine' ? 'mine' : 'public';
    if (state.tab === next) return;
    state.tab = next;
    state.page = 1;
    state.total = 0;
    state.totalPages = 1;
    tabs.forEach((btn) => {
      const active = btn.dataset.tab === next;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    syncChrome();
    updateUrl();
    load();
  }

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

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

  promptOpenBtn.addEventListener('click', () => tokenStore.open());

  document.addEventListener('zenshare:token', () => {
    state.page = 1;
    state.total = 0;
    renderTokenChrome();
    load();
  });

  function rebuildExpiryOptions() {
    const choices = ['keep', '1', '7', '30', 'permanent'];
    const current = choices.includes(editExpiry) ? editExpiry : 'keep';
    editExpirySelect.replaceChildren();
    choices.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent =
        value === 'keep'
          ? t('keepExpiry')
          : value === 'permanent'
            ? t('neverDelete')
            : value === '7'
              ? t('dayDefault', { n: Number(value) })
              : t('day', { n: Number(value) });
      editExpirySelect.append(option);
    });
    editExpirySelect.value = current;
  }

  function showEditError(message) {
    editError.textContent = message;
    editError.hidden = false;
  }

  function hideEditError() {
    editError.hidden = true;
  }

  function editApiError(result, fallback) {
    const map = {
      content_required: t('editRequiresFile'),
      file_meta_without_content: t('editRequiresFile'),
      file_too_large: t('fileTooLarge', { size: MAX_BYTES / 1024 }),
      file_type_invalid: t('fileTypeError'),
      content_empty: t('contentEmpty'),
      content_invalid: t('contentInvalid'),
      expires_invalid: t('expiresInvalid'),
      field_too_long: t('fieldTooLong'),
      tag_too_long: t('tagTooLong'),
      tags_invalid: t('tagsInvalid'),
      token_required: t('tokenRequired'),
      not_found: t('browseFailed'),
      gone: t('browseFailed'),
    };
    return map[result.code] || fallback || t('requestError');
  }

  function renderEditControls() {
    const isPrivate = editVisibility === 'private';
    editVisibilityButtons.forEach((btn) => {
      const active = btn.dataset.editVisibility === editVisibility;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-pressed', 'true');
      else btn.removeAttribute('aria-pressed');
    });

    const encryptedNow = Boolean(editItem && editItem.passwordProtected);
    const needsPassword = isPrivate;
    editPasswordField.hidden = !needsPassword;
    if (needsPassword && !editPasswordInput.value.trim() && (!encryptedNow || editFile)) {
      editPasswordInput.value = generatePassword();
    }
    if (!needsPassword) editPasswordInput.value = '';

    editVisibilityHint.textContent = t(
      isPrivate ? 'visibilityPrivateHint' : 'visibilityPublicHint'
    );
    const replacingPassword = encryptedNow && !editFile;
    editPasswordLabel.textContent = t(
      replacingPassword ? 'newPassword' : 'accessPassword'
    );
    editPasswordHint.textContent = t(
      replacingPassword ? 'editPasswordKeepHint' : 'editPasswordHint'
    );
  }

  function openEdit(item) {
    editItem = item;
    editFile = null;
    editVisibility = item.passwordProtected ? 'private' : 'public';
    editExpiry = 'keep';
    editTitleInput.value = item.title || '';
    editAuthorInput.value = item.author || '';
    editDescInput.value = item.description || '';
    editTagsInput.value = (item.tags || []).join(', ');
    editPasswordInput.value = '';
    editFileText.textContent = item.filename || `${item.alias}.${item.fileType}`;
    editFileInput.value = '';
    rebuildExpiryOptions();
    hideEditError();
    renderEditControls();
    editModal.hidden = false;
    document.body.classList.add('modal-open');
    editTitleInput.focus();
  }

  function closeEdit() {
    editModal.hidden = true;
    document.body.classList.remove('modal-open');
    editItem = null;
    editFile = null;
    hideEditError();
  }

  editCancelBtn.addEventListener('click', closeEdit);
  editModal.querySelectorAll('[data-close-edit]').forEach((el) => {
    el.addEventListener('click', closeEdit);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !editModal.hidden) closeEdit();
  });

  editVisibilityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      editVisibility = btn.dataset.editVisibility;
      renderEditControls();
    });
  });

  editExpirySelect.addEventListener('change', () => {
    editExpiry = editExpirySelect.value;
  });

  editFileBtn.addEventListener('click', () => editFileInput.click());
  editFileInput.addEventListener('change', () => {
    const file = editFileInput.files[0];
    if (!file) return;
    const type = inferFileType(file.name);
    if (!type) {
      editFile = null;
      editFileInput.value = '';
      showEditError(t('fileTypeError'));
      return;
    }
    if (file.size > MAX_BYTES) {
      editFile = null;
      editFileInput.value = '';
      showEditError(t('fileTooLarge', { size: MAX_BYTES / 1024 }));
      return;
    }
    hideEditError();
    editFile = { file, type };
    editFileText.textContent = file.name;
    renderEditControls();
  });

  async function encryptBytes(bytes, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      bytes
    );
    return { cipher: new Uint8Array(cipher), salt, iv };
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function decryptBytes(data, password) {
    const salt = base64ToBytes(data.salt);
    const iv = base64ToBytes(data.iv);
    const cipher = base64ToBytes(data.content);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipher
    );
    return new Uint8Array(plain);
  }

  async function fetchShareContent(alias, record) {
    const response = await fetch(
      `/api/share/${encodeURIComponent(alias)}/content`,
      { headers: { authorization: `Bearer ${record.token}` } }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.code || 'content_load_failed');
    }
    if (typeof result.content !== 'string' || !result.content) {
      throw new Error('content_empty');
    }
    return result;
  }

  async function recoverPassword(item, record) {
    if (!record) {
      const error = new Error('token_required');
      error.code = 'token_required';
      throw error;
    }
    const current = await fetchShareContent(item.alias, record);
    if (!current.password_wrap) {
      const error = new Error('password_not_recoverable');
      error.code = 'password_not_recoverable';
      throw error;
    }
    return window.ZenshareWrap.unwrap(current.password_wrap, record.token);
  }

  function showListError(error) {
    const code = (error && error.code) || '';
    errorEl.textContent =
      code === 'token_required'
        ? t('tokenRequired')
        : code === 'password_not_recoverable'
          ? t('passwordNotRecoverable')
          : t('editContentLoadFailed');
    errorEl.hidden = false;
  }

  function decryptLink(item, password) {
    const base = new URL(
      `/s/${encodeURIComponent(item.alias)}`,
      location.origin
    ).href;
    return `${base}#password=${encodeURIComponent(password)}`;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function setEditSaving(saving) {
    editSaving = saving;
    editSaveBtn.disabled = saving;
    editCancelBtn.disabled = saving;
    editSaveLabel.textContent = saving ? t('saving') : t('saveChanges');
  }

  async function removeItem(item) {
    const record = tokenStore.read();
    if (!record) {
      renderTokenChrome();
      return;
    }
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      const response = await fetch(
        `/api/share/${encodeURIComponent(item.alias)}`,
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${record.token}` },
        }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        errorEl.textContent = editApiError(result, t('deleteFailed'));
        errorEl.hidden = false;
        return;
      }
      errorEl.hidden = true;
      load();
    } catch {
      errorEl.textContent = t('deleteFailed');
      errorEl.hidden = false;
    }
  }

  async function applyContent(payload, bytes, isPrivate, record) {
    if (isPrivate) {
      const password = editPasswordInput.value.trim() || generatePassword();
      const encrypted = await encryptBytes(bytes, password);
      payload.password_protected = true;
      payload.content = bytesToBase64(encrypted.cipher);
      payload.salt = bytesToBase64(encrypted.salt);
      payload.iv = bytesToBase64(encrypted.iv);
      payload.password_wrap = await window.ZenshareWrap.wrap(
        password,
        record.token
      );
      return;
    }
    payload.password_protected = false;
    payload.content = bytesToBase64(bytes);
  }

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!editItem || editSaving) return;
    const record = tokenStore.read();
    if (!record) {
      closeEdit();
      return;
    }
    hideEditError();

    const encryptedNow = Boolean(editItem.passwordProtected);
    const targetPrivate = editVisibility === 'private';
    const newPassword = editPasswordInput.value.trim();

    const payload = {
      title: editTitleInput.value.trim(),
      author: editAuthorInput.value.trim(),
      description: editDescInput.value.trim(),
      tags: editTagsInput.value
        .split(/[，,\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 10),
    };
    if (editExpiry !== 'keep') {
      payload.expires_days =
        editExpiry === 'permanent' ? null : Number(editExpiry);
    }

    setEditSaving(true);
    try {
      if (editFile) {
        const bytes = new Uint8Array(await editFile.file.arrayBuffer());
        payload.file_type = editFile.type;
        payload.filename = editFile.file.name;
        await applyContent(payload, bytes, targetPrivate, record);
      } else if (targetPrivate !== encryptedNow || (targetPrivate && newPassword)) {
        let current;
        try {
          current = await fetchShareContent(editItem.alias, record);
        } catch (error) {
          showEditError(
            error.message === 'token_required'
              ? t('tokenRequired')
              : t('editContentLoadFailed')
          );
          return;
        }

        let bytes = null;
        if (current.password_protected) {
          if (!current.salt || !current.iv) {
            showEditError(t('editContentLoadFailed'));
            return;
          }
          if (!current.password_wrap) {
            showEditError(t('passwordNotRecoverable'));
            return;
          }
          try {
            const currentPassword = await window.ZenshareWrap.unwrap(
              current.password_wrap,
              record.token
            );
            bytes = await decryptBytes(current, currentPassword);
          } catch {
            showEditError(t('editDecryptFailed'));
            return;
          }
        } else {
          bytes = base64ToBytes(current.content);
        }

        payload.file_type = current.file_type;
        payload.filename = current.filename;
        await applyContent(payload, bytes, targetPrivate, record);
      }

      const response = await fetch(
        `/api/share/${encodeURIComponent(editItem.alias)}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${record.token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        showEditError(editApiError(result, result.error || t('editFailed')));
        return;
      }
      closeEdit();
      load();
    } catch {
      showEditError(t('editFailed'));
    } finally {
      setEditSaving(false);
    }
  });

  document.addEventListener('zenshare:locale', () => {
    syncChrome();
    rebuildExpiryOptions();
    renderEditControls();
    load();
    if (!editModal.hidden) {
      editSaveLabel.textContent = editSaving ? t('saving') : t('saveChanges');
    }
  });

  readInitialState();
  syncChrome();
  load();
})();
