// Builds dist/index.html: one minified file with the styles and all scripts inlined.
// The script order is taken from the <script src="js/..."> tags in index.html.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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

const styleTag = /<link rel="stylesheet" href="styles\.css"\s*\/?>/;
if (!styleTag.test(html))
  throw new Error('No <link rel="stylesheet" href="styles.css"> found in index.html');

let page = html.replace(styleTag, () => `<style>${cssMin.trim()}</style>`).replace(scriptTag, '');
page = page
  .replace('</body>', () => `<script>${jsMin.trim()}</script>\n</body>`)
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join('\n');
if (!page.includes('<script>')) page += `\n<script>${jsMin.trim()}</script>`;

if (/href="styles\.css"|src="js\//.test(page))
  throw new Error('dist/index.html still links to source files');

// Content Security Policy: the page may run only its own inline script (pinned by hash) and the
// CDN libraries listed in js/basics.js (LIBS), load fonts from Google Fonts, and nothing else.
const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (inline.length !== 1) throw new Error(`Expected one inline script, found ${inline.length}`);
const scriptHash = createHash('sha256').update(inline[0]).digest('base64');
const libs = [
  ...(await readFile('js/basics.js', 'utf8')).matchAll(/src: '(https:\/\/[^']+)'/g),
].map((m) => m[1]);
if (!libs.length) throw new Error('No CDN libraries found in js/basics.js');
const csp = [
  "default-src 'none'",
  `script-src 'sha256-${scriptHash}' ${libs.join(' ')}`,
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  'img-src data: blob:',
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
console.log(`dist/index.html: ${(page.length / 1024).toFixed(0)} KB from ${files.length} scripts`);
