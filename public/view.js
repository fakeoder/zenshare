(function () {
  const site = window.ZenshareSite;
  site.init();

  const data = JSON.parse(
    document.getElementById('share-data').textContent
  );
  const t = (key, vars) => site.t(key, vars);

  const frame = document.getElementById('shareFrame');
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
  const shareBtn = document.getElementById('shareBtn');
  const shareToast = document.getElementById('shareToast');

  let unlockedHtml = null;
  let unlocking = false;
  let unlockPassword = null;
  let shareToastTimer = null;

  document.title = `${data.title || data.alias} · Zenshare`;

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

  function showFrame(html) {
    unlockedHtml = html;
    frame.srcdoc = html;
    closeMenu();
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

  function showShareToast() {
    shareToast.textContent = t('copied');
    shareToast.hidden = false;
    clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => {
      shareToast.hidden = true;
    }, 1600);
  }

  function buildShareUrl() {
    const base = new URL(`/s/${data.alias}`, location.origin).href;
    return data.passwordProtected && unlockPassword
      ? `${base}?password=${encodeURIComponent(unlockPassword)}`
      : base;
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
    addMetaRow(t('createdMeta'), formatDate(data.createdAt));
    addMetaRow(t('expiresMeta'), data.isPermanent ? t('permanent') : formatDate(data.expiresAt));
  }

  async function handleUnlock() {
    if (unlocking) return;
    unlocking = true;
    lockError.hidden = true;
    unlockBtn.disabled = true;
    try {
      const html = await decryptShare(passwordInput.value);
      unlockPassword = passwordInput.value;
      lockScreen.hidden = true;
      showFrame(html);
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
    if (!unlockedHtml) return;
    const blob = new Blob([unlockedHtml], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${data.alias}.html`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  shareBtn.addEventListener('click', async () => {
    closeMenu();
    if (!unlockedHtml) return;
    await copyToClipboard(buildShareUrl());
    showShareToast();
  });

  document.addEventListener('zenshare:locale', () => {
    if (!lockScreen.hidden) updateLockMeta();
    if (!metaPanel.hidden) buildMeta();
    if (!shareToast.hidden) shareToast.textContent = t('copied');
  });

  if (!data.passwordProtected) {
    const html = new TextDecoder('utf-8').decode(base64ToBytes(data.content));
    showFrame(html);
  } else {
    updateLockMeta();
    lockScreen.hidden = false;
    const autoPassword = new URL(location.href).searchParams.get('password');
    if (autoPassword) {
      passwordInput.value = autoPassword;
      handleUnlock();
    } else {
      passwordInput.focus();
    }
  }
})();
