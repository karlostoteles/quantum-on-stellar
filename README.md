# Quantum on Stellar

**The page: https://quantumonstellar.aircade.xyz**

A community page that gathers the post-quantum work around the Stellar network in one place:
where the Stellar Development Foundation's Quantum Preparedness Plan stands, what it leaves open,
what people have built so far (signatures, zero-knowledge proofs, privacy, account recovery),
Stellar's own documents and talks, and short answers to what people ask.

This repository is the page and its list. **If you are building something post-quantum on
Stellar, add it.**

This is a community project. It is not affiliated with, sponsored or endorsed by the Stellar
Development Foundation. "Stellar" is a trademark of the Stellar Development Foundation.

## Add your work

Either way works:

- **Open an issue** with the *Add your work* form: its title, who built it, its area, where it
  stands, a sentence on what it does, a sentence on what it is not yet, and a link.
- **Open a pull request** that adds an entry to `work` in [`content.json`](content.json). The
  fields are described in [CONTRIBUTING.md](CONTRIBUTING.md), and
  `node --test test/hub.test.mjs` says whether the entry holds together.

What belongs in the list: post-quantum work on or for Stellar that has a public link (code, a
write-up or a demo). Signatures, accounts and their migration, dormant accounts, proofs and
privacy that do not rest on elliptic curves, validators. A prototype is welcome; so is a write-up.
Every entry says where it stands and what it is not yet.

A source that is missing, a question worth a short answer, or something the page gets wrong:
open an issue, or change `content.json` in a pull request.

## Build and try

Plain Node (22 or later), no dependencies.

```
node build.mjs                 # writes the page into dist/
node serve.mjs                 # http://127.0.0.1:8080/, with the headers the site is served with
node --test test/hub.test.mjs  # the content holds together and the page keeps to the site's policy
```

`SITE_URL=https://… node build.mjs` builds it for the address it is served at (preview card,
`robots.txt`, `sitemap.xml`).

`test/e2e.cjs` walks the built page in a headless Chrome (it needs the `playwright` package):
what the display says for each state of the two networks, the page without JavaScript, its widths
with everything unfolded, its pictures (that they play when they come into view, end on their last
frame and stay still for a reader who asked for less motion), and the links inside it.

## How the page is made

- **The sign, the display and the printer.** The display shows the plan's three stages. The state
  of the first one is read from the network when the page opens.
- **Four bands**, one per topic, each in its own tone: *Hashes only* (the line of work behind the
  page), *Still open* (what the plan leaves for later), *Built so far* (the list) and *Read on*
  (sources and short answers). Each says its thing in a few words. The full text is on the page
  too, folded underneath in `<details>` elements, so it opens without JavaScript.
- **Pictures instead of paragraphs.** The line of work is shown as the journey of one proof: a
  device makes it, 45 KB travel, a contract checks it. Each open question has a small picture.
  They are drawn finished, in HTML, SVG and CSS. When JavaScript runs and the reader has not asked
  for less motion, each one plays as it comes into view. What a picture shows is also said in
  words next to it.
- **Three typefaces.** Departure Mono for the machines (the display, the printer, the screens in
  the pictures); Newsreader for headlines and names; Atkinson Hyperlegible Next for sentences.

| File | What |
|--|--|
| `content.json` | Everything the page says: the plan's stages, the open questions (each with its short line and its full text), the line of work, its picture's captions and its figures, the list, the sources, the short answers. |
| `page.mjs` | Writes the page from `content.json` when the site is built. The page is plain HTML: it reads without JavaScript, and so do search engines. The short answers are also written as structured data. |
| `hub.css` | The page's styles, and the pictures' motion (CSS keyframes, no library). |
| `hub.js` | The only thing that runs in the browser. Two public reads, no keys: testnet's protocol version and ledger from Stellar's RPC server, and mainnet's protocol version from SDF's Horizon server. If they do not answer, the display shows the statuses the page was built with and says so. It also plays each picture as it comes into view, unless the reader asked for less motion, and unfolds what a link points into. |
| `fonts/`, `favicon.svg` | The three typefaces, with their licences, and the icon. |
| `og.png`, `card/` | The picture a link to the page carries when it is shared, and what it is drawn from: `card/og.html`, rendered by `node card/render.cjs` (it needs `playwright`). |
| `build.mjs`, `serve.mjs` | Build the page and serve it on your machine. |
| `test/` | The checks above. |

## The demo

The key on the page, *Run the demo*, leads to `demo/`: a page where your device generates a
hash-based proof and a contract on Stellar's testnet checks it. That page is built from another
repository, which is not public yet, and is served next to this one. A build of this repository
alone does not have it, so that one link has nothing behind it on your machine.

## What the page is careful about

- **Not official.** It says so under its name and at its foot, in SDF's own wording.
- **Sources.** What it says about the plan follows SDF's post of 9 Jun 2026, and the upgrade and
  its dates follow SDF's announcement of 20 Oct 2026. Both are linked from the page. What other
  people built is described as they describe it, or as public sources do.
- **"Post-quantum".** The line of work behind the page is hash-based: the kind of cryptography a
  quantum computer weakens but does not break. With the settings that fit a transaction today it
  is not at post-quantum strength, and the page says both things.
- **Where each work stands.** Nothing is listed as more finished than it is.
- **The site's policy.** Nothing is loaded from anywhere else, and the page talks to Stellar's
  public servers only.

## Licence

Apache License 2.0 ([LICENSE](LICENSE)), text and code. The typefaces in `fonts/` are under the
SIL Open Font License, each with its licence next to it. The word on the stamp is drawn from
outlines of Anton, under the same licence ([NOTICE](NOTICE)).

Kept by Carlos de la Figuera.
