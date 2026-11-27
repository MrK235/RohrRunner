(() => {
  const currentText = document.querySelector('.welcome-version')?.textContent || '';
  const notice = document.getElementById('updateNotice');
  const parseVersion = value => {
    const match = String(value).trim().match(/^(?:Version\s+)?v?(\d+)\.(\d+)\.(\d+)$/i);
    return match ? match.slice(1).map(Number) : null;
  };
  const current = parseVersion(currentText);
  if (!current || !notice) return;

  async function checkForUpdate() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let release;
    try {
      const response = await fetch('https://api.github.com/repos/MrK235/RohrRunner/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) return;
      release = await response.json();
    } catch { return; }
    finally { clearTimeout(timeout); }

    if (!release || release.draft || release.prerelease) return;
    const latest = parseVersion(release.tag_name);
    if (!latest) return;
    const difference = latest.findIndex((part, index) => part !== current[index]);
    if (difference < 0 || latest[difference] < current[difference]) return;
    const version = latest.join('.');
    notice.querySelector('[data-update-version]').textContent = version;
    const link = notice.querySelector('[data-update-link]');
    link.href = `https://github.com/MrK235/RohrRunner/releases/tag/v${version}`;
    link.onclick = async event => {
      const invoke = window.__TAURI__?.core?.invoke;
      if (typeof invoke !== 'function') return;
      event.preventDefault();
      try { await invoke('open_release_page', { version }); }
      catch (error) { console.error('Release-Seite konnte nicht geöffnet werden.', error); }
    };
    notice.hidden = false;
    notice.querySelector('[data-update-dismiss]').onclick = () => {
      notice.hidden = true;
    };
  }
  checkForUpdate();
})();
