(function () {
  const site = window.ZenshareSite;
  site.init();

  const MAX_BYTES = 512 * 1024;
  const ALIAS_RE = /^[a-z0-9_-]{1,40}$/;
  const PREVIEW_STORAGE_KEY = 'zenshare.preview';
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
  const copyLinkBtn = $('copyLinkBtn');
  const copyLinkLabel = $('copyLinkLabel');
  const copyPwdBtn = $('copyPwdBtn');
  const copyPwdLabel = $('copyPwdLabel');
  const openLinkBtn = $('openLinkBtn');
  const openLinkLabel = $('openLinkLabel');
  const formError = $('formError');

  let selectedFile = null;
  let selectedPreviewHtml = '';
  let selectedUploadHtml = '';
  let selectedUploadSize = 0;
  let uploadedCompressed = false;
  let visibility = 'public';
  let aliasTimer = null;
  let checkCounter = 0;
  let lastCheck = null;
  let createdBaseUrl = '';
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

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = src;
    });
  }

  // 把单个 data:image/*;base64 压缩为更小的 WebP/JPEG，压不掉则返回 null
  async function compressImageDataUri(dataUri) {
    const mimeMatch = dataUri.match(/^data:image\/([^;,]+)/);
    const kind = mimeMatch ? mimeMatch[1].toLowerCase() : '';
    // 只栅格化常见位图；跨域无法绘制、SVG/AVIF/GIF 等直接跳过
    if (!['png', 'jpeg', 'jpg', 'webp', 'bmp'].includes(kind)) {
      return null;
    }
    const base64Idx = dataUri.indexOf('base64,');
    if (base64Idx < 0) return null;
    const raw = base64ToBytes(dataUri.slice(base64Idx + 7));
    if (!raw.byteLength) return null;
    const url = URL.createObjectURL(
      new Blob([raw], { type: `image/${kind}` })
    );
    try {
      const img = await loadImage(url);
      if (!img.naturalWidth || !img.naturalHeight) return null;
      const MAX_DIM = 1400;
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const webp = canvas.toDataURL('image/webp', 0.8);
      const out =
        webp && webp.length < dataUri.length
          ? webp
          : canvas.toDataURL('image/jpeg', 0.85);
      return out.length < dataUri.length ? out : null;
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // 找出 HTML 中所有嵌入的 base64 图片并压缩；只压缩能压小的
  async function compressEmbeddedImages(html) {
    const re =
      /data:image\/[^"'<>\s,;]+;base64,[A-Za-z0-9+/=]+/g;
    const seen = new Set();
    let match;
    while ((match = re.exec(html)) !== null && seen.size < 60) {
      seen.add(match[0]);
    }
    if (!seen.size) return html;
    const replacements = await Promise.all(
      [...seen].map(async (dataUri) => ({
        dataUri,
        out: await compressImageDataUri(dataUri).catch(() => null),
      }))
    );
    let out = html;
    replacements.forEach(({ dataUri, out: replacement }) => {
      if (replacement) out = out.split(dataUri).join(replacement);
    });
    return out;
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

  function savePreview(name, content) {
    localStorage.setItem(
      PREVIEW_STORAGE_KEY,
      JSON.stringify({ name, content })
    );
    previewBtn.hidden = false;
  }

  function openPreview() {
    if (!selectedFile || !selectedPreviewHtml) return;
    savePreview(selectedFile.name, selectedPreviewHtml);
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

  function clearSelection() {
    selectedFile = null;
    selectedPreviewHtml = '';
    selectedUploadHtml = '';
    selectedUploadSize = 0;
    uploadedCompressed = false;
    fileText.textContent = t('pickFile');
    fileMeta.textContent = '';
    clearPreview();
  }

  async function handleFile(file) {
    if (!file) {
      clearSelection();
      return;
    }
    if (!/\.(html?|xhtml)$/i.test(file.name)) {
      clearSelection();
      fileMeta.textContent = t('fileTypeError');
      return;
    }
    selectedFile = file;
    fileText.textContent = file.name;
    try {
      let text = await file.text();
      let bytes = new TextEncoder().encode(text).byteLength;
      uploadedCompressed = false;
      if (bytes > MAX_BYTES) {
        text = await compressEmbeddedImages(text);
        bytes = new TextEncoder().encode(text).byteLength;
        uploadedCompressed = true;
      }
      if (bytes > MAX_BYTES) {
        selectedFile = null;
        selectedPreviewHtml = '';
        selectedUploadHtml = '';
        selectedUploadSize = 0;
        fileText.textContent = t('pickFile');
        fileMeta.textContent = t(
          uploadedCompressed ? 'fileTooLargeAfterCompress' : 'fileTooLarge',
          { size: MAX_BYTES / 1024 }
        );
        clearPreview();
        return;
      }
      selectedUploadHtml = text;
      selectedUploadSize = bytes;
      selectedPreviewHtml = text;
      fileMeta.textContent = uploadedCompressed
        ? `${formatBytes(file.size)} → ${formatBytes(bytes)} · ${t('fileCompressed')}`
        : formatBytes(bytes);
      savePreview(file.name, selectedPreviewHtml);
    } catch {
      clearSelection();
      fileMeta.textContent = t('contentEmpty');
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
      ? `${createdBaseUrl}#password=${encodeURIComponent(createdPassword)}`
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
      const bytes = new TextEncoder().encode(selectedUploadHtml);
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
        expires_days:
          expirySelect.value === 'permanent'
            ? null
            : Number(expirySelect.value),
        password_protected: visibility === 'private',
      };

      if (visibility === 'private') {
        const encrypted = await encryptFile(bytes, passwordInput.value);
        payload.content = bytesToBase64(encrypted.cipher);
        payload.salt = bytesToBase64(encrypted.salt);
        payload.iv = bytesToBase64(encrypted.iv);
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
      createdPassword = visibility === 'private' ? passwordInput.value : null;
      resultLink.value = createdBaseUrl;
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
      fileMeta.textContent = uploadedCompressed
        ? `${formatBytes(selectedFile.size)} → ${formatBytes(selectedUploadSize)} · ${t('fileCompressed')}`
        : formatBytes(selectedUploadSize);
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
  applyVisibility();
  renderAliasStatus();
})();
