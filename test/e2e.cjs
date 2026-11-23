// Walks the built page in a headless Chrome: what the display says for each state of the two
// networks (answers are stood in, so no state has to be waited for), the page without JavaScript,
// its widths, its pictures (that they play when they come into view, end on their last frame and
// stay still for a reader who asked for less motion), the links inside it and, when the build has
// the demo, the way there and back. Writes a screenshot of every state.
//
//   node test/e2e.cjs [--dir dist] [--out e2e-out] [--url http://…] [--only name,name]
//
// Without --url it serves --dir itself (build it first: node build.mjs). `live` asks the real
// networks (two public reads). Needs the `playwright` package and a Chrome it can drive
// (NODE_PATH pointing at an installed one, --chrome for a browser of your own).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const opt = {};
for (let i = 2; i < process.argv.length; i += 2) opt[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const dir = path.resolve(opt.dir || path.join(__dirname, '../dist'));
const out = path.resolve(opt.out || path.join(__dirname, '../e2e-out'));
const only = opt.only ? opt.only.split(',') : null;
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const RPC = '**://soroban-testnet.stellar.org/**';
const HORIZON = '**://horizon.stellar.org/**';
const BEFORE_VOTE = new Date('2026-11-17T14:00:00Z');
const AFTER_VOTE = new Date('2026-11-24T09:00:00Z');
// The day the page's own statuses were checked, as the page prints it ("17 Nov 2026").
const content = JSON.parse(fs.readFileSync(path.join(__dirname, '../content.json'), 'utf8'));
const CHECKED = new Date(content.checked + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const says = (text) => new RegExp(text + CHECKED, 'i');

let failures = 0;
function check(name, condition, detail) {
  if (!condition) failures++;
  console.log((condition ? '  ok   ' : '  FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
}

async function serve() {
  if (opt.url) return { url: opt.url, stop: () => {} };
  const port = 8100 + Math.floor(Math.random() * 800);
  const server = spawn(process.execPath, [path.join(__dirname, '../serve.mjs'), dir, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('exit', () => reject(new Error('the server did not start')));
  });
  return { url: `http://127.0.0.1:${port}/`, stop: () => server.kill() };
}

const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const testnetSays = (protocolVersion) => async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' } });
  return route.fulfill(json({ jsonrpc: '2.0', id: 1, result: { id: 'x', protocolVersion, sequence: 5780000 } }));
};
const mainnetSays = (current_protocol_version) => (route) => route.fulfill(json({ current_protocol_version, core_supported_protocol_version: 30, history_latest_ledger: 65527000 }));
const down = (route) => route.abort('connectionrefused');

const text = (page, selector) => page.locator(selector).innerText();
const led = (page, selector) => page.locator(selector).getAttribute('class');
const settled = (page) => page.waitForFunction(() => document.getElementById('live-text').textContent.indexOf('Statuses as of') !== 0, null, { timeout: 20000 });

// Each state: what the networks answer, the day it is, and what the display must then say.
const STATES = [
  {
    name: 'before-the-vote',
    testnet: testnetSays(30), mainnet: mainnetSays(29), now: BEFORE_VOTE,
    expect: { testnet: ['led on', /on, protocol 30/i], mainnet: ['led due', /vote on 23 nov/i], live: ['led on', /read from the network at \d\d:\d\d utc/i], dock: /ledger 5780000/i },
  },
  {
    name: 'activated',
    testnet: testnetSays(30), mainnet: mainnetSays(30), now: AFTER_VOTE,
    expect: { testnet: ['led on', /on, protocol 30/i], mainnet: ['led on', /on, protocol 30/i], live: ['led on', /read from the network/i], dock: /ledger 5780000/i },
  },
  {
    name: 'vote-passed-not-active',
    testnet: testnetSays(30), mainnet: mainnetSays(29), now: AFTER_VOTE,
    expect: { testnet: ['led on', /on, protocol 30/i], mainnet: ['led due', /not active yet/i], live: ['led on', /read from the network/i], dock: /ledger 5780000/i },
  },
  {
    name: 'mainnet-not-reached',
    testnet: testnetSays(30), mainnet: down, now: BEFORE_VOTE,
    expect: { testnet: ['led on', /on, protocol 30/i], mainnet: ['led', /vote on 23 nov/i], live: ['led due', says('mainnet not reached: its status is as of ')], dock: /ledger 5780000/i },
  },
  {
    name: 'offline',
    testnet: down, mainnet: down, now: BEFORE_VOTE,
    expect: { testnet: ['led', /on, protocol 30/i], mainnet: ['led', /vote on 23 nov/i], live: ['led', says('network not reached: statuses as of ')], dock: /ready/i },
  },
];

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const site = await serve();
  const browser = await chromium.launch(opt.chrome ? { executablePath: opt.chrome } : {});
  const wanted = (name) => !only || only.includes(name);
  try {
    for (const state of STATES) {
      if (!wanted(state.name)) continue;
      console.log(state.name);
      const context = await browser.newContext(PHONE);
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text()) && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.clock.install({ time: state.now });
      await page.route(RPC, state.testnet);
      await page.route(HORIZON, state.mainnet);
      await page.goto(site.url);
      await settled(page);
      const e = state.expect;
      check('testnet light', (await led(page, '#stat-testnet .led')) === e.testnet[0], await led(page, '#stat-testnet .led'));
      check('testnet line', e.testnet[1].test(await text(page, '#stat-testnet .v')), await text(page, '#stat-testnet .v'));
      check('mainnet light', (await led(page, '#stat-mainnet .led')) === e.mainnet[0], await led(page, '#stat-mainnet .led'));
      check('mainnet line', e.mainnet[1].test(await text(page, '#stat-mainnet .v')), await text(page, '#stat-mainnet .v'));
      check('where the reading comes from', (await led(page, '#live-led')) === e.live[0] && e.live[1].test(await text(page, '#live-text')), await text(page, '#live-text'));
      check("the printer's display", e.dock.test(await text(page, '#vfd-ledger')), await text(page, '#vfd-ledger'));
      check('no errors on the page', errors.length === 0, errors.join(' | ').slice(0, 200));
      await page.waitForTimeout(1400); // the display has finished lighting up
      await page.screenshot({ path: path.join(out, state.name + '.png') });
      await context.close();
    }

    if (wanted('no-javascript')) {
      console.log('no-javascript');
      const context = await browser.newContext({ ...PHONE, javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(site.url);
      check('the plan is there', /ml-dsa in contracts/i.test(await text(page, '#board')));
      check('with the statuses it was built with', /vote on 23 nov/i.test(await text(page, '#stat-mainnet')) && says('statuses as of ').test(await text(page, '#live-text')));
      check('and the lists', (await page.locator('.q').count()) === 3 && (await page.locator('.work').count()) >= 5 && (await page.locator('.answers details').count()) >= 4);
      check('in four bands, with the pictures drawn finished', (await page.locator('section.band').count()) === 4 && (await page.locator('#journey .stamp').isVisible()) && (await page.locator('#journey .chip').isVisible()) && !(await page.locator('#journey .again').isVisible()));
      check('the long text is folded', (await page.locator('details[open]').count()) === 0 && !(await page.locator('.source-group').first().isVisible()));
      await page.locator('#sources > summary').click();
      await page.waitForTimeout(600); // a fold takes a moment to open
      check('a fold opens without JavaScript', await page.locator('.source-group').first().isVisible());
      check('and the way to the demo', (await page.locator('a.key').getAttribute('href')) === 'demo/');
      await page.screenshot({ path: path.join(out, 'no-javascript.png'), fullPage: true });
      await context.close();
    }

    if (wanted('widths')) {
      console.log('widths');
      for (const [width, height, columns] of [[320, 640, 1], [390, 844, 1], [800, 1000, 2], [1024, 768, 2], [1180, 800, 3], [1440, 900, 3], [1920, 1080, 3]]) {
        // measured with the pictures on their last frame
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.route(RPC, testnetSays(30));
        await page.route(HORIZON, mainnetSays(29));
        await page.goto(site.url);
        await page.evaluate(() => document.fonts.ready);
        // every fold open, so everything on the page is measured
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => {
          const groups = [...document.querySelectorAll('.source-group')];
          const lefts = new Set(groups.map((s) => Math.round(s.getBoundingClientRect().left)));
          const edge = document.querySelector('main').getBoundingClientRect().right + 1;
          const overflow = [...document.querySelectorAll('.glass *, .band *, .mast *')].filter((el) => el.getBoundingClientRect().right > edge).map((el) => el.className || el.tagName);
          const wrapped = [...document.querySelectorAll('.stage-head .t, .figures dt, .figures dd')].filter((el) => el.getClientRects().length > 1 || el.offsetHeight > 1.9 * parseFloat(getComputedStyle(el).fontSize) * 1.4).map((el) => el.textContent);
          return { page: document.documentElement.scrollWidth - innerWidth, columns: lefts.size, overflow, wrapped, fixed: getComputedStyle(document.getElementById('printer')).position };
        });
        check(width + ' px: nothing wider than the screen', m.page <= 0, 'by ' + m.page);
        check(width + ' px: ' + columns + ' column' + (columns > 1 ? 's' : '') + ' of sources', m.columns === columns, String(m.columns));
        check(width + ' px: nothing sticks out and the short lines stay on one line', m.overflow.length === 0 && m.wrapped.length === 0, m.overflow.concat(m.wrapped).join(', '));
        check(width + ' px: the printer ' + (columns === 3 ? 'stands on the page' : 'stays at the bottom'), m.fixed === (columns === 3 ? 'static' : 'fixed'), m.fixed);
        await page.waitForTimeout(1400);
        await page.screenshot({ path: path.join(out, 'width-' + width + '.png'), fullPage: true });
        await context.close();
      }
    }

    if (wanted('pictures')) {
      console.log('pictures');
      const running = (page) => page.evaluate(() => document.getElementById('journey').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length);
      const context = await browser.newContext(PHONE);
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route(RPC, testnetSays(30));
      await page.route(HORIZON, mainnetSays(29));
      await page.goto(site.url);
      await settled(page);
      check('below the fold, the picture waits at its first frame', (await page.locator('html.motion').count()) === 1 && (await page.locator('#journey.play').count()) === 0 && (await page.evaluate(() => getComputedStyle(document.querySelector('#journey .stamp')).opacity)) === '0');
      await page.evaluate(() => document.getElementById('journey').scrollIntoView({ block: 'center' }));
      const played = await page.waitForFunction(() => document.getElementById('journey').classList.contains('play'), null, { timeout: 5000 }).then(() => true, () => false);
      check('it plays when it comes into view', played && (await running(page)) > 0);
      await page.waitForTimeout(2300);
      await page.screenshot({ path: path.join(out, 'picture-midway.png') });
      await page.waitForTimeout(3200);
      const end = await page.evaluate(() => ({
        share: document.querySelector('#journey .pct').textContent,
        stamp: getComputedStyle(document.querySelector('#journey .stamp')).opacity,
        again: getComputedStyle(document.querySelector('#journey .again')).opacity,
      }));
      check('and ends on its last frame', end.share === String(content.line.scene.chain.share) && end.stamp === '1' && end.again === '1' && (await running(page)) === 0, JSON.stringify(end));
      await page.screenshot({ path: path.join(out, 'picture-end.png') });
      await page.locator('#journey .again').click();
      check('it can be asked for again', (await running(page)) > 0);
      await page.evaluate(() => document.getElementById('open-proofs').scrollIntoView({ block: 'center' }));
      const small = await page.waitForFunction(() => document.getElementById('open-proofs').classList.contains('play'), null, { timeout: 5000 }).then(() => true, () => false);
      check('the small pictures play in their turn', small);
      const lamp = () => page.evaluate(() => getComputedStyle(document.querySelector('#work-verifier .led')).boxShadow);
      const dark = await lamp();
      await page.evaluate(() => document.getElementById('work-verifier').scrollIntoView({ block: 'center' }));
      const lit = await page.waitForFunction(() => document.getElementById('work-verifier').classList.contains('play'), null, { timeout: 5000 }).then(() => true, () => false);
      await page.waitForTimeout(900);
      check('a card of the list lights its lamp when it comes into view', lit && dark === 'none' && (await lamp()) !== 'none', dark + ' -> ' + (await lamp()));
      check('no errors, the site policy included', errors.length === 0, errors.join(' | ').slice(0, 300));
      await context.close();

      const calm = await browser.newContext({ ...PHONE, reducedMotion: 'reduce' });
      const still = await calm.newPage();
      await still.route(RPC, testnetSays(30));
      await still.route(HORIZON, mainnetSays(29));
      await still.goto(site.url);
      await settled(still);
      await still.evaluate(() => document.getElementById('journey').scrollIntoView({ block: 'center' }));
      await still.waitForTimeout(600);
      const quiet = await still.evaluate(() => ({
        motion: document.documentElement.classList.contains('motion'),
        stamp: getComputedStyle(document.querySelector('#journey .stamp')).opacity,
        moving: document.getAnimations().filter((a) => a.playState === 'running').length,
        again: document.querySelector('#journey .again').hidden,
      }));
      check('a reader who asked for less motion gets the pictures finished and still', !quiet.motion && quiet.stamp === '1' && quiet.moving === 0 && quiet.again, JSON.stringify(quiet));
      await calm.close();
    }

    if (wanted('inside-links')) {
      console.log('inside-links');
      const context = await browser.newContext(PHONE);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route(RPC, testnetSays(30));
      await page.route(HORIZON, mainnetSays(29));
      await page.goto(site.url);
      await page.locator('#open-proofs a[href="#work-phone"]').click();
      await page.waitForTimeout(900);
      check('a question leads to the work that tried it', (await page.locator('#work-phone:target').count()) === 1 && (await page.locator('#work-phone').isVisible()) && (await page.evaluate(() => { const r = document.getElementById('work-phone').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; })));
      await page.goto(site.url + '#answers');
      await page.waitForTimeout(700);
      check('an address that points at something folded opens it', (await page.locator('#answers[open]').count()) === 1 && (await page.locator('#answers .answers summary').first().isVisible()));
      // an address that is not well formed points nowhere, and the page works all the same
      await page.goto('about:blank');
      await page.goto(site.url + '#%E0%A4%A');
      const read = await settled(page).then(() => true, () => false);
      check('a broken address does not stop the page', read && /read from the network at/i.test(await text(page, '#live-text')), await text(page, '#live-text'));
      const add = page.locator('#add .links a');
      check('the list says where it is kept', (await add.count()) === 1 && /^https:\/\/github\.com\//.test(await add.getAttribute('href')), (await add.count()) ? await add.getAttribute('href') : 'no link');
      check('no errors on the way', errors.length === 0, errors.join(' | ').slice(0, 200));
      await context.close();
    }

    if (wanted('to-the-demo')) {
      console.log('to-the-demo');
      // The demo is a page of its own, built elsewhere: a build of this page alone does not have it.
      const there = await fetch(new URL('demo/', site.url)).then((r) => r.ok, () => false);
      if (!there) console.log('  skip   this build has no demo under demo/');
      else {
        const context = await browser.newContext(PHONE);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(site.url);
        await page.locator('a.key').click();
        await page.waitForURL(/\/demo\/$/);
        await page.waitForFunction(() => !document.getElementById('hub-line').hidden, null, { timeout: 20000 });
        check('the demo opens', /from your phone to\s+stellar/i.test(await text(page, 'h1')));
        check('its first line leads back', /quantum on stellar \/ demo/i.test(await text(page, '#hub-line')));
        await page.locator('#hub-line a').click();
        await page.waitForURL((url) => url.pathname === new URL(site.url).pathname);
        check('and back at the page', /quantum on stellar/i.test(await text(page, 'h1')));
        // The demo's other pages that the list links to, the same way.
        for (const card of await page.$$eval('.work a[href^="demo/"]', (links) => links.map((a) => a.getAttribute('href')).filter((h) => h !== 'demo/'))) {
          await page.locator(`.work a[href="${card}"]`).click();
          await page.waitForURL((url) => url.pathname.endsWith('/' + card));
          await page.waitForFunction(() => !document.getElementById('hub-line').hidden, null, { timeout: 20000 });
          check(card + ' opens from its card', (await text(page, 'h1')).length > 0 && /quantum on stellar \/ demo \//i.test(await text(page, '#hub-line')), await text(page, 'h1'));
          await page.locator('#hub-line a').click();
          await page.waitForURL((url) => url.pathname === new URL(site.url).pathname);
        }
        check('no errors on the way', errors.length === 0, errors.join(' | ').slice(0, 200));
        await context.close();
      }
    }

    if (wanted('live')) {
      console.log('live');
      const context = await browser.newContext(PHONE);
      const page = await context.newPage();
      const errors = [];
      const elsewhere = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('request', (r) => {
        const host = new URL(r.url()).host;
        if (!['soroban-testnet.stellar.org', 'horizon.stellar.org', new URL(site.url).host].includes(host)) elsewhere.push(host);
      });
      await page.goto(site.url);
      await settled(page);
      check('both networks answer', /read from the network at/i.test(await text(page, '#live-text')), await text(page, '#live-text'));
      check('testnet runs the upgrade', /on, protocol \d+/i.test(await text(page, '#stat-testnet .v')), await text(page, '#stat-testnet .v'));
      check('mainnet says where it stands', (await text(page, '#stat-mainnet .v')).length > 0, await text(page, '#stat-mainnet .v'));
      check('the printer shows the ledger', /ledger \d{6,}/i.test(await text(page, '#vfd-ledger')), await text(page, '#vfd-ledger'));
      check('nothing asked of any other server', elsewhere.length === 0, elsewhere.join(', '));
      check('no errors, the site policy included', errors.length === 0, errors.join(' | ').slice(0, 300));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(out, 'live.png') });
      await context.close();
    }
  } finally {
    await browser.close();
    site.stop();
  }
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
