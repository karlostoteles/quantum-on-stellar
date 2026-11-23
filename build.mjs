// Builds the page into dist/: plain HTML written from content.json, with its styles, its script and
// its typefaces next to it. Plain Node, no dependencies.
//
//   node build.mjs                                  the page, into dist/
//   SITE_URL=https://example.org node build.mjs     for the address it will be served at
//   OUT=some/folder node build.mjs                  into another folder
//   DEMO_SITE=some/folder node build.mjs            with a built copy of the demo page under demo/
//
// Try it:   node serve.mjs      (http://127.0.0.1:8080/)
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { render } from './page.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.OUT || join(here, 'dist'));
const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
const content = JSON.parse(readFileSync(join(here, 'content.json'), 'utf8'));

// The key on the page leads to demo/. The demo page is built elsewhere (its code is not in this
// repository): DEMO_SITE names a built copy of it to serve from there. Without one the page is
// built alone, and that one link has nothing behind it.
const demoSite = process.env.DEMO_SITE ? resolve(process.env.DEMO_SITE) : null;

// The folder is cleared before it is written: only one this build made before, and never this one.
const refuse = (why) => {
  console.error(`${out}: ${why}`);
  process.exit(1);
};
if (here === out || here.startsWith(out + sep)) refuse('the page cannot be built over its own sources');
if (existsSync(out) && readdirSync(out).length && !existsSync(join(out, 'hub.css'))) refuse('not empty, and not an earlier build of this page');
if (demoSite && !existsSync(join(demoSite, 'config.json'))) refuse(`${demoSite} is not a built copy of the demo page`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let demoConfig = null;
if (demoSite) {
  cpSync(demoSite, join(out, 'demo'), { recursive: true });
  rmSync(join(out, 'demo/_headers'), { force: true });

  // The demo is told where it lives: the first line of its receipt leads back here.
  const demoConfigPath = join(out, 'demo/config.json');
  demoConfig = JSON.parse(readFileSync(demoConfigPath, 'utf8'));
  demoConfig.hub = { name: content.name, href: '../' };
  writeFileSync(demoConfigPath, JSON.stringify(demoConfig, null, 2) + '\n');
}

writeFileSync(join(out, 'index.html'), render(content, { siteUrl }));
for (const file of ['hub.css', 'hub.js', 'favicon.svg']) copyFileSync(join(here, file), join(out, file));
cpSync(join(here, 'fonts'), join(out, 'fonts'), { recursive: true });
if (existsSync(join(here, 'og.png'))) copyFileSync(join(here, 'og.png'), join(out, 'og.png'));

// For search engines, once the site has an address: what may be read and where the pages are.
if (siteUrl) {
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  // The demo's pages: its index, and any other page it has, at its address without .html.
  const demoPages = demoSite
    ? ['', ...readdirSync(demoSite).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => f.slice(0, -'.html'.length)).sort()]
    : [];
  const pages = [`<url><loc>${siteUrl}/</loc><lastmod>${content.checked}</lastmod></url>`, ...demoPages.map((p) => `<url><loc>${siteUrl}/demo/${p}</loc></url>`)];
  writeFileSync(
    join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${pages.join('\n  ')}\n</urlset>\n`,
  );
}

// One policy for the whole site (the _headers file, as static hosts read it). Nothing is loaded
// from anywhere else, and the pages talk to Stellar's public servers only: the testnet RPC and
// mainnet's Horizon for the display, and the testnet RPC for the demo. The demo runs WebAssembly in
// a worker; the page alone does not, and is not allowed to.
const servers = [...new Set([...(demoConfig ? [demoConfig.rpcUrl] : []), content.networks.testnetRpc, content.networks.mainnetHorizon].map((url) => new URL(url).origin))];
const policy = [
  "default-src 'none'",
  demoSite ? "script-src 'self' 'wasm-unsafe-eval'" : "script-src 'self'",
  ...(demoSite ? ["worker-src 'self'"] : []),
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${servers.join(' ')}`,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');
writeFileSync(
  join(out, '_headers'),
  [
    '/*',
    `  Content-Security-Policy: ${policy}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '  Cross-Origin-Opener-Policy: same-origin',
    '/fonts/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    ...(demoSite ? ['/demo/fonts/*', '  Cache-Control: public, max-age=31536000, immutable'] : []),
    '',
  ].join('\n'),
);

let page = 0;
const list = (dir, prefix = '') => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      list(path, prefix + name + '/');
      continue;
    }
    const bytes = readFileSync(path);
    const gz = /\.(woff2|png|wasm)$/.test(name) ? bytes.length : gzipSync(bytes).length;
    // what a visitor's browser fetches: not the headers file, nor what only crawlers and posts ask for
    if (!prefix && !/^(_headers|og\.png|robots\.txt|sitemap\.xml)$/.test(name)) page += gz;
    console.log(`${(prefix + name).padEnd(40)} ${String(bytes.length).padStart(8)} B`);
  }
};
list(out);
const fontFiles = readdirSync(join(out, 'fonts')).filter((name) => name.endsWith('.woff2'));
const fonts = fontFiles.reduce((n, name) => n + statSync(join(out, 'fonts', name)).size, 0);
console.log(`a visit to the page downloads about ${Math.round((page + fonts) / 1000)} KB (gzip), its ${fontFiles.length} font files included`);
console.log(`${out}: ${content.name}, ${siteUrl || 'no site address'}, ${demoSite ? 'with the demo under demo/' : 'the page alone'}`);
