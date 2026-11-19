// The page, written out from content.json when the site is built: plain HTML that reads without
// JavaScript (and so do search engines). Under the sign, the display and the printer, the page is
// a few bands, one per topic: a headline, one picture that plays once, a line or two, and the full
// text folded underneath. hub.js adds only what changes by itself: the state of the network, and
// the moment each picture plays.
const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const day = (iso) => {
  const d = new Date(iso);
  return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
};
// "23 Nov": the display has room for the day; the hour is in the announcement it links to.
export const dayOf = (iso) => {
  const d = new Date(iso);
  return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
};

const outside = (href) => `href="${esc(href)}" target="_blank" rel="noopener noreferrer"`;
const anchor = (link) => (link.internal ? `<a href="${esc(link.href)}">${esc(link.text)}</a>` : `<a ${outside(link.href)}>${esc(link.text)}</a>`);

const count = (n, one, many) => n + ' ' + (n === 1 ? one : many);
// A headline's count is spelled out: "Three things", "Four works".
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const headline = (pattern, n) => esc(pattern.replace('{n}', WORDS[n] || String(n)));

// The board lights up line by line: each line carries its turn.
function lines() {
  let turn = 0;
  return () => 'lit d' + ++turn;
}

function board(content) {
  const { plan, networks } = content;
  const lit = lines();
  const stages = plan.stages
    .map((stage, i) => {
      const state = stage.live
        ? `<p class="stat ${lit()}" id="stat-testnet"><span class="led"></span><span class="k">Testnet</span><span class="v">on, protocol ${plan.upgrade.protocol}</span></p>
            <p class="stat ${lit()}" id="stat-mainnet"><span class="led"></span><span class="k">Mainnet</span><span class="v">vote on ${esc(dayOf(plan.upgrade.mainnetVote))}</span></p>`
        : `<p class="stat ${lit()}"><span class="led"></span><span class="k">${esc(stage.status)}</span></p>`;
      return `
        <li class="stage${stage.live ? ' now' : ''}">
          <div class="stage-what">
            <p class="stage-head ${lit()}"><span class="n">${i + 1}</span><span class="t">${esc(stage.title)}</span><span class="when">${esc(stage.when)}</span></p>
            <p class="stage-note ${lit()}">${esc(stage.note)}</p>
          </div>
          <div class="stage-state">
            ${state}
          </div>
        </li>`;
    })
    .join('');
  return `
    <section class="board" id="board" aria-labelledby="plan-title"
      data-rpc="${esc(networks.testnetRpc)}" data-horizon="${esc(networks.mainnetHorizon)}"
      data-protocol="${plan.upgrade.protocol}" data-vote="${esc(plan.upgrade.mainnetVote)}" data-checked="${esc(day(content.checked))}">
      <div class="glass">
        <h2 class="board-head ${lit()}"><span id="plan-title">${esc(plan.name)}</span><span>${esc(plan.by)}</span></h2>
        <ol class="stages">${stages}
        </ol>
        <p class="board-foot ${lit()}" role="status"><span class="led" id="live-led"></span><span id="live-text">Statuses as of ${esc(day(content.checked))}</span></p>
        <p class="board-link ${lit()}"><a ${outside(plan.url)}>Read the plan</a><span>${esc(plan.by)}, ${esc(day(plan.published))}</span></p>
      </div>
    </section>`;
}

// Something folded away until it is asked for: the full text behind a short line.
function fold(label, inside, id = '') {
  return `
        <details class="fold"${id ? ` id="${id}"` : ''}>
          <summary><span class="fold-mark" aria-hidden="true"></span><span class="fold-label">${label}</span></summary>
          <div class="fold-body">${inside}
          </div>
        </details>`;
}

// The word VERIFIED as the demo's receipt stamps it: drawn as outlines (from Anton, SIL OFL 1.1),
// so it needs no typeface of its own.
const STAMP =
  'M35.2 0L11.7 0L1.1-86L17.5-86L23.8-27.5L29.4-86L45.8-86L35.2 0M90.2 0L54.7 0L54.7-85.9L89.1-85.9L89.1-69.3L72.2-69.3L72.2-52.6L88.4-52.6L88.4-36.4L72.2-36.4L72.2-16.7L90.2-16.7L90.2 0M117.3 0L99.9 0L99.9-85.9L126.3-85.9Q132.9-85.9 136.2-82.9Q139.6-79.9 140.7-74.5Q141.9-69.1 141.9-61.9Q141.9-54.8 140.1-50.6Q138.3-46.4 133.4-44.8Q137.4-44 139.1-40.8Q140.7-37.6 140.7-32.5L140.7 0L123.8 0L123.8-33.6Q123.8-37.4 122.2-38.3Q120.7-39.2 117.3-39.2L117.3 0M117.4-70L117.4-54.1L121.5-54.1Q125.1-54.1 125.1-61.9Q125.1-66.9 124.3-68.5Q123.5-70 121.4-70L117.4-70M167.4 0L150.8 0L150.8-85.9L167.4-85.9L167.4 0M195.5 0L178.2 0L178.2-85.9L212.6-85.9L212.6-69.2L195.5-69.2L195.5-55.5L211.7-55.5L211.7-39L195.5-39L195.5 0M237.9 0L221.3 0L221.3-85.9L237.9-85.9L237.9 0M284.3 0L248.8 0L248.8-85.9L283.1-85.9L283.1-69.3L266.2-69.3L266.2-52.6L282.4-52.6L282.4-36.4L266.2-36.4L266.2-16.7L284.3-16.7L284.3 0M317 0L293.9 0L293.9-85.9L317.6-85.9Q326.8-85.9 331.5-80.8Q336.2-75.6 336.2-65.7L336.2-25.5Q336.2-13.3 331.9-6.6Q327.7 0 317 0M311.2-70.9L311.2-15.2L314.2-15.2Q318.9-15.2 318.9-19.8L318.9-64.1Q318.9-68.4 317.8-69.7Q316.6-70.9 313.1-70.9';

// The line of work, as one picture: the device hashes its way up a tree, the proof travels, the
// contract checks it and stamps it. What is drawn is decoration; what it says is in the captions.
function journey(content) {
  const s = content.line.scene;
  const row = (n) => `<span class="row r${n}">${'<span></span>'.repeat(n)}</span>`;
  return `
      <div class="scene journey" id="journey">
        <div class="phone" aria-hidden="true">
          <div class="screen">
            <div class="tree">${row(1)}${row(2)}${row(4)}${row(8)}</div>
            <p class="say">Proof ready</p>
          </div>
        </div>
        <p class="cap"><b>${esc(s.device.name)}</b><span>${esc(s.device.does)}</span></p>
        <div class="track" aria-hidden="true">
          <span class="rail"></span>
          <span class="chip">${esc(s.proof.figure)}</span>
        </div>
        <p class="cap"><b>${esc(s.proof.name)}</b><span>${esc(s.proof.does)}</span></p>
        <div class="contract" aria-hidden="true">
          <div class="panel">
            <div class="panel-glass">
              <p class="panel-head"><span>Testnet</span><span class="led on"></span></p>
              <p class="panel-call">verify(proof)</p>
              <svg class="meter" viewBox="0 0 100 6" preserveAspectRatio="none"><rect class="lane" width="100" height="6"/><rect class="fill" width="${Number(s.chain.share)}" height="6"/></svg>
              <p class="panel-foot"><span class="pct">${Number(s.chain.share)}</span>% of one tx</p>
            </div>
          </div>
          <svg class="stamp" viewBox="0 0 376 176">
            <g filter="url(#ink)" fill="none" stroke="currentColor">
              <rect x="4" y="4" width="368" height="168" rx="10" stroke-width="6"/>
              <rect x="13" y="13" width="350" height="150" rx="5" stroke-width="1.8"/>
              <path fill="currentColor" stroke="none" transform="translate(19.4 131)" d="${STAMP}"/>
              <text class="stamp-small" x="188" y="34" text-anchor="middle" fill="currentColor" stroke="none">STELLAR TESTNET</text>
              <text class="stamp-small" x="188" y="155" text-anchor="middle" fill="currentColor" stroke="none">HASHES ONLY</text>
            </g>
          </svg>
        </div>
        <p class="cap"><b>${esc(s.chain.name)}</b><span>${esc(s.chain.does)}</span><span class="cap-figures">${esc(s.chain.figures)}</span></p>
        <button class="again" type="button" hidden>Play it again</button>
      </div>`;
}

// A small picture for each thing the plan leaves open. Each acts out its question once.
function picture(id) {
  if (id === 'dormant') {
    // Fifteen accounts move to a new key; three nobody is watching stay behind.
    const asleep = new Set([3, 6, 14]);
    const dots = Array.from({ length: 15 }, (_, i) => `<circle class="acct${asleep.has(i) ? ' asleep' : ''}" cx="${12 + 18 * (i % 5)}" cy="${14 + 18 * Math.floor(i / 5)}" r="5.5"/>`).join('');
    return `<svg class="picto picto-dormant" viewBox="0 0 96 64" aria-hidden="true">${dots}</svg>`;
  }
  if (id === 'proofs') {
    // A curve, struck out; a tree of hashes, drawn in its place.
    return `<svg class="picto picto-proofs" viewBox="0 0 96 64" aria-hidden="true">
            <path class="curve" pathLength="1" d="M6 54C16 46 9 30 20 27 30 24 31 38 22 40 14 42 13 31 24 22 32 15 38 12 42 6"/>
            <path class="strike" pathLength="1" d="M5 12L43 56"/>
            <path class="twig" d="M72 18V22M61 22H83M61 22V27M83 22V27M61 37V41M55.5 41H66.5M55.5 41V46M66.5 41V46M83 37V41M77.5 41H88.5M77.5 41V46M88.5 41V46"/>
            <rect class="node n3" x="50.5" y="46" width="10" height="10" rx="1.5"/><rect class="node n3" x="61.5" y="46" width="10" height="10" rx="1.5"/><rect class="node n3" x="72.5" y="46" width="10" height="10" rx="1.5"/><rect class="node n3" x="83.5" y="46" width="10" height="10" rx="1.5"/>
            <rect class="node n2" x="56" y="27" width="10" height="10" rx="1.5"/><rect class="node n2" x="78" y="27" width="10" height="10" rx="1.5"/>
            <rect class="node n1" x="67" y="8" width="10" height="10" rx="1.5"/>
          </svg>`;
  }
  if (id === 'validators') {
    // A ring of validators; a round of signatures goes around it.
    const nodes = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI) / 4 - Math.PI / 2;
      return `<circle cx="${(48 + 22 * Math.cos(angle)).toFixed(1)}" cy="${(32 + 22 * Math.sin(angle)).toFixed(1)}" r="4.5"/>`;
    }).join('');
    return `<svg class="picto picto-validators" viewBox="0 0 96 64" aria-hidden="true"><path class="ring" d="M48 10a22 22 0 1 0 0 44a22 22 0 1 0 0-44"/><g class="vals">${nodes}</g></svg>`;
  }
  return '';
}

// What the plan leaves for later: a picture, a short line and who has tried it; the plan's own
// account is folded underneath.
function open(content) {
  const titles = Object.fromEntries(content.work.map((w) => [w.id, w.title]));
  return content.open
    .map(
      (q) => `
        <article class="q scene" id="open-${esc(q.id)}">
          ${picture(q.id)}
          <div class="q-text">
            <h3>${esc(q.title)}</h3>
            <p class="q-short">${esc(q.short)}</p>
            <p class="q-tried"><span class="lab">Tried</span><span>${
              q.tried.length ? q.tried.map((id) => `<a href="#work-${esc(id)}">${esc(titles[id])}</a>`).join(', ') : 'Nothing listed yet. <a href="#add">Add your work</a>'
            }</span></p>${fold(
              'What the plan says',
              `
            <p>${esc(q.text)}</p>
            <p class="said"><span class="lab">SDF</span><span>${esc(q.sdf)}</span></p>`,
            )}
          </div>
        </article>`,
    )
    .join('');
}

// The work, one card each, and a last one that is still empty.
function work(content) {
  const cards = content.work.map(
    (w) => `
        <li class="work scene" id="work-${esc(w.id)}">
          <p class="work-state"><span class="led${w.live ? ' on' : ''}"></span><span>${esc(w.status)}</span><span class="area">${esc(w.area)}</span></p>
          <h3>${esc(w.title)}</h3>
          <p class="work-text">${esc(w.text)}</p>
          <p class="work-caveat">${esc(w.caveat)}</p>
          <p class="work-foot"><span class="by">by ${w.byUrl ? `<a ${outside(w.byUrl)}>${esc(w.by)}</a>` : esc(w.by)}</span><span class="links">${w.links.map(anchor).join(' ')}</span></p>
        </li>`,
  );
  const a = content.add;
  cards.push(`
        <li class="work yours" id="add">
          <h3>${esc(a.title)}</h3>
          <p class="work-text">${esc(a.text)}</p>
          <p class="work-foot"><span class="links">${a.href ? `<a ${outside(a.href)}>${esc(a.action)}</a>` : `<span class="dim">${esc(a.action)}: address to be set</span>`}</span></p>
        </li>`);
  return cards.join('');
}

function sources(content) {
  return content.sources
    .map(
      (group) => `
            <div class="source-group">
              <h3>${esc(group.group)}</h3>
              <ul>
                ${group.items.map((s) => `<li><a ${outside(s.href)}>${esc(s.text)}</a><span>${esc(s.note)}</span></li>`).join('\n                ')}
              </ul>
            </div>`,
    )
    .join('');
}

function questions(content) {
  return content.questions
    .map(
      (item) => `
            <details>
              <summary>${esc(item.q)}</summary>
              <p>${esc(item.a)}</p>
            </details>`,
    )
    .join('');
}

// What a search engine is told in its own format: the site, and the short answers.
function structured(content, siteUrl) {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: content.name,
      description: content.metaDescription,
      inLanguage: 'en',
      ...(siteUrl ? { url: siteUrl + '/' } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.questions.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
    },
  ];
  // "<" cannot end the block early.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// The top of a band: a short label, what it is about, and its headline.
const top = (id, label, note, title) => `
      <p class="kicker"><b>${esc(label)}</b>${note ? `<span>${esc(note)}</span>` : ''}</p>
      <h2 class="display" id="${id}-title">${title}</h2>`;

export function render(content, { siteUrl = '', demo = 'demo/' } = {}) {
  const { line, headlines } = content;
  const sourceCount = content.sources.reduce((n, group) => n + group.items.length, 0);
  const bands = `
  <section class="band tone-night" id="line" aria-labelledby="line-title">
    <div class="wrap split">
      <div class="split-head">${top('line', line.title, 'ZK and privacy research, as of ' + day(line.asOf), esc(line.headline))}
        <p class="standfirst">${esc(line.standfirst)}</p>
      </div>${journey(content)}
      <div class="split-tail">
        <p class="caveat">${esc(line.caveat)}</p>
        <p class="links">${line.links.map(anchor).join(' ')}</p>${fold(
          'The details, and what has been measured',
          `
        ${line.text.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
        <dl class="figures" aria-label="Measured so far">
          ${line.figures.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n          ')}
        </dl>`,
          'details',
        )}
      </div>
    </div>
  </section>

  <section class="band tone-paper" id="open" aria-labelledby="open-title">
    <div class="wrap">${top('open', 'Still open', 'In the plan, without a date', headline(headlines.open, content.open.length))}
      <div class="trio">${open(content)}
      </div>
    </div>
  </section>

  <section class="band tone-counter" id="work" aria-labelledby="work-title">
    <div class="wrap">${top('work', 'Built so far', 'Listed as each stands today', headline(headlines.work, content.work.length))}
      <ul class="works">${work(content)}
      </ul>
    </div>
  </section>

  <section class="band tone-mist" id="more" aria-labelledby="more-title">
    <div class="wrap">${top('more', 'Read on', '', esc(headlines.more))}
      <div class="folds">${fold(
        `<b>Sources</b><span>${count(sourceCount, 'document or talk', 'documents and talks')}, Stellar's own first</span>`,
        `
          <div class="sources">${sources(content)}
          </div>`,
        'sources',
      )}${fold(
        `<b>Short answers</b><span>${count(content.questions.length, 'question', 'questions')} people ask</span>`,
        `
          <div class="answers">${questions(content)}
          </div>`,
        'answers',
      )}
      </div>
    </div>
  </section>`;
  const meta = siteUrl
    ? [
        `<meta property="og:url" content="${esc(siteUrl)}/">`,
        `<meta property="og:image" content="${esc(siteUrl)}/og.png">`,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        `<meta property="og:image:alt" content="${esc(content.name)}, next to a display listing the three stages of the Quantum Preparedness Plan. Community page, not run by SDF.">`,
        `<link rel="canonical" href="${esc(siteUrl)}/">`,
      ].join('\n')
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(content.title)}</title>
<meta name="description" content="${esc(content.metaDescription)}">
<meta name="theme-color" content="#2a2d74">
<meta name="color-scheme" content="only light">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(content.name)}">
<meta property="og:title" content="${esc(content.title)}">
<meta property="og:description" content="${esc(content.metaDescription)}">
${meta}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preload" href="fonts/DepartureMono-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/AtkinsonHyperlegibleNext-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="hub.css">
<script type="module" src="hub.js"></script>
${structured(content, siteUrl)}
</head>
<body>

<svg class="defs" width="0" height="0" aria-hidden="true">
  <filter id="ink" x="-4%" y="-8%" width="108%" height="116%">
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="11" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -5.2 3.5" result="worn"/>
    <feComposite in="SourceGraphic" in2="worn" operator="in" result="inked"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="wobble"/>
    <feDisplacementMap in="inked" in2="wobble" scale="2.4"/>
  </filter>
</svg>

<main>
  <div class="hero wrap">
    <header class="mast">
      <h1 class="big">${esc(content.name)}</h1>
      <p class="lede read">${esc(content.description)}</p>
      <p class="who">${esc(content.independence)}</p>
    </header>
${board(content)}
    <nav class="printer printer-hub" id="printer" aria-label="The demo">
      <div class="slot" aria-hidden="true"></div>
      <div class="dock">
        <div class="vfd" aria-hidden="true">
          <p class="vfd-top"><span>Stellar testnet</span><span class="led" id="led"></span></p>
          <p class="vfd-main"><span id="vfd-ledger">Ready</span></p>
        </div>
        <a class="key" href="${demo}">Run the demo</a>
      </div>
    </nav>
  </div>
${bands}

  <footer class="band tone-night foot">
    <div class="wrap colophon">
      <p>Community page, run by ${content.runByUrl ? `<a ${outside(content.runByUrl)}>${esc(content.runBy)}</a>` : esc(content.runBy)}. It is not affiliated with, sponsored or endorsed by the Stellar Development Foundation. “Stellar” is a trademark of the Stellar Development Foundation.</p>
      <p>The display reads its statuses from the network, in your browser. Everything else was checked against the linked sources on ${esc(day(content.checked))}.</p>
    </div>
  </footer>
</main>

</body>
</html>
`;
}
