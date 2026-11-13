// Light and dark theme: dark at first; the theme button in the transport cycles
// dark → light → auto (follows the system) → dark. The choice is remembered in this browser,
// and the icon shows the current mode. index.html starts with data-theme="dark", so the page
// doesn't show the light theme before this script runs.

const THEME_KEY = 'groove.theme';
const ICON_MOON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_SUN =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_AUTO =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>';
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const themeMode = () => document.documentElement.dataset.theme || 'auto';
const THEME_CYCLE = { dark: 'light', light: 'auto', auto: 'dark' };
const systemTheme = () => (systemDark.matches ? 'dark' : 'light');
const nextThemeMode = () => THEME_CYCLE[themeMode()];
const THEME_NAMES = {
  auto: () => `Auto theme (${systemTheme()}, like your system)`,
  light: () => 'Light theme',
  dark: () => 'Dark theme',
};
function themeTip() {
  const n = nextThemeMode();
  return `${THEME_NAMES[themeMode()]()} · switch to ${n === 'auto' ? 'auto' : n}`;
}
function updateThemeBtn() {
  const b = $('themeBtn'),
    m = themeMode();
  b.innerHTML = { auto: ICON_AUTO, light: ICON_SUN, dark: ICON_MOON }[m];
  b.setAttribute('aria-label', themeTip());
}
// The browser bar (and the installed app's title bar) takes the page's background colour.
function syncThemeColor() {
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
}
function applyTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
  updateThemeBtn();
  syncThemeColor();
}
$('themeBtn').onclick = () => {
  const t = nextThemeMode();
  store.set(THEME_KEY, t);
  applyTheme(t);
};
systemDark.addEventListener('change', () => {
  updateThemeBtn();
  syncThemeColor();
});
applyTheme(store.get(THEME_KEY));
