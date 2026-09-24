(function () {
  const site = window.ZenshareSite;
  site.init();

  const STORAGE_KEY = 'zenshare.preview';
  const previewName = document.getElementById('previewName');
  const previewFrame = document.getElementById('previewFrame');
  const previewEmpty = document.getElementById('previewEmpty');
  const closeBtn = document.getElementById('previewCloseBtn');

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function wrapTextPreview(text, type) {
    let body = text;
    if (type === 'json') {
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
      }
    }
    return (
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{margin:0;padding:16px;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
      'white-space:pre-wrap;word-break:break-word;background:#f4f3ef;color:#1f242a}' +
      '@media(prefers-color-scheme:dark){body{background:#111417;color:#e7eaed}}</style>' +
      '</head><body>' +
      escapeHtml(body) +
      '</body></html>'
    );
  }

  let preview = null;
  try {
    preview = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    preview = null;
  }

  if (preview && preview.content) {
    previewName.textContent = preview.name || site.t('preview');
    const type = preview.type || 'html';
    previewFrame.srcdoc =
      type === 'html' ? preview.content : wrapTextPreview(preview.content, type);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  } else {
    previewName.textContent = site.t('preview');
    previewFrame.hidden = true;
    previewEmpty.hidden = false;
  }

  closeBtn.addEventListener('click', () => {
    window.close();
  });
})();
