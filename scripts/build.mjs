// Builds dist/index.html: one minified file with the styles and all scripts inlined.
// The script order is taken from the <script src="js/..."> tags in index.html.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { transform } from 'esbuild';

const html = await readFile('index.html', 'utf8');

const css = await readFile('styles.css', 'utf8');
const { code: cssMin } = await transform(css, { loader: 'css', minify: true });

const scriptTag = /<script src="(js\/[^"]+)"><\/script>\n?/g;
const files = [...html.matchAll(scriptTag)].map((m) => m[1]);
if (!files.length) throw new Error('No <script src="js/..."> tags found in index.html');
const source = (await Promise.all(files.map((f) => readFile(f, 'utf8')))).join(';\n');
const { code: jsMin } = await transform(source, { loader: 'js', minify: true, format: 'iife' });

let page = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>${cssMin.trim()}</style>`)
  .replace(scriptTag, '');
page = page
  .replace('</body>', () => `<script>${jsMin.trim()}</script>\n</body>`)
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join('\n');
if (!page.includes('<script>')) page += `\n<script>${jsMin.trim()}</script>`;

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', page + '\n');
console.log(`dist/index.html: ${(page.length / 1024).toFixed(0)} KB from ${files.length} scripts`);
