// Quantum on Stellar: what changes by itself. The page is whole before this runs. This asks the
// two networks where they stand and puts the answer on the display, keeps room for the printer at
// the bottom of the screen, and plays each picture when it comes into view. No keys, no account:
// two public reads.
const $ = (id) => document.getElementById(id);
const board = $('board');
const { rpc, horizon, vote, checked } = board.dataset;
const protocol = Number(board.dataset.protocol);

const printer = $('printer');
const makeRoom = () => document.documentElement.style.setProperty('--printer', printer.offsetHeight + 'px');
makeRoom();
if (typeof ResizeObserver === 'function') new ResizeObserver(makeRoom).observe(printer);
addEventListener('resize', makeRoom);

async function ask(url, init) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 10000);
  try {
    const response = await fetch(url, { ...init, signal: control.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Testnet, from Stellar's public RPC server (the one the demo uses).
async function testnet() {
  const answer = await ask(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger' }),
  });
  const version = Number(answer.result && answer.result.protocolVersion);
  if (!version) throw new Error('no protocol version');
  return { protocol: version, ledger: Number(answer.result.sequence) };
}

// Mainnet, from SDF's public Horizon server.
async function mainnet() {
  const root = await ask(horizon + '/', { headers: { Accept: 'application/json' } });
  const version = Number(root.current_protocol_version);
  if (!version) throw new Error('no protocol version');
  return { protocol: version, ledger: Number(root.history_latest_ledger) };
}

function show(id, led, text) {
  const line = $(id);
  line.querySelector('.led').className = 'led' + (led ? ' ' + led : '');
  if (text) line.querySelector('.v').textContent = text;
}

const clock = () => new Date().toISOString().slice(11, 16) + ' UTC';

async function read() {
  const [test, main] = await Promise.allSettled([testnet(), mainnet()]);

  if (test.status === 'fulfilled') {
    const on = test.value.protocol >= protocol;
    show('stat-testnet', on ? 'on' : 'due', on ? 'on, protocol ' + test.value.protocol : 'protocol ' + test.value.protocol);
    $('vfd-ledger').textContent = 'ledger ' + test.value.ledger;
    $('led').className = 'led on';
  }
  if (main.status === 'fulfilled') {
    const version = main.value.protocol;
    if (version >= protocol) show('stat-mainnet', 'on', 'on, protocol ' + version);
    // Before the vote the line keeps the date it was built with; after it, the truth is the version.
    else if (Date.now() < Date.parse(vote)) show('stat-mainnet', 'due');
    else show('stat-mainnet', 'due', 'not active yet');
  }

  const failed = [test.status !== 'fulfilled' && 'Testnet', main.status !== 'fulfilled' && 'Mainnet'].filter(Boolean);
  $('live-led').className = 'led' + (failed.length === 0 ? ' on' : failed.length === 1 ? ' due' : '');
  $('live-text').textContent =
    failed.length === 0
      ? 'Read from the network at ' + clock()
      : failed.length === 1
        ? failed[0] + ' not reached: its status is as of ' + checked
        : 'Network not reached: statuses as of ' + checked;
}

// The pictures. Each is drawn finished; where motion is welcome it waits at its first frame and
// plays when it comes into view, and again if the reader leaves and comes back to it.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!calm && typeof IntersectionObserver === 'function') {
  document.documentElement.classList.add('motion');
  const watch = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // nearly half of it in view; or, if it is taller than the screen, half a screen of it
        const screen = entry.rootBounds ? entry.rootBounds.height : innerHeight;
        if (entry.intersectionRatio >= 0.45 || entry.intersectionRect.height >= screen / 2) entry.target.classList.add('play');
        else if (!entry.isIntersecting) entry.target.classList.remove('play');
      }
    },
    { threshold: [0, 0.1, 0.2, 0.3, 0.45] },
  );
  for (const scene of document.querySelectorAll('.scene')) watch.observe(scene);
  // On paper every picture is the finished one, whether it had played or not.
  addEventListener('beforeprint', () => document.documentElement.classList.remove('motion'));
  addEventListener('afterprint', () => document.documentElement.classList.add('motion'));

  // The long one counts its meter up as it fills, and can be asked for again.
  const journey = $('journey');
  if (journey) {
    const figure = journey.querySelector('.pct');
    const share = Number(figure.textContent);
    let frame = 0;
    const meter = (start) => (now) => {
      // the bar starts 3.1 s into the picture and takes 0.8 s (hub.css)
      const part = Math.min(1, Math.max(0, (now - start - 3100) / 800));
      figure.textContent = String(Math.round(share * part));
      if (part < 1 && journey.classList.contains('play')) frame = requestAnimationFrame(meter(start));
      else figure.textContent = String(share);
    };
    new MutationObserver(() => {
      cancelAnimationFrame(frame);
      if (journey.classList.contains('play')) frame = requestAnimationFrame(meter(performance.now()));
      else figure.textContent = String(share);
    }).observe(journey, { attributes: true, attributeFilter: ['class'] });

    const again = journey.querySelector('.again');
    again.hidden = false;
    again.addEventListener('click', () => {
      journey.classList.remove('play');
      void journey.offsetWidth; // the first frame is laid out before it plays again
      journey.classList.add('play');
    });
  }
}

// A link to something folded away opens what hides it first, then goes there.
function reveal(hash) {
  if (!hash || hash.length < 2) return;
  let target = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    // an address that is not well formed points nowhere
  }
  if (!target) return;
  let opened = false;
  for (let fold = target.closest('details'); fold; fold = fold.parentElement && fold.parentElement.closest('details')) {
    if (!fold.open) {
      fold.open = true;
      opened = true;
    }
  }
  if (opened) setTimeout(() => target.scrollIntoView({ block: 'start' }), 340);
}
addEventListener('hashchange', () => reveal(location.hash));
document.addEventListener('click', (event) => {
  const link = event.target instanceof Element && event.target.closest('a[href^="#"]');
  if (link) reveal(link.getAttribute('href'));
});
reveal(location.hash);

// Once now, then every half minute for ten minutes while the page is in view. A page left open
// does not keep asking.
let reads = 0;
read();
const timer = setInterval(() => {
  if (document.hidden) return;
  if (++reads >= 20) clearInterval(timer);
  read();
}, 30000);
