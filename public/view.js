(function () {
  const site = window.ZenshareSite;
  site.init();

  const data = JSON.parse(
    document.getElementById('share-data').textContent
  );
  const t = (key, vars) => site.t(key, vars);

  const frame = document.getElementById('shareFrame');
  const contentView = document.getElementById('contentView');
  const lockScreen = document.getElementById('lockScreen');
  const lockMeta = document.getElementById('lockMeta');
  const lockError = document.getElementById('lockError');
  const passwordInput = document.getElementById('passwordInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const toolbar = document.getElementById('toolbar');
  const menuBtn = document.getElementById('menuBtn');
  const actionMenu = document.getElementById('actionMenu');
  const metaBtn = document.getElementById('metaBtn');
  const metaPanel = document.getElementById('metaPanel');
  const metaCloseBtn = document.getElementById('metaCloseBtn');
  const metaTitle = document.getElementById('metaTitle');
  const metaBody = document.getElementById('metaBody');
  const downloadBtn = document.getElementById('downloadBtn');
  const rawLinkBtn = document.getElementById('rawLinkBtn');
  const shareBtn = document.getElementById('shareBtn');
  const shareToast = document.getElementById('shareToast');

  const FILE_MIME = {
    html: 'text/html;charset=utf-8',
    ics: 'text/calendar;charset=utf-8',
    csv: 'text/csv;charset=utf-8',
    json: 'application/json;charset=utf-8',
    md: 'text/markdown;charset=utf-8',
    txt: 'text/plain;charset=utf-8',
    xml: 'application/xml;charset=utf-8',
    yaml: 'text/yaml;charset=utf-8',
  };
  const FILE_EXT = {
    html: 'html',
    ics: 'ics',
    csv: 'csv',
    json: 'json',
    md: 'md',
    txt: 'txt',
    xml: 'xml',
    yaml: 'yaml',
  };

  let unlockedContent = null;
  let unlocking = false;
  let unlockPassword = null;
  let shareToastTimer = null;

  document.title = `${data.title || data.alias} · Zenshare`;

  if (data.passwordProtected) {
    rawLinkBtn.hidden = true;
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function decryptShare(password) {
    const salt = base64ToBytes(data.salt);
    const iv = base64ToBytes(data.iv);
    const cipher = base64ToBytes(data.content);
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipher
    );
    return new TextDecoder('utf-8').decode(plain);
  }

  function fileType() {
    return data.fileType && FILE_MIME[data.fileType] ? data.fileType : 'html';
  }

  function downloadFilename() {
    if (data.filename) return data.filename;
    return `${data.alias}.${FILE_EXT[fileType()] || 'txt'}`;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (field.length || row.length) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    return rows;
  }

  function renderCsv(text) {
    const rows = parseCsv(text);
    if (!rows.length) return '<pre class="text-view"></pre>';
    const header = rows[0];
    const body = rows.slice(1);
    const thead = header
      .map((cell) => `<th>${escapeHtml(cell)}</th>`)
      .join('');
    const tbody = body
      .map(
        (cells) =>
          `<tr>${cells
            .map((cell) => `<td>${escapeHtml(cell)}</td>`)
            .join('')}</tr>`
      )
      .join('');
    return `<table class="csv-view"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
  }

  function unfoldIcs(text) {
    return text.replace(/\r\n[ \t]/g, '').replace(/\r/g, '');
  }

  function icsProp(block, name) {
    const pattern = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'im');
    const match = block.match(pattern);
    return match ? match[1].trim() : '';
  }

  function formatIcsDate(value) {
    if (!value) return '';
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length < 8) return value;
    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6);
    const day = digits.slice(6, 8);
    let out = `${year}-${month}-${day}`;
    if (digits.length >= 11) {
      out += ` ${digits.slice(9, 11)}:${digits.slice(11, 13) || '00'}`;
    }
    return out;
  }

  function renderIcs(text) {
    const blocks = unfoldIcs(text).split(/BEGIN:VEVENT/i).slice(1);
    if (!blocks.length) return `<pre class="text-view">${escapeHtml(text)}</pre>`;
    const events = blocks.map((block) => {
      const summary = icsProp(block, 'SUMMARY') || t('untitled');
      const start = formatIcsDate(icsProp(block, 'DTSTART'));
      const end = formatIcsDate(icsProp(block, 'DTEND'));
      const location = icsProp(block, 'LOCATION');
      const description = icsProp(block, 'DESCRIPTION');
      return (
        '<article class="ics-event">' +
        `<h3>${escapeHtml(summary)}</h3>` +
        (start || end
          ? `<p class="ics-when">${escapeHtml(start)}${
              end ? ` → ${escapeHtml(end)}` : ''
            }</p>`
          : '') +
        (location ? `<p class="ics-where">${escapeHtml(location)}</p>` : '') +
        (description
          ? `<p class="ics-desc">${escapeHtml(description)}</p>`
          : '') +
        '</article>'
      );
    });
    return `<div class="ics-view">${events.join('')}</div>`;
  }

  function renderJson(text) {
    try {
      const pretty = JSON.stringify(JSON.parse(text), null, 2);
      return `<pre class="text-view">${escapeHtml(pretty)}</pre>`;
    } catch {
      return `<pre class="text-view">${escapeHtml(text)}</pre>`;
    }
  }

  function showContent(text) {
    unlockedContent = text;
    const type = fileType();
    closeMenu();
    if (type === 'html') {
      contentView.hidden = true;
      frame.hidden = false;
      frame.srcdoc = text;
    } else {
      frame.removeAttribute('srcdoc');
      frame.hidden = true;
      contentView.hidden = false;
      if (type === 'ics') {
        contentView.innerHTML = renderIcs(text);
      } else if (type === 'csv') {
        contentView.innerHTML = renderCsv(text);
      } else if (type === 'json') {
        contentView.innerHTML = renderJson(text);
      } else {
        contentView.innerHTML = `<pre class="text-view">${escapeHtml(text)}</pre>`;
      }
    }
    toolbar.hidden = false;
  }

  function setMenu(open) {
    actionMenu.hidden = !open;
    menuBtn.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) metaPanel.hidden = true;
  }

  function closeMenu() {
    setMenu(false);
  }

  function locale() {
    return site.getLang() === 'zh' ? 'zh-CN' : 'en-US';
  }

  function formatDate(ms) {
    return new Date(ms).toLocaleString(locale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function passwordFromUrl() {
    const url = new URL(location.href);
    const queryPassword = url.searchParams.get('password');
    if (queryPassword) return queryPassword;
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
    return fragment.get('password') || '';
  }

  async function copyToClipboard(text) {
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
  }

  function showShareToast(message) {
    shareToast.textContent = message || t('copied');
    shareToast.hidden = false;
    clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => {
      shareToast.hidden = true;
    }, 2400);
  }

  function buildShareUrl() {
    const base = new URL(`/s/${data.alias}`, location.origin).href;
    return data.passwordProtected && unlockPassword
      ? `${base}#password=${encodeURIComponent(unlockPassword)}`
      : base;
  }

  function buildRawUrl() {
    return new URL(`/s/${data.alias}/raw`, location.origin).href;
  }

  function updateLockMeta() {
    const metaTitleText = data.title || data.alias;
    lockMeta.textContent = data.author
      ? `${metaTitleText} · ${data.author}`
      : metaTitleText;
  }

  function addMetaRow(label, value) {
    const row = document.createElement('div');
    row.className = 'meta-row';
    const labelEl = document.createElement('div');
    labelEl.className = 'meta-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = 'meta-value';
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    metaBody.append(row);
  }

  function buildMeta() {
    metaTitle.textContent = data.title || data.alias;
    metaBody.replaceChildren();
    if (data.author) addMetaRow(t('authorMeta'), data.author);
    if (data.description) addMetaRow(t('descriptionMeta'), data.description);
    if (data.tags.length) {
      const row = document.createElement('div');
      row.className = 'meta-row';
      const labelEl = document.createElement('div');
      labelEl.className = 'meta-label';
      labelEl.textContent = t('tagsMeta');
      const list = document.createElement('div');
      list.className = 'tag-list';
      data.tags.forEach((tag) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.textContent = tag;
        list.append(tagEl);
      });
      row.append(labelEl, list);
      metaBody.append(row);
    }
    addMetaRow(t('linkMeta'), location.href);
    addMetaRow(t('fileTypeMeta'), fileType().toUpperCase());
    addMetaRow(t('createdMeta'), formatDate(data.createdAt));
    addMetaRow(t('expiresMeta'), data.isPermanent ? t('permanent') : formatDate(data.expiresAt));
  }

  async function handleUnlock() {
    if (unlocking) return;
    unlocking = true;
    lockError.hidden = true;
    unlockBtn.disabled = true;
    try {
      const text = await decryptShare(passwordInput.value);
      unlockPassword = passwordInput.value;
      lockScreen.hidden = true;
      showContent(text);
    } catch {
      lockError.hidden = false;
    } finally {
      unlocking = false;
      unlockBtn.disabled = false;
      passwordInput.value = '';
      passwordInput.focus();
    }
  }

  unlockBtn.addEventListener('click', handleUnlock);
  passwordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleUnlock();
  });

  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setMenu(actionMenu.hidden);
  });

  metaBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenu();
    buildMeta();
    metaPanel.hidden = !metaPanel.hidden;
  });
  metaCloseBtn.addEventListener('click', () => {
    metaPanel.hidden = true;
  });
  document.addEventListener('click', (event) => {
    if (!actionMenu.hidden && !toolbar.contains(event.target)) {
      closeMenu();
    }
    if (
      !metaPanel.hidden &&
      !metaPanel.contains(event.target) &&
      !toolbar.contains(event.target)
    ) {
      metaPanel.hidden = true;
    }
  });

  downloadBtn.addEventListener('click', () => {
    closeMenu();
    if (unlockedContent === null) return;
    const blob = new Blob([unlockedContent], {
      type: FILE_MIME[fileType()] || 'application/octet-stream',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = downloadFilename();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  rawLinkBtn.addEventListener('click', async () => {
    closeMenu();
    if (data.passwordProtected) return;
    await copyToClipboard(buildRawUrl());
    showShareToast(
      fileType() === 'ics' ? t('rawLinkCopiedIcs') : t('rawLinkCopied')
    );
  });

  shareBtn.addEventListener('click', async () => {
    closeMenu();
    if (unlockedContent === null) return;
    await copyToClipboard(buildShareUrl());
    showShareToast(t('copied'));
  });

  document.addEventListener('zenshare:locale', () => {
    if (!lockScreen.hidden) updateLockMeta();
    if (!metaPanel.hidden) buildMeta();
    if (!shareToast.hidden) shareToast.textContent = t('copied');
  });

  if (!data.passwordProtected) {
    const text = new TextDecoder('utf-8').decode(base64ToBytes(data.content));
    showContent(text);
  } else {
    updateLockMeta();
    lockScreen.hidden = false;
    const autoPassword = passwordFromUrl();
    if (autoPassword) {
      passwordInput.value = autoPassword;
      history.replaceState(null, '', new URL(location.href).pathname);
      handleUnlock();
    } else {
      passwordInput.focus();
    }
  }
})();
