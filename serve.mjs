// Serves a built copy of the page from this machine, with the headers its host would send (the
// _headers file of the build), so what is tried here is what is published. Plain Node, no
// dependencies.
//
//   node serve.mjs [dir=dist] [port=8080] [host=127.0.0.1]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir = join(dirname(fileURLToPath(import.meta.url)), 'dist'), port = '8080', host = '127.0.0.1'] = process.argv.slice(2);
const root = resolve(dir);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

// The _headers format: a path (with * for "anything from here on"), then indented "Name: value"
// lines. Read on every request, so a rebuild shows without restarting.
function rules() {
  const list = [];
  if (!existsSync(join(root, '_headers'))) return list;
  for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) list.push({ path: line.trim(), headers: [] });
    else if (list.length) {
      const at = line.indexOf(':');
      list[list.length - 1].headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
    }
  }
  return list;
}
const matches = (rule, path) => (rule.endsWith('*') ? path.startsWith(rule.slice(0, -1)) : rule === path);

createServer((request, response) => {
  let path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  // As static hosts do: a page is also served at its address without .html.
  if (!extname(path) && existsSync(normalize(join(root, path + '.html')))) path += '.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || path === '/_headers' || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    return;
  }
  const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate' };
  for (const rule of rules()) if (matches(rule.path, path)) for (const [name, value] of rule.headers) headers[name] = value;
  response.writeHead(200, headers).end(readFileSync(file));
}).listen(Number(port), host, () => console.log(`http://${host}:${port}/  (${root})`));
