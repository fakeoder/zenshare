(function () {
  const site = window.ZenshareSite;
  site.init();

  const STORAGE_KEY = 'zenshare.preview';
  const previewName = document.getElementById('previewName');
  const previewFrame = document.getElementById('previewFrame');
  const previewEmpty = document.getElementById('previewEmpty');
  const closeBtn = document.getElementById('previewCloseBtn');

  let preview = null;
  try {
    preview = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    preview = null;
  }

  if (preview && preview.content) {
    previewName.textContent = preview.name || site.t('preview');
    previewFrame.srcdoc = preview.content;
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
