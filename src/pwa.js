(() => {
  if ('__TAURI_INTERNALS__' in window || !('serviceWorker' in navigator) || location.protocol === 'file:') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
      console.warn('RohrRunner: PWA-Service-Worker konnte nicht registriert werden.', error);
    });
  });
})();
