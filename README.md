# Jewish, Not Alone

A free, independent directory that helps Jewish people in the United States find Jewish organizations they can turn to — for reporting antisemitism, counseling, financial hardship, addiction recovery, older adults and Holocaust survivors, and students.

Plain HTML, CSS, and vanilla JavaScript. No framework, no build step, no runtime network requests, no tracking. Hosted on GitHub Pages.

## Run it locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Files

| Path | What it is |
|---|---|
| `*.html` | The pages. Committed exactly as served. |
| `style.css`, `print.css` | All styles. Colour tokens are at the top of `style.css`. |
| `app.js` | Optional enhancements: menu overlay, reporting filter, notes tool, print helper. |
| `js-detect.js` | One line: adds the `js` class before first paint so the plain nav can swap for the Menu button. |
| `data/organizations.json` | **Every organization's content lives here.** |
| `scripts/render.mjs` | Writes the cards, header, footer and `<head>` into the pages from the data file. |
| `scripts/check-links.mjs` | Checks every URL in the data file. |
| `.github/workflows/check-links.yml` | Runs both scripts on every push and every Monday. |
| `fonts/` | Self-hosted fonts and their licenses. |

## Updating an organization

1. Check the change on the organization's **own official website**. Never copy a URL or phone number from a news article, directory, or search result without confirming it on the official site.
2. Edit `data/organizations.json`. Set `lastVerified` to today's date (`YYYY-MM-DD`).
3. Regenerate the pages (needs Node 18+; this is the only tool the project uses):

   ```bash
   node scripts/render.mjs
   ```

4. Check the links:

   ```bash
   node scripts/check-links.mjs
   ```

5. Commit the JSON **and** the regenerated HTML together. CI fails if the pages don't match the data.

### Why generate HTML instead of loading the JSON in the browser?

The site has to work with JavaScript turned off, and its Content Security Policy forbids `fetch()` (`connect-src 'none'`). So the cards are written into the HTML ahead of time. The script is a maintenance tool, not a build step: GitHub Pages serves the committed files as they are.

Only the regions between marker comments are rewritten, so everything else in a page can be edited by hand:

```html
<!-- @orgs ids=scn,adl reporting -->  … generated …  <!-- /@orgs -->
<!-- @header -->  <!-- @footer find -->  <!-- @head -->
```

- `ids=` lists the organizations to show, in order.
- `reporting` adds the "non-criminal" and "anonymous" rows and the filter data attributes.
- `find` (on the footer) adds the "Find a Jewish agency near you" box.

### Data fields

| Field | Notes |
|---|---|
| `id` | Unique, lowercase. Used in anchors (`#org-scn`). |
| `name`, `fullName`, `kicker` | Card title, subtitle, and small uppercase label. |
| `categories` | Any of `antisemitism`, `counseling`, `hardship`, `recovery`, `survivors`, `students`, `find-help`. These document where an organization belongs; which pages show it is set by the `ids=` markers. |
| `ageRange` | `all`, `12-26`, `students`, or `older-adults`. Shown as a pill. |
| `primary` | `true` renders the card full-width with a heavier border. |
| `description` | An array of paragraphs. Plain text only. |
| `acceptsNonCriminal`, `anonymous` | Reporting organizations only. `anonymous` is `yes`, `no`, `varies`, or `unstated` (shown as "Not stated — ask them"). Use `unstated` unless the organization's own site says so. |
| `cost` | Free text. Starting with "Free" adds a **Free** pill. Starting with "No fee" adds a **No fee to apply** pill. |
| `referralRequired`, `referralText` | Shows the outlined callout (used for The Blue Card). |
| `contact` | `form` / `url` need `url` (https only). `phone` needs `value` like `+18445551234`. `email` needs `value`. |
| `primaryAction` | The big pill button. `url` must be https. |
| `verifyText` | **Required.** Text the link checker expects on the primary page, e.g. the page title. If an organization's domain expires and is taken over, the page will still answer "200 OK". This is what catches it. |
| `hours`, `whatHappensNext`, `lastVerified` | As shown on the card. |
| `situations`, `incidentTypes` | Reporting organizations only; drive the filter on `antisemitism.html`. Situations: `anywhere campus workplace school online synagogue`. Types: `harassment threats vandalism discrimination suspicious`. |

`render.mjs` refuses to run if a URL isn't `https://`, a phone or email is malformed, an id is unknown or duplicated, or a required field is missing. Every value is HTML-escaped. `app.js` never builds HTML from strings.

## The link checker

`scripts/check-links.mjs` fails the run when a link:

- returns 404 / 410 / 5xx, or has a DNS, TLS, or connection error, or times out;
- redirects to a different domain;
- contains wording typical of parked or hijacked domains ("domain for sale", "casino", …), or is an empty page that only redirects by script;
- no longer contains the organization's `verifyText`.

Some sites (for example SCN and the Jewish Board) block automated requests with 403. Those show as **warnings**, not failures. Open them by hand when you see one.

These checks exist because of real cases found while building the site. `jaanetwork.org` (Jewish Addiction Awareness Network) now serves a casino page with HTTP 200. `callhelp.org` is a domain for sale. Neither appears on this site.

## Adding a country later

1. Add a `"country": "US"` field to every existing entry, then add new entries with their own code.
2. Copy the category pages into a folder per country (e.g. `ca/counseling.html`). Adjust relative paths (`../style.css`) or add a `<base>` element.
3. Pass the country to `render.mjs` (filter `ids` by country) and add a country switch to the menu.
4. Replace the US-only 988 crisis line with that country's equivalent, from an official government or health-service source.
5. Update the "Coverage" section of `about.html`.

## Security and privacy

- Content Security Policy (meta tag): `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'self'; object-src 'none'`.
- `frame-ancestors 'none'` is **not** in the meta tag. Browsers ignore that directive in `<meta>` (it only works as an HTTP header, which GitHub Pages can't set) and log an error. To block framing, serve the site through a host or CDN that can send headers. Then add `Content-Security-Policy: frame-ancestors 'none'` and `X-Content-Type-Options: nosniff`.
- No inline scripts, inline styles, or inline event handlers.
- External links use `target="_blank" rel="noopener noreferrer"`, and every page sends `referrer: no-referrer`.
- The notes page keeps a draft in `localStorage` (wrapped in try/catch, with a Clear button). It never submits or sends anything.
- `404.html` uses relative links. It works for any missing top-level page (`/jewish-not-alone/anything`). For deeper paths, its styles won't load, but the links still lead home.

## Fonts and licenses

| Font | Use | License |
|---|---|---|
| **Fraunces** (variable; `opsz` 9–144, `wght` 400–600; `SOFT` and `WONK` fixed at 0) | Display serif | SIL Open Font License 1.1 — `fonts/Fraunces-OFL.txt` |
| **Inter** 400 / 500 / 600 | Sans-serif for body and UI | SIL Open Font License 1.1 — `fonts/Inter-OFL.txt` |
| **Instrument Serif** Italic 400 | “Not Alone” in the home-page title | SIL Open Font License 1.1 — `fonts/InstrumentSerif-OFL.txt` |

Both are subset to Latin and served as `.woff2` from this repository.

The design brief suggested **General Sans** (Fontshare). Its ITF Free Font License forbids redistributing the font files from a public repository or publicly accessible server, which would rule out a public GitHub Pages repo. The brief's named alternative, Inter, is used instead.

## Design notes

- Near-black, warm off-white, and greys, plus one accent: Israeli flag blue (`--blue: #0038b8`) with white. Blue is used for the Menu and primary buttons, selected filter pills, the key-message panel, inline circle tokens, route-card hover, kickers, focus rings, and the small blue/white/blue stripe mark under the hero.
- Type: the hero title pairs Inter 600 (“Jewish,”) with Instrument Serif italic (“Not Alone”). The Menu button is a soft near-black (`--menu-bg`), not blue. Statements, page titles, card titles and the two-column section headings use the Fraunces serif.
- `--ink-faint` is `#6e6e6a`, not the brief's `#8e8e8a`. The original fails WCAG contrast for small text on `--paper`, and it is used for the 988 crisis line.
- Motion is limited to the menu fade/scale (≤ 200 ms). It is disabled under `prefers-reduced-motion`.
