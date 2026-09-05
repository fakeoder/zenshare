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
  const metaBtn = document.getElementById('metaBtn');
  const metaPanel = document.getElementById('metaPanel');
  const metaCloseBtn = document.getElementById('metaCloseBtn');
  const metaTitle = document.getElementById('metaTitle');
  const metaBody = document.getElementById('metaBody');
  const downloadBtn = document.getElementById('downloadBtn');
  const printBtn = document.getElementById('printBtn');
  const shareBtn = document.getElementById('shareBtn');

  let unlockedHtml = null;
  let unlocking = false;
  let unlockPassword = null;
  let frameLoaded = false;
  let frameLoadResolve = null;

  frame.addEventListener('load', () => {
    frameLoaded = true;
    if (frameLoadResolve) {
      frameLoadResolve();
      frameLoadResolve = null;
    }
  });

  function waitForFrameLoad() {
    if (frameLoaded) return Promise.resolve();
    return new Promise((resolve) => {
      frameLoadResolve = resolve;
    });
  }

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
    frameLoaded = false;
    frame.srcdoc = html;
    toolbar.hidden = false;
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

  metaBtn.addEventListener('click', () => {
    buildMeta();
    metaPanel.hidden = !metaPanel.hidden;
  });
  metaCloseBtn.addEventListener('click', () => {
    metaPanel.hidden = true;
  });
  document.addEventListener('click', (event) => {
    if (
      !metaPanel.hidden &&
      !metaPanel.contains(event.target) &&
      !metaBtn.contains(event.target)
    ) {
      metaPanel.hidden = true;
    }
  });

  downloadBtn.addEventListener('click', () => {
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

  printBtn.addEventListener('click', async () => {
    if (!unlockedHtml) return;
    await waitForFrameLoad();
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      try {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(unlockedHtml);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 250);
        } else {
          window.print();
        }
      } catch {
        window.print();
      }
    }
  });

  shareBtn.addEventListener('click', async () => {
    await copyToClipboard(buildShareUrl());
    shareBtn.title = t('shareCopied');
    setTimeout(() => {
      shareBtn.title = t('share');
    }, 1600);
  });

  document.addEventListener('zenshare:locale', () => {
    if (!lockScreen.hidden) updateLockMeta();
    if (!metaPanel.hidden) buildMeta();
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
