// Builds dist/index.html: one minified file with the styles and all scripts inlined.
// The script order is taken from the <script src="js/..."> tags in index.html.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { transform } from 'esbuild';
import { createHash } from 'node:crypto';

const html = await readFile('index.html', 'utf8');

const css = await readFile('styles.css', 'utf8');
const { code: cssMin } = await transform(css, { loader: 'css', minify: true });

const scriptTag = /<script src="(js\/[^"]+)"><\/script>\n?/g;
const files = [...html.matchAll(scriptTag)].map((m) => m[1]);
if (!files.length) throw new Error('No <script src="js/..."> tags found in index.html');
const source = (await Promise.all(files.map((f) => readFile(f, 'utf8')))).join(';\n');
const { code: jsMin } = await transform(source, { loader: 'js', minify: true, format: 'iife' });
// The script goes into the page as it is, so it must not end its own <script> element early.
const inlineJs = jsMin.trim();
if (/<\/script/i.test(inlineJs)) throw new Error('The minified script contains "</script"');

const styleTag = /<link rel="stylesheet" href="styles\.css"\s*\/?>/;
if (!styleTag.test(html))
  throw new Error('No <link rel="stylesheet" href="styles.css"> found in index.html');

let page = html
  .replace(styleTag, () => `<style>${cssMin.trim()}</style>`)
  .replace(scriptTag, '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join('\n');
// The script goes in after the lines are trimmed, so it reaches the page exactly as minified.
const scriptEl = `<script>${inlineJs}</script>`;
page = page.includes('</body>')
  ? page.replace('</body>', () => `${scriptEl}\n</body>`)
  : `${page}\n${scriptEl}`;

if (/href="styles\.css"|src="js\//.test(page))
  throw new Error('dist/index.html still links to source files');

// Content Security Policy: the page may run only its own inline script (pinned by hash) and the
// CDN libraries listed in js/basics.js (LIBS), load fonts from Google Fonts, and nothing else.
// The hash is taken from the script the build put in, not from parsing the page; the page must
// hold no other script element, in any letter case.
const scripts = page.match(/<script\b/gi) || [];
if (scripts.length !== 1) throw new Error(`Expected one script element, found ${scripts.length}`);
const scriptHash = createHash('sha256').update(inlineJs).digest('base64');
const libs = [
  ...(await readFile('js/basics.js', 'utf8')).matchAll(/src: '(https:\/\/[^']+)'/g),
].map((m) => m[1]);
if (!libs.length) throw new Error('No CDN libraries found in js/basics.js');
const csp = [
  "default-src 'none'",
  `script-src 'sha256-${scriptHash}' ${libs.join(' ')}`,
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
const charset = '<meta charset="utf-8" />';
if (!page.includes(charset)) throw new Error('No charset meta found in index.html');
page = page.replace(
  charset,
  () => `${charset}\n<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
);

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', page + '\n');

// Installable app: the manifest, the icons and the service worker. The worker's VERSION is the
// page's hash, so every deploy replaces the offline copy of the app.
const version = createHash('sha256').update(page).digest('hex').slice(0, 12);
const sw = await readFile('sw.js', 'utf8');
if (!sw.includes("const VERSION = 'dev';")) throw new Error('sw.js: VERSION placeholder missing');
await writeFile(
  'dist/sw.js',
  sw.replace("const VERSION = 'dev';", `const VERSION = '${version}';`),
);
await cp('manifest.webmanifest', 'dist/manifest.webmanifest');
await cp('icons', 'dist/icons', { recursive: true });
console.log(`dist/index.html: ${(page.length / 1024).toFixed(0)} KB from ${files.length} scripts`);
