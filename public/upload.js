(function () {
  const site = window.ZenshareSite;
  site.init();

  const MAX_BYTES = 512 * 1024;
  const ALIAS_RE = /^[a-z0-9_-]{1,40}$/;
  const PREVIEW_STORAGE_KEY = 'zenshare.preview';
  const ZTOOLS_ICS_CREATE_URL = 'https://ztools.zkraft.cc/ics_calendar';
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
  const t = (key, vars) => site.t(key, vars);
  const $ = (id) => document.getElementById(id);

  const form = $('shareForm');
  const fileInput = $('fileInput');
  const fileDrop = $('fileDrop');
  const fileText = $('fileText');
  const fileMeta = $('fileMeta');
  const previewBtn = $('previewBtn');
  const aliasInput = $('aliasInput');
  const aliasStatus = $('aliasStatus');
  const titleInput = $('titleInput');
  const authorInput = $('authorInput');
  const descInput = $('descInput');
  const tagsInput = $('tagsInput');
  const expirySelect = $('expirySelect');
  const visibilityButtons = Array.from(
    document.querySelectorAll('[data-visibility]')
  );
  const visibilityHint = $('visibilityHint');
  const passwordField = $('passwordField');
  const passwordHint = $('passwordHint');
  const passwordInput = $('passwordInput');
  const generatePwdBtn = $('generatePwdBtn');
  const submitBtn = $('submitBtn');
  const submitLabel = $('submitLabel');
  const resultPanel = $('resultPanel');
  const resultLink = $('resultLink');
  const resultRawField = $('resultRawField');
  const resultRawLink = $('resultRawLink');
  const copyLinkBtn = $('copyLinkBtn');
  const copyLinkLabel = $('copyLinkLabel');
  const copyRawBtn = $('copyRawBtn');
  const copyRawLabel = $('copyRawLabel');
  const copyPwdBtn = $('copyPwdBtn');
  const copyPwdLabel = $('copyPwdLabel');
  const openLinkBtn = $('openLinkBtn');
  const openLinkLabel = $('openLinkLabel');
  const formError = $('formError');
  const formatChips = Array.from(document.querySelectorAll('.format-chip'));
  const ztoolsIcsLink = $('ztoolsIcsLink');
  const tokenStore = window.ZenshareToken;
  const manageableInput = $('manageableInput');
  const tokenPanel = $('tokenPanel');
  const tokenStatus = $('tokenStatus');
  const tokenGenerateBtn = $('tokenGenerateBtn');
  const tokenUploadBtn = $('tokenUploadBtn');
  const tokenFileInput = $('tokenFileInput');

  let selectedFile = null;
  let selectedFileType = null;
  let selectedPreviewHtml = '';
  let visibility = 'public';
  let aliasTimer = null;
  let checkCounter = 0;
  let lastCheck = null;
  let createdBaseUrl = '';
  let createdRawUrl = '';
  let createdPassword = null;

  function rebuildExpiryOptions() {
    const choices = ['1', '7', '30', 'permanent'];
    const current = choices.includes(expirySelect.value)
      ? expirySelect.value
      : '7';
    expirySelect.replaceChildren();
    choices.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent =
        value === 'permanent'
          ? t('neverDelete')
          : value === '7'
            ? t('dayDefault', { n: Number(value) })
            : t('day', { n: Number(value) });
      expirySelect.append(option);
    });
    expirySelect.value = current;
  }

  function normalizeAlias(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return { alias: '', generated: true };
    const alias = value;
    if (alias === 'zenshare' || !ALIAS_RE.test(alias)) {
      return { error: 'alias_invalid' };
    }
    return { alias };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function generateStrongPassword() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return bytesToBase64(bytes)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
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

  function inferFileType(name) {
    const match = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    if (!match) return null;
    return EXT_TO_TYPE[match[1].toLowerCase()] || null;
  }

  function stripExtension(name) {
    return String(name || '').replace(/\.[^.]+$/, '');
  }

  function highlightChip(type) {
    formatChips.forEach((chip) => {
      chip.classList.toggle('active', Boolean(type) && chip.dataset.type === type);
    });
  }

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function hideError() {
    formError.hidden = true;
  }

  function applyVisibility() {
    visibilityButtons.forEach((btn) => {
      const active = btn.dataset.visibility === visibility;
      btn.classList.toggle('active', active);
      if (active) {
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.removeAttribute('aria-pressed');
      }
    });
    const isPrivate = visibility === 'private';
    passwordField.hidden = !isPrivate;
    generatePwdBtn.hidden = !isPrivate;
    passwordInput.required = isPrivate;
    visibilityHint.textContent = t(
      isPrivate ? 'visibilityPrivateHint' : 'visibilityPublicHint'
    );
    passwordHint.textContent = isPrivate
      ? t('passwordRequired')
      : t('passwordHint');
    if (isPrivate) {
      if (!passwordInput.value) {
        passwordInput.value = generateStrongPassword();
      }
    } else {
      passwordInput.value = '';
    }
  }

  visibilityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      visibility = btn.dataset.visibility;
      applyVisibility();
    });
  });

  generatePwdBtn.addEventListener('click', () => {
    passwordInput.value = generateStrongPassword();
    passwordInput.focus();
  });

  function clearPreview() {
    try {
      localStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch {
    }
    previewBtn.hidden = true;
  }

  function savePreview(name, content, type) {
    localStorage.setItem(
      PREVIEW_STORAGE_KEY,
      JSON.stringify({ name, content, type: type || 'html' })
    );
    previewBtn.hidden = false;
  }

  function openPreview() {
    if (!selectedFile || !selectedPreviewHtml) return;
    savePreview(selectedFile.name, selectedPreviewHtml, selectedFileType);
    const isMobile =
      window.matchMedia('(max-width: 700px)').matches ||
      window.matchMedia('(pointer: coarse)').matches;
    const availableWidth = window.screen?.availWidth || 1280;
    const availableHeight = window.screen?.availHeight || 800;
    const width = Math.max(420, Math.min(1120, Math.round(availableWidth * 0.8)));
    const height = Math.max(420, Math.min(820, Math.round(availableHeight * 0.82)));
    const left = Math.max(0, Math.round((availableWidth - width) / 2));
    const top = Math.max(0, Math.round((availableHeight - height) / 2));
    const previewWindow = isMobile
      ? window.open('/preview.html', '_blank')
      : window.open(
          '/preview.html',
          'zenshare-preview',
          `popup=yes,width=${width},height=${height},left=${left},top=${top}`
        );

    if (!previewWindow) {
      showError(t('previewBlocked'));
      return;
    }
    previewWindow.focus();
  }

  async function handleFile(file) {
    if (!file) {
      selectedFile = null;
      selectedFileType = null;
      selectedPreviewHtml = '';
      fileText.textContent = t('pickFile');
      fileMeta.textContent = '';
      highlightChip(null);
      clearPreview();
      return;
    }
    const fileType = inferFileType(file.name);
    if (!fileType) {
      selectedFile = null;
      selectedFileType = null;
      selectedPreviewHtml = '';
      fileText.textContent = t('pickFile');
      fileMeta.textContent = t('fileTypeError');
      highlightChip(null);
      clearPreview();
      return;
    }
    if (file.size > MAX_BYTES) {
      selectedFile = null;
      selectedFileType = null;
      selectedPreviewHtml = '';
      fileText.textContent = t('pickFile');
      fileMeta.textContent = t('fileTooLarge', { size: MAX_BYTES / 1024 });
      highlightChip(null);
      clearPreview();
      return;
    }
    selectedFile = file;
    selectedFileType = fileType;
    fileText.textContent = file.name;
    fileMeta.textContent = `${fileType.toUpperCase()} · ${formatBytes(file.size)}`;
    highlightChip(fileType);
    try {
      selectedPreviewHtml = await file.text();
      savePreview(file.name, selectedPreviewHtml, fileType);
    } catch {
      selectedFile = null;
      selectedFileType = null;
      selectedPreviewHtml = '';
      fileText.textContent = t('pickFile');
      fileMeta.textContent = t('contentEmpty');
      highlightChip(null);
      clearPreview();
    }
  }

  function renderAliasStatus() {
    if (!aliasInput.value.trim()) {
      aliasStatus.textContent = t('aliasAuto');
      aliasStatus.className = 'alias-status auto';
      return;
    }
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
    aliasStatus.textContent = t('aliasAvailable');
    aliasStatus.className = 'alias-status ok';
  }

  function updateAliasStatus() {
    clearTimeout(aliasTimer);
    const value = aliasInput.value.trim();
    const normalized = normalizeAlias(value);

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
          lastCheck = { available: true };
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
      alias_invalid: t('aliasInvalid'),
      alias_taken: t('aliasTaken'),
      file_too_large: t('fileTooLarge', { size: MAX_BYTES / 1024 }),
      file_type_invalid: t('fileTypeError'),
      content_empty: t('contentEmpty'),
      content_invalid: t('contentInvalid'),
      expires_invalid: t('expiresInvalid'),
      storage_full: t('storageFull'),
      field_too_long: t('fieldTooLong'),
      tag_too_long: t('tagTooLong'),
      tags_invalid: t('tagsInvalid'),
      token_invalid: t('tokenInvalid'),
    };
    return map[result.code] || fallback || t('requestError');
  }

  function renderTokenStatus() {
    const record = tokenStore.read();
    if (record) {
      tokenStatus.textContent = t('tokenLoaded', {
        short: tokenStore.short(record),
      });
      tokenStatus.classList.add('loaded');
    } else {
      tokenStatus.textContent = t('tokenMissing');
      tokenStatus.classList.remove('loaded');
    }
  }

  function applyManageable() {
    tokenPanel.hidden = !manageableInput.checked;
    if (!manageableInput.checked) return;
    renderTokenStatus();
  }

  manageableInput.addEventListener('change', applyManageable);
  document.addEventListener('zenshare:token', renderTokenStatus);

  tokenGenerateBtn.addEventListener('click', () => {
    tokenStore.generateAndDownload();
    renderTokenStatus();
  });

  tokenUploadBtn.addEventListener('click', () => tokenFileInput.click());

  tokenFileInput.addEventListener('change', async () => {
    const file = tokenFileInput.files[0];
    tokenFileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (!tokenStore.importText(text)) {
        showError(t('tokenInvalid'));
      } else {
        hideError();
      }
    } catch {
      showError(t('tokenInvalid'));
    }
    renderTokenStatus();
  });

  function withPasswordUrl() {
    return createdPassword
      ? `${createdBaseUrl}#password=${encodeURIComponent(createdPassword)}`
      : createdBaseUrl;
  }

  function refreshResultButtons() {
    const hasPassword = Boolean(createdPassword);
    copyPwdBtn.hidden = !hasPassword;
    copyLinkLabel.textContent = t('copyLink');
    copyRawLabel.textContent = t('copyRawLink');
    copyPwdLabel.textContent = t('copyWithPassword');
    copyRawBtn.hidden = hasPassword || !createdRawUrl;
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

  previewBtn.addEventListener('click', openPreview);

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
    if (visibility === 'private' && !passwordInput.value.trim()) {
      passwordInput.value = generateStrongPassword();
    }

    let manageToken = null;
    if (manageableInput.checked) {
      manageToken = tokenStore.read();
      if (!manageToken) {
        showError(t('tokenRequired'));
        applyManageable();
        tokenGenerateBtn.focus();
        return;
      }
    }

    if (!normalized.generated) {
      const checkResponse = await fetch(
        `/api/alias-check?alias=${encodeURIComponent(normalized.alias)}`
      );
      const checkResult = await checkResponse.json();
      if (!checkResponse.ok || !checkResult.available) {
        showError(apiError(checkResult, t('aliasTaken')));
        return;
      }
    }

    setSubmitting(true);
    try {
      const raw = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(raw);
      const payload = {
        alias: aliasInput.value.trim(),
        title: titleInput.value.trim() || stripExtension(selectedFile.name),
        description: descInput.value.trim(),
        author: authorInput.value.trim(),
        tags: tagsInput.value
          .split(/[，,\s]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 10),
        expires_days:
          expirySelect.value === 'permanent'
            ? null
            : Number(expirySelect.value),
        password_protected: visibility === 'private',
        file_type: selectedFileType || 'html',
        filename: selectedFile.name,
      };

      if (visibility === 'private') {
        const encrypted = await encryptFile(bytes, passwordInput.value);
        payload.content = bytesToBase64(encrypted.cipher);
        payload.salt = bytesToBase64(encrypted.salt);
        payload.iv = bytesToBase64(encrypted.iv);
        if (manageToken) {
          payload.password_wrap = await window.ZenshareWrap.wrap(
            passwordInput.value,
            manageToken.token
          );
        }
      } else {
        payload.content = bytesToBase64(bytes);
      }
      if (manageToken) payload.manage_token = manageToken.token;

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
      createdRawUrl =
        visibility === 'private'
          ? ''
          : new URL(`/s/${result.alias}/raw`, location.origin).href;
      createdPassword = visibility === 'private' ? passwordInput.value : null;
      resultLink.value = createdBaseUrl;
      resultRawLink.value = createdRawUrl;
      resultRawField.hidden = !createdRawUrl;
      refreshResultButtons();
      try {
        localStorage.removeItem(PREVIEW_STORAGE_KEY);
      } catch {
      }
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
  copyRawBtn.addEventListener('click', () => {
    copyText(createdRawUrl, copyRawLabel, 'copyRawLink');
    if (selectedFileType === 'ics') {
      copyRawLabel.textContent = t('rawLinkCopiedIcs');
      setTimeout(() => {
        copyRawLabel.textContent = t('copyRawLink');
      }, 1600);
    }
  });
  copyPwdBtn.addEventListener('click', () => {
    copyText(withPasswordUrl(), copyPwdLabel, 'copyWithPassword');
  });
  openLinkBtn.addEventListener('click', () => {
    window.open(withPasswordUrl(), '_blank', 'noopener');
  });

  document.addEventListener('zenshare:locale', () => {
    rebuildExpiryOptions();
    applyVisibility();
    if (selectedFile) {
      fileText.textContent = selectedFile.name;
      fileMeta.textContent = `${(selectedFileType || 'html').toUpperCase()} · ${formatBytes(selectedFile.size)}`;
    }
    renderAliasStatus();
    renderTokenStatus();
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
  applyVisibility();
  renderAliasStatus();
  applyManageable();
  if (ZTOOLS_ICS_CREATE_URL) {
    ztoolsIcsLink.href = ZTOOLS_ICS_CREATE_URL;
    ztoolsIcsLink.hidden = false;
  }
})();
