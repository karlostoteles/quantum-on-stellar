# Adding to the list

The page is written from one file, [`content.json`](content.json). Adding work, a source or a
question is adding an entry there. If you would rather not touch the file, open an issue with the
*Add your work* form and it will be written for you.

## An entry in the list

Entries live in `work`. This is one:

```json
{
  "id": "verifier",
  "title": "Verify a STARK on Stellar",
  "by": "Carlos de la Figuera",
  "byUrl": "",
  "area": "Proofs",
  "status": "On testnet",
  "live": true,
  "text": "A Soroban contract that verifies S-two proofs directly: no pairing curves, no trusted setup, no SNARK wrapper.",
  "caveat": "Research prototype, not audited.",
  "links": [{ "text": "Read the write-up", "href": "https://claude.ai/artifact/Tce78Gu5qtqw4qCZFWhTLN" }]
}
```

| Field | What goes in it |
|--|--|
| `id` | A short name in lower case, digits and hyphens. Links to the entry use it, so it does not change. |
| `title` | The work's name. |
| `by`, `byUrl` | Who built it: a person, a team or a company. `byUrl` is an `https` address for them, or empty. |
| `area` | A word or two: Signatures, Accounts, Dormant accounts, Proofs, Privacy, Validators. |
| `status` | Where it stands, in two or three words: Write-up, Prototype, On testnet, On mainnet. |
| `live` | `true` if someone can use or try it today. It lights the dot next to the status. |
| `text` | What it does, in one or two plain sentences. |
| `caveat` | What it is not yet, in one sentence: not audited, testnet only, settings still open. Every entry has one. |
| `links` | One to three, each with a `text` and an `https` address: the code, a write-up, a demo. |

Then:

```
node --test test/hub.test.mjs   # the entry has what the page prints
node build.mjs && node serve.mjs # see it on the page
```

## What gets listed

- Post-quantum work on or for Stellar: signatures, accounts and their migration, dormant accounts,
  proofs and privacy that do not rest on elliptic curves, validators.
- With a public link. A prototype or a write-up is enough; it does not have to be finished.
- Described as what it is. Entries are edited for length and tone, and to say plainly where the
  work stands.

Not listed: token promotion, paid placement, and work with nothing public to point at.

Being listed is not an endorsement by this page, and nothing here is endorsed by the Stellar
Development Foundation. If your work is listed and you want the entry changed or removed, open an
issue.

## Sources and short answers

`sources` are links to what Stellar and others have published, each with a line on what it is.
`questions` are the short answers at the foot of the page. Both take the same kind of pull
request. For anything the page says about SDF's plan, the source is SDF's own text: link it.
