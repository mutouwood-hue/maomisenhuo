import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('original/game.html', root), 'utf8');
await mkdir(new URL('www/', root), { recursive: true });
// 现有游戏和第三方引擎保持原样；仅把内联脚本拆成同序本地文件，便于核验没有遗漏。
let sequence = 0;
const scriptFiles = [];
const parts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
let html = source;
for (const match of parts.reverse()) {
  const index = parts.length - sequence++;
  const filename = `game-${String(index).padStart(2, '0')}.js`;
  const attributes = match[1];
  if (/\bsrc\s*=/.test(attributes)) throw new Error('Unexpected external script');
  new vm.Script(match[2], { filename });
  await writeFile(new URL(`www/${filename}`, root), match[2]);
  scriptFiles.unshift(filename);
  const replacement = `<script${attributes} src="${filename}"></script>`;
  html = html.slice(0, match.index) + replacement + html.slice(match.index + match[0].length);
}
const panel = await readFile(new URL('src/ble/panel.html', root), 'utf8');
html = html.replace('</head>', '<script src="native-bridge.js"></script><link rel="stylesheet" href="ble-local.css"><!-- companion-prelude:start --><script src="companion-prelude.js"></script><!-- companion-prelude:end --></head>');
await writeFile(new URL('www/companion-prelude.js', root), await readFile(new URL('src/companion/prelude.js', root), 'utf8'));
const adaptSafeArea = css => css.replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, 'var(--safe-area-inset-$1, env(safe-area-inset-$1))');
// Capacitor 已提供 WindowInsets CSS 变量；Android WebView 的 env() 可能仍为零。
// 只改生成资源里的安全区接线，原作快照、脚本和业务逻辑保持不变。
html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, css, close) => open + adaptSafeArea(css) + close);
const mobileAssets = ['room-world.css', 'life-panels.css', 'room-world.js', 'life-panels.js'];
for (const filename of mobileAssets) {
  const contents = await readFile(new URL(`src/mobile/${filename}`, root), 'utf8');
  await writeFile(new URL(`www/mobile-${filename}`, root), filename.endsWith('.css') ? adaptSafeArea(contents) : contents);
}
const mobileWiring = '<!-- mobile-adaptation:start -->' + mobileAssets.map(filename => filename.endsWith('.css')
  ? `<link rel="stylesheet" href="mobile-${filename}">`
  : `<script src="mobile-${filename}"></script>`).join('') + '<!-- mobile-adaptation:end -->';
// 原作在 body 中还有后置样式；适配层必须在所有原始规则之后，避免被再次覆盖。
html = html.replace('</body>', `<!-- ble-local-panel:start -->${panel}<!-- ble-local-panel:end --><script src="ble-local.js"></script>${mobileWiring}<!-- companion-adaptation:start --><link rel="stylesheet" href="companion.css"><script src="companion.js"></script><!-- companion-adaptation:end --></body>`);
  await writeFile(new URL('www/companion.css', root), (await readFile(new URL('src/companion/panel.css', root), 'utf8')) + '\n' + (await readFile(new URL('src/social/panel.css', root), 'utf8')));
await build({ entryPoints: [fileURLToPath(new URL('src/companion/main.js', root))], bundle: true, outfile: fileURLToPath(new URL('www/companion.js', root)), format: 'iife', platform: 'browser', target: 'es2022' });
await writeFile(new URL('www/ble-local.css', root), await readFile(new URL('src/ble/panel.css', root), 'utf8'));
await build({ entryPoints: [fileURLToPath(new URL('src/ble/panel.js', root))], bundle: true, outfile: fileURLToPath(new URL('www/ble-local.js', root)), format: 'iife', platform: 'browser', target: 'es2022' });
await build({ entryPoints: [fileURLToPath(new URL('src/native/bridge.js', root))], bundle: true, outfile: fileURLToPath(new URL('www/native-bridge.js', root)), format: 'iife', platform: 'browser', target: 'es2022' });
await writeFile(new URL('www/index.html', root), html);
await writeFile(new URL('www/build-manifest.json', root), JSON.stringify({ sourceSha256: createHash('sha256').update(source).digest('hex'), scripts: scriptFiles, appVersion: '0.1.0' }, null, 2));
console.log(`Built ${scriptFiles.length} original scripts, native bridge, and offline game HTML.`);
