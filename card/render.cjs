// Renders the preview card (card/og.html, 1200 by 630) to og.png in a headless Chrome. Run it
// again whenever the card changes; the build copies og.png next to the page.
//
//   node card/render.cjs [card/og.html] [og.png]
//
// Needs the `playwright` package (NODE_PATH pointing at an installed one), like test/e2e.cjs.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

(async () => {
  const html = path.resolve(process.argv[2] || path.join(__dirname, 'og.html'));
  const out = path.resolve(process.argv[3] || path.join(__dirname, '../og.png'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(html).href);
    await page.evaluate(() => document.fonts.ready);
    const missing = await page.evaluate(() => [...document.fonts].filter((font) => font.status !== 'loaded').map((font) => font.family));
    if (missing.length) throw new Error('typefaces not loaded: ' + missing.join(', '));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(out);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
