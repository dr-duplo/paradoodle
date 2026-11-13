// Light and dark theme: follows the system until you pick one with the moon/sun button
// in the transport. The choice is remembered in this browser.

const THEME_KEY = 'groove.theme';
const ICON_MOON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_SUN =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : systemDark.matches;
};
function updateThemeBtn() {
  const b = $('themeBtn'),
    dark = isDark();
  b.innerHTML = dark ? ICON_SUN : ICON_MOON;
  b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}
function applyTheme(t) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  updateThemeBtn();
}
$('themeBtn').onclick = () => {
  const t = isDark() ? 'light' : 'dark';
  store.set(THEME_KEY, t);
  applyTheme(t);
};
systemDark.addEventListener('change', updateThemeBtn);
applyTheme(store.get(THEME_KEY));
