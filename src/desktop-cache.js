(() => {
  // Tauri ships its own files. A service worker from an older desktop version
  // can otherwise keep serving the old UI after the installer replaces the exe.
  if (!('__TAURI_INTERNALS__' in window) || !('serviceWorker' in navigator)) return;

  const controlled = Boolean(navigator.serviceWorker.controller);
  (async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let removed = false;
    for (const registration of registrations) {
      if (!registration.scope.startsWith(location.origin + '/')) continue;
      removed = await registration.unregister() || removed;
    }
    if ('caches' in window) {
      for (const name of await caches.keys()) {
        if (!name.startsWith('rohrrunner-pwa-')) continue;
        removed = await caches.delete(name) || removed;
      }
    }
    if (controlled && removed) location.reload();
  })().catch(error => console.warn('RohrRunner: Desktop-Cache konnte nicht bereinigt werden.', error));
})();
