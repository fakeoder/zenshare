(function () {
  const site = window.ZenshareSite;
  site.init();

  const t = (key, vars) => site.t(key, vars);
  const badge = document.getElementById('serviceBadge');
  const capacityText = document.getElementById('capacityText');
  const usedText = document.getElementById('usedText');
  const remainingText = document.getElementById('remainingText');
  const capacityFill = document.getElementById('capacityFill');
  const detail = document.getElementById('statusDetail');
  const updated = document.getElementById('statusUpdated');
  const error = document.getElementById('statusError');

  const STATUS_KEYS = {
    healthy: 'statusHealthy',
    warning: 'statusWarning',
    error: 'statusError',
  };
  const DETAIL_KEYS = {
    healthy: 'statusDetailHealthy',
    warning: 'statusDetailWarning',
    error: 'statusDetailError',
  };

  let currentStatus = null;
  let currentCheckedAt = null;
  let loadFailed = false;

  function formatTime(ms) {
    const locale = site.getLang() === 'zh' ? 'zh-CN' : 'en-US';
    return new Date(ms).toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function render() {
    document.title = `${t('statusTitle')} · Zenshare`;
    if (loadFailed) {
      badge.textContent = t('statusError');
      badge.className = 'status-badge error';
      capacityFill.className = 'capacity-fill error';
      error.textContent = t('statusUnavailable');
      error.hidden = false;
      return;
    }
    if (!currentStatus) {
      badge.textContent = t('statusLoading');
      badge.className = 'status-badge';
      error.hidden = true;
      return;
    }
    error.hidden = true;
    const status = STATUS_KEYS[currentStatus] ? currentStatus : 'error';
    badge.textContent = t(STATUS_KEYS[status]);
    badge.className = `status-badge ${status}`;
    capacityFill.className = `capacity-fill ${status}`;
    detail.textContent = t(DETAIL_KEYS[status]);
    updated.textContent = `${t('statusUpdated')} ${formatTime(currentCheckedAt)}`;
    updated.hidden = false;
  }

  async function loadStatus() {
    badge.textContent = t('statusLoading');
    badge.className = 'status-badge';
    error.hidden = true;
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('status unavailable');
      currentStatus = data.status;
      currentCheckedAt = data.checkedAt;
      capacityText.textContent = `${data.used} / ${data.max}`;
      usedText.textContent = `${data.percent}%`;
      remainingText.textContent = String(data.remaining);
      capacityFill.style.width = `${Math.min(100, data.percent)}%`;
    } catch {
      loadFailed = true;
    }
    render();
  }

  document.addEventListener('zenshare:locale', render);
  loadStatus();
})();
