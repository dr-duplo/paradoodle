// Starts the app: draws the page, opens a shared loop from the address if
// there is one, and keeps the address up to date.

try {
  renderLegend();
  renderAll();
  setPlayIcon();
} catch (err) {
  console.error(err);
  store.del('groove.current');
  S = normalize(example());
  renderLegend();
  renderAll();
  setPlayIcon();
  appStatus('The last draft could not be opened, so the example groove was loaded instead.');
}
openFromLink();
syncUrl();
addEventListener('pagehide', () => {
  clearTimeout(urlT);
  try {
    history.replaceState(null, '', loopHash(S));
  } catch {}
});
// Installable app: register the offline service worker (not available when opened as a file).
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
  navigator.serviceWorker.register('sw.js').catch(() => {});
