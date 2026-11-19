// The content and the page written from it: what has to hold before it is built. A new entry in
// the list is checked here.
//   node --test test/hub.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dayOf, day, render } from '../page.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(readFileSync(join(here, '../content.json'), 'utf8'));
const page = render(content);
const COLS = 32; // a line of the display is 32 characters wide, and the page is measured in them

test('dates read as the page prints them', () => {
  assert.equal(day('2026-06-09'), '9 Jun 2026');
  assert.equal(dayOf('2026-11-23T17:00:00Z'), '23 Nov');
});

test('the display: three stages that fit a phone, one of them read from the network', () => {
  const { stages, upgrade } = content.plan;
  assert.equal(stages.length, 3);
  assert.equal(stages.filter((s) => s.live).length, 1);
  for (const stage of stages) {
    // number, title and date share one line of the display
    assert.ok(stage.title.length + stage.when.length <= 27, stage.title);
    assert.ok(stage.live || stage.status, stage.title + ': a status');
  }
  assert.ok(Number.isInteger(upgrade.protocol));
  assert.ok(!Number.isNaN(Date.parse(upgrade.mainnetVote)));
});

test('what has been measured fits a line of a phone', () => {
  for (const [label, value] of content.line.figures) assert.ok(label.length + value.length <= COLS - 2, label);
});

test('questions point at work that is listed', () => {
  const ids = new Set(content.work.map((w) => w.id));
  for (const q of content.open) for (const id of q.tried) assert.ok(ids.has(id), q.id + ' -> ' + id);
  assert.equal(ids.size, content.work.length, 'work ids are unique');
});

test('every entry in the list has what the page prints', () => {
  for (const w of content.work) {
    const name = w.id || w.title || 'an entry';
    for (const field of ['id', 'title', 'by', 'area', 'status', 'text', 'caveat']) assert.ok(typeof w[field] === 'string' && w[field].trim(), `${name}: ${field}`);
    assert.match(w.id, /^[a-z0-9-]+$/, `${name}: an id in lower case, digits and hyphens`);
    assert.equal(typeof w.live, 'boolean', `${name}: live is true or false`);
    assert.ok(Array.isArray(w.links) && w.links.length >= 1 && w.links.length <= 3, `${name}: one to three links`);
    for (const l of w.links) assert.ok(l.text && l.href, `${name}: a link has a text and an address`);
    if (w.byUrl) assert.match(w.byUrl, /^https:\/\/[^\s]+$/, `${name}: byUrl`);
  }
  assert.match(content.add.href, /^https:\/\/[^\s]+$/, 'where the list is kept');
});

test('links: https outside, relative inside', () => {
  const links = [
    content.plan.url,
    content.plan.upgrade.url,
    ...content.sources.flatMap((group) => group.items.map((s) => s.href)),
    ...content.work.flatMap((w) => w.links.filter((l) => !l.internal).map((l) => l.href)),
    ...content.line.links.filter((l) => !l.internal).map((l) => l.href),
  ];
  for (const href of links) assert.match(href, /^https:\/\/[^\s]+$/);
  for (const w of content.work) for (const l of w.links) if (l.internal) assert.doesNotMatch(l.href, /^[a-z]+:|^\//);
  for (const url of Object.values(content.networks)) assert.match(url, /^https:\/\//);
});

test('the page says whose it is and whose it is not', () => {
  assert.ok(page.includes(content.independence));
  assert.match(page, /not affiliated with, sponsored or endorsed by the Stellar Development Foundation/);
  assert.match(page, /trademark of the Stellar Development Foundation/);
});

test('the page keeps to the site policy: nothing inline, nothing loaded from elsewhere', () => {
  assert.doesNotMatch(page, /\sstyle="/);
  assert.doesNotMatch(page, /<style/);
  assert.doesNotMatch(page, /\son[a-z]+="/);
  // one script that runs, the page's own; the other is data for search engines and does not run
  for (const [, attrs] of page.matchAll(/<script([^>]*)>/g)) assert.match(attrs, /src="hub\.js"|type="application\/ld\+json"/);
  assert.equal([...page.matchAll(/<script[^>]*src=/g)].length, 1);
  for (const [, href] of page.matchAll(/<link[^>]*href="([^"]+)"/g)) assert.doesNotMatch(href, /^https?:/);
});

test('links that leave open in a new tab without a referrer; links that stay do not', () => {
  for (const [tag] of page.matchAll(/<a [^>]*>/g)) {
    const outside = /href="https:/.test(tag);
    assert.equal(/target="_blank" rel="noopener noreferrer"/.test(tag), outside, tag);
  }
});

test('the board carries what hub.js needs', () => {
  for (const attr of ['data-rpc', 'data-horizon', 'data-protocol', 'data-vote', 'data-checked']) assert.ok(page.includes(attr + '="'), attr);
  for (const id of ['stat-testnet', 'stat-mainnet', 'live-led', 'live-text', 'vfd-ledger', 'printer', 'board']) assert.ok(page.includes('id="' + id + '"'), id);
});

test('with a site address the page carries its preview card', () => {
  const served = render(content, { siteUrl: 'https://example.org' });
  assert.ok(served.includes('<meta property="og:url" content="https://example.org/">'));
  assert.ok(served.includes('<meta property="og:image" content="https://example.org/og.png">'));
  assert.ok(served.includes('<meta property="og:image:alt" content="'));
  assert.ok(!page.includes('og:url'));
  // the picture itself (card/og.html, rendered by card/render.cjs) is the size the page declares
  const png = readFileSync(join(here, '../og.png'));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});

test('what search engines read: a title and a description of the right size, and the short answers', () => {
  assert.ok(content.title.length <= 70, 'title: ' + content.title.length);
  assert.ok(content.metaDescription.length >= 110 && content.metaDescription.length <= 170, 'description: ' + content.metaDescription.length);
  assert.ok(page.includes('<title>' + content.title + '</title>'));
  const [, block] = page.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  const data = JSON.parse(block);
  const faq = data.find((d) => d['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, content.questions.length);
  assert.equal(faq.mainEntity[0].name, content.questions[0].q);
  assert.equal([...page.matchAll(/<h1[ >]/g)].length, 1);
  // every answer is also on the page itself, for people
  for (const item of content.questions) assert.ok(page.includes('<summary>' + item.q.replace(/&/g, '&amp;') + '</summary>'));
});

const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('four bands, each in its own tone; and the page brings its own typefaces', () => {
  const bands = [...page.matchAll(/<section class="band tone-([a-z]+)" id="([a-z]+)"/g)];
  assert.deepEqual(bands.map((b) => b[2]), ['line', 'open', 'work', 'more']);
  assert.equal(new Set(bands.map((b) => b[1])).size, 4, 'no two bands in the same tone');
  const css = readFileSync(join(here, '../hub.css'), 'utf8');
  for (const b of bands) assert.ok(css.includes('.tone-' + b[1] + ' {'), b[1]);
  for (const [, file] of css.matchAll(/url\("(fonts\/[^"]+)"\)/g)) assert.ok(existsSync(join(here, '..', file)), file);
  assert.doesNotMatch(page, /demo\/style\.css/);
});

test('each band says its thing in a few words and keeps the full text folded underneath', () => {
  assert.ok(content.line.headline.length <= 60, 'headline');
  assert.ok(content.line.standfirst.length <= 110, 'standfirst');
  for (const q of content.open) {
    assert.ok(q.short && q.short.length <= 100, q.id + ': a short line');
    assert.ok(page.includes(esc(q.short)) && page.includes(esc(q.text)), q.id + ': the short line and the full text are both on the page');
  }
  for (const p of content.line.text) assert.ok(page.includes(esc(p)));
  // what the prototype is not stays in view: it is not inside the fold
  const fold = page.indexOf('<details class="fold" id="details"');
  assert.ok(fold > 0 && page.indexOf(esc(content.line.caveat)) < fold);
  // nothing is open until it is asked for
  assert.doesNotMatch(page, /<details[^>]* open/);
});

test('the pictures: one for the line of work, one for each open question, and what they show is also said', () => {
  assert.equal([...page.matchAll(/class="scene journey"/g)].length, 1);
  for (const q of content.open) assert.match(page, new RegExp(`id="open-${q.id}">\\s*<svg class="picto picto-${q.id}" viewBox="[^"]+" aria-hidden="true"`), q.id);
  // each card of the list lights its own lamp, so the list can grow longer than a screen
  for (const w of content.work) assert.ok(page.includes(`<li class="work scene" id="work-${w.id}">`), w.id);
  const s = content.line.scene;
  for (const words of [s.device.name, s.proof.name, s.chain.name, s.chain.figures]) assert.ok(page.includes('>' + esc(words) + '<'), words);
  // its figures are the measured ones
  const figures = Object.fromEntries(content.line.figures);
  assert.equal(s.proof.figure, figures['Proof size']);
  assert.equal(s.chain.share + '%', figures['Share of one transaction']);
  assert.ok(s.chain.figures.startsWith(figures['Instructions to verify']));
  // the machines in the picture are decoration: a screen reader gets the captions
  for (const part of ['phone', 'track', 'contract']) assert.ok(page.includes(`<div class="${part}" aria-hidden="true">`), part);
  assert.ok(page.includes('<filter id="ink"'), 'the stamp has its ink');
});
