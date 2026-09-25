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

  function create() {
    return normalize({ version: 1, token: randomToken(), createdAt: Date.now() });
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
    const record = create();
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
  };
})();
