(function () {
  const STORAGE_KEY = 'zenshare.token';
  const FILE_NAME = 'zenshare-token.json';
  const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

  function randomToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function normalize(record) {
    if (!record || typeof record !== 'object') return null;
    const token = typeof record.token === 'string' ? record.token.trim() : '';
    if (!TOKEN_RE.test(token) || new Set(token).size < 16) return null;
    const createdAt = Number(record.createdAt);
    return {
      version: 1,
      token,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
      label: typeof record.label === 'string' ? record.label.slice(0, 60) : '',
    };
  }

  function emit() {
    document.dispatchEvent(new CustomEvent('zenshare:token'));
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function save(record) {
    const normalized = normalize(record);
    if (!normalized) return null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    emit();
    return normalized;
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    emit();
  }

  function create(label) {
    return normalize({
      version: 1,
      token: randomToken(),
      createdAt: Date.now(),
      label,
    });
  }

  function promptLabel() {
    const answer = window.prompt(t('tokenLabelPrompt'), '');
    if (answer === null) return null;
    return answer.trim().slice(0, 60);
  }

  function parse(text) {
    try {
      return normalize(JSON.parse(text));
    } catch {
      return null;
    }
  }

  function download(record) {
    const blob = new Blob([`${JSON.stringify(record, null, 2)}\n`], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function generateAndDownload() {
    const label = promptLabel();
    if (label === null) return null;
    const record = create(label);
    if (!record) return null;
    download(record);
    return save(record);
  }

  function importText(text) {
    const record = parse(text);
    if (!record) return null;
    return save(record);
  }

  function short(record) {
    const current = record || read();
    if (!current) return '';
    return `${current.token.slice(0, 8)}…`;
  }

  function t(key, vars) {
    const site = window.ZenshareSite;
    return site ? site.t(key, vars) : key;
  }

  const KEY_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 ' +
    '7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>';

  const CLOSE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>';

  let chrome = null;
  let requiredCloseCallback = null;

  function syncModalClass() {
    const open = Array.from(document.querySelectorAll('.modal')).some(
      (modal) => !modal.hidden
    );
    document.body.classList.toggle('modal-open', open);
  }

  function closeTokenModal() {
    if (!chrome) return;
    const cb = requiredCloseCallback;
    requiredCloseCallback = null;
    chrome.modal.hidden = true;
    syncModalClass();
    if (cb) cb();
  }

  function openTokenModal(onClose) {
    if (!chrome) return;
    requiredCloseCallback = typeof onClose === 'function' ? onClose : null;
    refreshChrome();
    chrome.modal.hidden = false;
    syncModalClass();
    chrome.closeBtn.focus();
  }

  function formatDate(ms) {
    if (!ms) return '';
    const lang = window.ZenshareSite ? window.ZenshareSite.getLang() : 'zh';
    return new Date(ms).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function refreshChrome() {
    if (!chrome) return;
    const record = read();
    const label = record && record.label ? record.label : '';
    const hasToken = Boolean(record);
    chrome.copyBtn.hidden = !hasToken;
    chrome.downloadBtn.hidden = !hasToken;
    chrome.clearBtn.hidden = !hasToken;
    chrome.meta.hidden = !hasToken;
    chrome.labelChip.hidden = !label;
    chrome.labelChip.textContent = label;
    chrome.labelChip.title = label;
    chrome.labelChip.setAttribute('aria-label', label ? `${t('tokenLabel')}: ${label}` : '');
    chrome.created.textContent = record
      ? `${t('tokenCreatedAt')}: ${formatDate(record.createdAt)}`
      : '';
    chrome.labelInput.value = '';
    if (!window.ZenshareSite) return;
    chrome.status.classList.toggle('loaded', hasToken);
    if (hasToken) {
      chrome.status.textContent = label
        ? t('tokenLoadedLabel', { label })
        : t('tokenLoaded', { short: short(record) });
    } else {
      chrome.status.textContent = t('tokenMissing');
    }
    chrome.hint.textContent = hasToken
      ? t('tokenFileImportant')
      : t('tokenNoTokenHint');
  }

  function feedback(button, labelKey) {
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = t(labelKey);
    setTimeout(() => {
      button.textContent = button.dataset.label;
    }, 1600);
  }

  function mountChrome() {
    const actions = document.querySelector('.topbar-actions');
    if (!actions || document.getElementById('tokenKeyBtn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-btn';
    button.id = 'tokenKeyBtn';
    button.setAttribute('data-i18n-title', 'manageToken');
    button.setAttribute('data-i18n-aria-label', 'manageToken');
    button.innerHTML = KEY_ICON;
    button.addEventListener('click', openTokenModal);
    actions.append(button);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'tokenManageModal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-backdrop" data-close-token></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="tokenManageHeading">
        <header class="modal-head">
          <h2 id="tokenManageHeading" data-i18n="manageToken"></h2>
          <button type="button" class="icon-btn" data-close-token data-i18n-title="close" aria-label="Close">${CLOSE_ICON}</button>
        </header>
        <div class="modal-body">
          <span id="tokenManageStatus" class="token-status" aria-live="polite"></span>
          <span id="tokenManageHint" class="field-hint"></span>
          <div id="tokenManageMeta" class="token-meta" hidden>
            <span id="tokenManageLabel" class="token-label-chip" hidden></span>
            <span id="tokenManageCreated" class="token-meta-created"></span>
          </div>
          <div class="token-actions">
            <button id="tokenManageCopy" class="btn ghost small" type="button" data-i18n="copyToken"></button>
            <button id="tokenManageDownload" class="btn ghost small" type="button" data-i18n="tokenDownload"></button>
            <button id="tokenManageImport" class="btn ghost small" type="button" data-i18n="tokenSwitch"></button>
            <div class="token-gen-row">
              <input id="tokenManageLabelInput" class="text-input small" type="text" maxlength="60" data-i18n-placeholder="tokenLabelPlaceholder" />
              <button id="tokenManageGenerate" class="btn ghost small" type="button" data-i18n="tokenGenerate"></button>
            </div>
            <button id="tokenManageClear" class="btn ghost small danger" type="button" data-i18n="tokenRemove"></button>
            <input id="tokenManageFile" type="file" accept=".json,application/json" hidden />
          </div>
          <span class="field-hint warn-hint" data-i18n="tokenWarn"></span>
          <div class="modal-actions">
            <button class="btn ghost" type="button" data-close-token data-i18n="close"></button>
          </div>
        </div>
      </div>`;
    document.body.append(modal);

    chrome = {
      button,
      modal,
      status: modal.querySelector('#tokenManageStatus'),
      hint: modal.querySelector('#tokenManageHint'),
      meta: modal.querySelector('#tokenManageMeta'),
      labelChip: modal.querySelector('#tokenManageLabel'),
      created: modal.querySelector('#tokenManageCreated'),
      copyBtn: modal.querySelector('#tokenManageCopy'),
      downloadBtn: modal.querySelector('#tokenManageDownload'),
      importBtn: modal.querySelector('#tokenManageImport'),
      labelInput: modal.querySelector('#tokenManageLabelInput'),
      generateBtn: modal.querySelector('#tokenManageGenerate'),
      clearBtn: modal.querySelector('#tokenManageClear'),
      fileInput: modal.querySelector('#tokenManageFile'),
      closeBtn: modal.querySelector('[data-close-token].icon-btn'),
    };

    modal.querySelectorAll('[data-close-token]').forEach((el) => {
      el.addEventListener('click', closeTokenModal);
    });

    chrome.copyBtn.addEventListener('click', async () => {
      const record = read();
      if (!record) return closeTokenModal();
      try {
        await navigator.clipboard.writeText(record.token);
      } catch {
        const temp = document.createElement('textarea');
        temp.value = record.token;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.append(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      feedback(chrome.copyBtn, 'copied');
    });

    chrome.downloadBtn.addEventListener('click', () => {
      const record = read();
      if (!record) return closeTokenModal();
      download(record);
    });

    chrome.importBtn.addEventListener('click', () => {
      if (read() && !window.confirm(t('tokenImportConfirm'))) return;
      chrome.fileInput.click();
    });
    chrome.fileInput.addEventListener('change', () => {
      const file = chrome.fileInput.files[0];
      chrome.fileInput.value = '';
      if (!file) return;
      file
        .text()
        .then((text) => {
          if (!importText(text)) {
            window.alert(t('tokenInvalid'));
            return;
          }
          refreshChrome();
        })
        .catch(() => window.alert(t('tokenInvalid')));
    });

    chrome.generateBtn.addEventListener('click', () => {
      const hasToken = Boolean(read());
      if (hasToken && !window.confirm(t('tokenGenerateConfirm'))) return;
      const label = chrome.labelInput.value.trim().slice(0, 60);
      const record = create(label);
      if (!record) return;
      download(record);
      save(record);
      refreshChrome();
    });

    chrome.clearBtn.addEventListener('click', () => {
      if (!window.confirm(t('tokenClearConfirm'))) return;
      clear();
      closeTokenModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && chrome && !chrome.modal.hidden) {
        closeTokenModal();
      }
    });
    document.addEventListener('zenshare:token', refreshChrome);
    document.addEventListener('zenshare:locale', refreshChrome);

    refreshChrome();
  }

  window.ZenshareToken = {
    FILE_NAME,
    read,
    save,
    clear,
    create,
    parse,
    download,
    generateAndDownload,
    importText,
    short,
    mountChrome,
    open: openTokenModal,
  };

  mountChrome();
})();
