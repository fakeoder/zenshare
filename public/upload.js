(function () {
  const site = window.ZenshareSite;
  site.init();

  const MAX_BYTES = 512 * 1024;
  const BACKDOOR_PREFIX = 'zenshare/';
  const ALIAS_RE = /^[a-z0-9_-]{1,40}$/;
  const t = (key, vars) => site.t(key, vars);
  const $ = (id) => document.getElementById(id);

  const form = $('shareForm');
  const fileInput = $('fileInput');
  const fileDrop = $('fileDrop');
  const fileText = $('fileText');
  const fileMeta = $('fileMeta');
  const previewPanel = $('previewPanel');
  const previewFrame = $('previewFrame');
  const aliasInput = $('aliasInput');
  const aliasStatus = $('aliasStatus');
  const titleInput = $('titleInput');
  const authorInput = $('authorInput');
  const descInput = $('descInput');
  const tagsInput = $('tagsInput');
  const expirySelect = $('expirySelect');
  const passwordInput = $('passwordInput');
  const submitBtn = $('submitBtn');
  const submitLabel = $('submitLabel');
  const resultPanel = $('resultPanel');
  const resultLink = $('resultLink');
  const copyLinkBtn = $('copyLinkBtn');
  const copyLinkLabel = $('copyLinkLabel');
  const copyPwdBtn = $('copyPwdBtn');
  const copyPwdLabel = $('copyPwdLabel');
  const openLinkBtn = $('openLinkBtn');
  const openLinkLabel = $('openLinkLabel');
  const formError = $('formError');

  let selectedFile = null;
  let aliasTimer = null;
  let checkCounter = 0;
  let lastCheck = null;
  let createdBaseUrl = '';
  let createdPassword = null;

  function rebuildExpiryOptions() {
    const current = expirySelect.value || '7';
    expirySelect.replaceChildren();
    for (let day = 1; day <= 30; day += 1) {
      const option = document.createElement('option');
      option.value = String(day);
      option.textContent =
        day === 7 ? t('dayDefault', { n: day }) : t('day', { n: day });
      expirySelect.append(option);
    }
    expirySelect.value = current;
  }

  function normalizeAlias(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return { error: 'alias_empty' };
    let alias = value;
    let permanent = false;
    if (alias.startsWith(BACKDOOR_PREFIX)) {
      permanent = true;
      alias = alias.slice(BACKDOOR_PREFIX.length);
    }
    if (alias === 'zenshare' || !ALIAS_RE.test(alias)) {
      return { error: 'alias_invalid' };
    }
    return { alias, permanent };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function encryptFile(bytes, password) {
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

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function hideError() {
    formError.hidden = true;
  }

  async function handleFile(file) {
    if (!file) {
      selectedFile = null;
      fileText.textContent = t('pickFile');
      fileMeta.textContent = '';
      previewPanel.hidden = true;
      previewFrame.srcdoc = '';
      return;
    }
    if (!/\.(html?|xhtml)$/i.test(file.name)) {
      selectedFile = null;
      fileText.textContent = t('pickFile');
      fileMeta.textContent = t('fileTypeError');
      previewPanel.hidden = true;
      previewFrame.srcdoc = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      selectedFile = null;
      fileText.textContent = t('pickFile');
      fileMeta.textContent = t('fileTooLarge', { size: MAX_BYTES / 1024 });
      previewPanel.hidden = true;
      previewFrame.srcdoc = '';
      return;
    }
    selectedFile = file;
    fileText.textContent = file.name;
    fileMeta.textContent = formatBytes(file.size);
    try {
      previewFrame.srcdoc = await file.text();
      previewPanel.hidden = false;
    } catch {
      previewPanel.hidden = true;
    }
  }

  function renderAliasStatus() {
    if (!lastCheck) {
      aliasStatus.textContent = '';
      aliasStatus.className = 'alias-status';
      return;
    }
    if (lastCheck.error) {
      aliasStatus.textContent = t('aliasInvalid');
      aliasStatus.className = 'alias-status invalid';
      return;
    }
    if (!lastCheck.available) {
      aliasStatus.textContent = t('aliasTaken');
      aliasStatus.className = 'alias-status taken';
      return;
    }
    aliasStatus.textContent = lastCheck.permanent
      ? t('aliasPermanentAvailable')
      : t('aliasAvailable');
    aliasStatus.className = 'alias-status ok';
  }

  function updateAliasStatus() {
    clearTimeout(aliasTimer);
    const value = aliasInput.value.trim();
    const normalized = normalizeAlias(value);
    expirySelect.disabled = Boolean(normalized.permanent);

    if (!value) {
      lastCheck = null;
      renderAliasStatus();
      return;
    }
    if (normalized.error) {
      lastCheck = { error: true };
      renderAliasStatus();
      return;
    }

    const token = ++checkCounter;
    lastCheck = null;
    aliasStatus.textContent = t('aliasChecking');
    aliasStatus.className = 'alias-status';

    aliasTimer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/alias-check?alias=${encodeURIComponent(value)}`
        );
        const result = await response.json();
        if (token !== checkCounter) return;
        if (!response.ok || !result.available) {
          lastCheck = { available: false };
        } else {
          lastCheck = {
            available: true,
            permanent: result.permanent || normalized.permanent,
          };
        }
        renderAliasStatus();
      } catch {
        if (token === checkCounter) {
          lastCheck = null;
          aliasStatus.textContent = t('aliasCheckFailed');
          aliasStatus.className = 'alias-status invalid';
        }
      }
    }, 300);
  }

  function setSubmitting(submitting) {
    submitBtn.disabled = submitting;
    submitLabel.textContent = submitting ? t('creating') : t('createShare');
  }

  function apiError(result, fallback) {
    const map = {
      alias_empty: t('aliasEmpty'),
      alias_invalid: t('aliasInvalid'),
      alias_taken: t('aliasTaken'),
      file_too_large: t('fileTooLarge', { size: MAX_BYTES / 1024 }),
      content_empty: t('contentEmpty'),
      expires_invalid: t('expiresInvalid'),
      storage_full: t('storageFull'),
      field_too_long: t('fieldTooLong'),
      tag_too_long: t('tagTooLong'),
      tags_invalid: t('tagsInvalid'),
    };
    return map[result.code] || fallback || t('requestError');
  }

  function withPasswordUrl() {
    return createdPassword
      ? `${createdBaseUrl}?password=${encodeURIComponent(createdPassword)}`
      : createdBaseUrl;
  }

  function refreshResultButtons() {
    const hasPassword = Boolean(createdPassword);
    copyPwdBtn.hidden = !hasPassword;
    copyLinkLabel.textContent = t('copyLink');
    copyPwdLabel.textContent = t('copyWithPassword');
    openLinkLabel.textContent = hasPassword
      ? t('openLinkWithPassword')
      : t('openLink');
  }

  fileDrop.addEventListener('click', () => fileInput.click());
  fileDrop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach((name) => {
    fileDrop.addEventListener(name, (event) => {
      event.preventDefault();
      fileDrop.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach((name) => {
    fileDrop.addEventListener(name, (event) => {
      event.preventDefault();
      fileDrop.classList.remove('drag');
    });
  });
  fileDrop.addEventListener('drop', (event) => {
    handleFile(event.dataTransfer.files[0]);
  });

  aliasInput.addEventListener('input', updateAliasStatus);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const normalized = normalizeAlias(aliasInput.value.trim());
    if (normalized.error) {
      showError(t(normalized.error));
      return;
    }
    if (!selectedFile) {
      showError(t('selectFile'));
      return;
    }

    const checkResponse = await fetch(
      `/api/alias-check?alias=${encodeURIComponent(aliasInput.value.trim())}`
    );
    const checkResult = await checkResponse.json();
    if (!checkResponse.ok || !checkResult.available) {
      showError(apiError(checkResult, t('aliasTaken')));
      return;
    }

    setSubmitting(true);
    try {
      const raw = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(raw);
      const payload = {
        alias: aliasInput.value.trim(),
        title:
          titleInput.value.trim() ||
          selectedFile.name.replace(/\.(html?|xhtml)$/i, ''),
        description: descInput.value.trim(),
        author: authorInput.value.trim(),
        tags: tagsInput.value
          .split(/[，,\s]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 10),
        expires_days: Number(expirySelect.value),
        password_protected: false,
      };

      if (passwordInput.value) {
        const encrypted = await encryptFile(bytes, passwordInput.value);
        payload.content = bytesToBase64(encrypted.cipher);
        payload.salt = bytesToBase64(encrypted.salt);
        payload.iv = bytesToBase64(encrypted.iv);
        payload.password_protected = true;
      } else {
        payload.content = bytesToBase64(bytes);
      }

      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(apiError(result, result.error || t('createFailed')));
      }

      createdBaseUrl = new URL(
        `/s/${result.alias}`,
        location.origin
      ).href;
      createdPassword = passwordInput.value || null;
      resultLink.value = createdBaseUrl;
      refreshResultButtons();
      resultPanel.hidden = false;
      resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      showError(error.message || t('createFailed'));
    } finally {
      setSubmitting(false);
    }
  });

  async function copyText(text, labelEl, resetKey) {
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
    labelEl.textContent = t('copied');
    setTimeout(() => {
      labelEl.textContent = t(resetKey || 'copyLink');
    }, 1600);
  }

  copyLinkBtn.addEventListener('click', () => {
    copyText(createdBaseUrl, copyLinkLabel, 'copyLink');
  });
  copyPwdBtn.addEventListener('click', () => {
    copyText(withPasswordUrl(), copyPwdLabel, 'copyWithPassword');
  });
  openLinkBtn.addEventListener('click', () => {
    window.open(withPasswordUrl(), '_blank', 'noopener');
  });

  document.addEventListener('zenshare:locale', () => {
    rebuildExpiryOptions();
    if (selectedFile) {
      fileText.textContent = selectedFile.name;
      fileMeta.textContent = formatBytes(selectedFile.size);
    }
    renderAliasStatus();
    submitLabel.textContent = submitBtn.disabled
      ? t('creating')
      : t('createShare');
    refreshResultButtons();
    if (formError.hidden === false) {
      formError.textContent = formError.dataset.lastKey
        ? t(formError.dataset.lastKey)
        : formError.textContent;
    }
  });

  rebuildExpiryOptions();
  renderAliasStatus();
})();
