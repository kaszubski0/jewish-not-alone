#!/usr/bin/env node
// Renders shared regions (head, header, footer) and organization cards from
// data/organizations.json into the static HTML pages, between marker comments.
//
//   node scripts/render.mjs          rewrite pages in place
//   node scripts/render.mjs --check  exit 1 if any page is out of date (used in CI)
//
// The site itself has no build step: the generated HTML is committed and served
// as-is. This script exists so content is edited in one JSON file, while every
// page still works with JavaScript turned off and the CSP can forbid fetch().

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const CATEGORIES = ["antisemitism", "counseling", "hardship", "recovery", "survivors", "students", "find-help"];
const AGE_RANGES = { all: "All ages", "12-26": "Ages 12–26", students: "Students", "older-adults": "Older adults" };
const ANON = { yes: "Yes", no: "No", varies: "Varies", unstated: "Not stated — ask them" };

const NAV = [
  ["index.html", "Home"],
  ["antisemitism.html", "Reporting antisemitism"],
  ["counseling.html", "Counseling"],
  ["hardship.html", "Money, food, and work"],
  ["recovery.html", "Addiction and recovery"],
  ["survivors.html", "Older adults and survivors"],
  ["students.html", "Students"],
  ["find-help.html", "Find an agency near you"],
  ["notes.html", "Private incident notes"],
  ["questions.html", "Common questions"],
  ["about.html", "About"],
];

// frame-ancestors is deliberately absent: browsers ignore it in a <meta> CSP (it
// only works as an HTTP header, which GitHub Pages can't set) and log an error.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; " +
  "connect-src 'none'; form-action 'none'; base-uri 'self'; object-src 'none'";

// ---------- helpers ----------
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fail = (msg) => {
  console.error("✖ " + msg);
  process.exitCode = 1;
  throw new Error(msg);
};

const isHttps = (u) => {
  try {
    return typeof u === "string" && u.startsWith("https://") && new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

const ICON_ARROW =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const extLink = (url, text, cls = "") => {
  if (!isHttps(url)) fail(`Refusing non-https URL: ${url}`);
  return `<a${cls ? ` class="${cls}"` : ""} href="${esc(url)}" target="_blank" rel="noopener noreferrer">${text}<span class="visually-hidden"> (opens in a new tab)</span></a>`;
};

// ---------- data ----------
const orgs = JSON.parse(readFileSync(join(ROOT, "data/organizations.json"), "utf8"));
const byId = new Map();
for (const o of orgs) {
  if (!o.id || byId.has(o.id)) fail(`Missing or duplicate id: ${o.id}`);
  byId.set(o.id, o);
  for (const c of o.categories || []) if (!CATEGORIES.includes(c)) fail(`${o.id}: unknown category ${c}`);
  if (!AGE_RANGES[o.ageRange]) fail(`${o.id}: unknown ageRange ${o.ageRange}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.lastVerified || "")) fail(`${o.id}: lastVerified must be YYYY-MM-DD`);
  if (!o.primaryAction || !isHttps(o.primaryAction.url)) fail(`${o.id}: primaryAction.url must be https`);
  if (!o.verifyText) fail(`${o.id}: verifyText is required (text the link checker expects on the primary page)`);
  for (const c of o.contact || []) {
    if ((c.type === "form" || c.type === "url") && !isHttps(c.url)) fail(`${o.id}: contact URL must be https: ${c.url}`);
    if (c.type === "phone" && !/^\+1\d{10}$/.test(c.value)) fail(`${o.id}: phone must be +1XXXXXXXXXX`);
    if (c.type === "email" && !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(c.value)) fail(`${o.id}: bad email`);
  }
  if (o.anonymous !== undefined && !ANON[o.anonymous]) fail(`${o.id}: anonymous must be one of ${Object.keys(ANON)}`);
}
const lastReviewed = orgs.map((o) => o.lastVerified).sort().at(-1);

// ---------- card ----------
function contactItem(c) {
  switch (c.type) {
    case "form":
    case "url":
      return extLink(c.url, esc(c.label));
    case "phone":
      return `<a href="tel:${esc(c.value)}">${esc(c.label)}</a>`;
    case "email":
      return `<a href="mailto:${esc(c.value)}">${esc(c.label)}</a>`;
    default:
      fail(`Unknown contact type ${c.type}`);
  }
}

function tags(o, reporting) {
  const t = [];
  if (/^Free(?! to)/.test(o.cost || "")) t.push("Free");
  else if (/^No fee/.test(o.cost || "")) t.push("No fee to apply");
  if (reporting && o.anonymous === "yes") t.push("Anonymous OK");
  if (reporting && o.acceptsNonCriminal) t.push("Non-criminal incidents accepted");
  t.push(AGE_RANGES[o.ageRange]);
  if (o.referralRequired) t.push("Referral needed");
  return `<ul class="tag-row" aria-label="At a glance">${t.map((x) => `<li class="tag">${esc(x)}</li>`).join("")}</ul>`;
}

function card(o, { reporting = false, heading = "h3", primary = o.primary } = {}) {
  const tid = `org-${o.id}-title`;
  const rows = [];
  if (reporting) {
    rows.push(["Takes non-criminal incidents", o.acceptsNonCriminal ? "Yes" : "No"]);
    rows.push(["Anonymous reports", ANON[o.anonymous ?? "unstated"]]);
  }
  rows.push(["Cost", esc(o.cost || "Ask them")]);
  if (!reporting && o.ageRange) rows.push(["Who it's for", esc(AGE_RANGES[o.ageRange])]);
  rows.push([
    "How to reach them",
    `<ul>${(o.contact || []).map((c) => `<li>${contactItem(c)}</li>`).join("")}</ul>`,
    true,
  ]);
  if (o.hours) rows.push(["Hours", esc(o.hours)]);
  if (o.whatHappensNext) rows.push(["What happens next", esc(o.whatHappensNext)]);

  const data = reporting
    ? ` data-situations="${esc((o.situations || []).join(" "))}" data-types="${esc((o.incidentTypes || []).join(" "))}" data-anonymous="${esc(o.anonymous || "unstated")}"`
    : "";

  const desc = (Array.isArray(o.description) ? o.description : [o.description]).filter(Boolean);

  return `<article class="org${primary ? " org--primary" : ""}" id="org-${esc(o.id)}" aria-labelledby="${tid}"${data}>
  <div class="org__head">
    <p class="kicker">${esc(o.kicker)}</p>
    <${heading} class="entry-title" id="${tid}">${esc(o.name)}</${heading}>
    ${o.fullName ? `<p class="org__full">${esc(o.fullName)}</p>` : ""}
  </div>
  ${tags(o, reporting)}
  <div class="org__body">
    <div class="org__desc">
      ${desc.map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
      ${o.referralRequired ? `<div class="callout"><strong>Please note:</strong> ${esc(o.referralText || "A referral from another agency is required.")}</div>` : ""}
    </div>
    <table class="facts">
      <caption class="visually-hidden">Key facts: ${esc(o.name)}</caption>
      <tbody>
        ${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>
  <div class="org__foot">
    ${extLink(o.primaryAction.url, `${esc(o.primaryAction.label)} ${ICON_ARROW}`, "btn")}
    <p class="verified">Last verified: <time datetime="${esc(o.lastVerified)}">${esc(o.lastVerified)}</time></p>
  </div>
</article>`;
}

// ---------- shared regions ----------
const head = () => `<meta http-equiv="Content-Security-Policy" content="${CSP}">
  <meta name="referrer" content="no-referrer">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preload" href="fonts/fraunces-latin-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="print.css" media="print">
  <script src="js-detect.js"></script>
  <script src="app.js" defer></script>`;

const header = (file) => `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="wordmark" href="index.html"${file === "index.html" ? ' aria-current="page"' : ""}>Jewish, Not Alone</a>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul>
        ${NAV.map(([href, label]) => `<li><a href="${href}"${href === file ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`).join("\n        ")}
      </ul>
    </nav>
  </header>
  <div class="menu-bar"><button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu-overlay" aria-haspopup="dialog">Menu</button></div>`;

const footer = (file, withFind) => `<footer class="site-footer">
    <div class="wrap">
      ${
        withFind
          ? `<div class="footer-find">
        <p>Not sure where to start? One local agency can often help with all of this.</p>
        <a class="btn btn--secondary" href="find-help.html">Find a Jewish agency near you ${ICON_ARROW}</a>
      </div>`
          : ""
      }
      <ul class="footer-links">
        ${NAV.filter(([h]) => h !== file).map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join("\n        ")}
      </ul>
      <div class="footer-meta">
        <p>Independent guide. Not affiliated with any organization listed.</p>
        <p>This site does not collect or transmit anything you type, or store it on any server.</p>
        <p>Last reviewed: <time datetime="${lastReviewed}">${lastReviewed}</time></p>
      </div>
      <p class="crisis-line">If you are in crisis or thinking about harming yourself, call or text <a href="tel:988">988</a> (Suicide &amp; Crisis Lifeline, 24/7).</p>
    </div>
  </footer>`;

// ---------- process pages ----------
const REGION = /<!-- @(head|header|footer|orgs)([^>]*?)-->[\s\S]*?<!-- \/@\1 -->/g;

function parseOpts(s) {
  const o = {};
  for (const m of s.trim().matchAll(/(\w+)(?:=([^\s]+))?/g)) o[m[1]] = m[2] ?? true;
  return o;
}

let stale = [];
for (const file of readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
  const path = join(ROOT, file);
  const before = readFileSync(path, "utf8");
  const after = before.replace(REGION, (_m, kind, rawOpts) => {
    const opts = parseOpts(rawOpts);
    let inner;
    if (kind === "head") inner = head();
    else if (kind === "header") inner = header(file);
    else if (kind === "footer") inner = footer(file, !!opts.find);
    else {
      const ids = String(opts.ids || "").split(",").filter(Boolean);
      inner = ids
        .map((id) => {
          const o = byId.get(id);
          if (!o) fail(`${file}: unknown org id "${id}"`);
          return card(o, {
            reporting: !!opts.reporting,
            heading: opts.heading || "h3",
            primary: opts.primary === "none" ? false : o.primary,
          });
        })
        .join("\n");
    }
    return `<!-- @${kind}${rawOpts}-->\n  ${inner}\n  <!-- /@${kind} -->`;
  });
  if (after !== before) {
    if (CHECK) stale.push(file);
    else writeFileSync(path, after);
  }
}

if (CHECK && stale.length) {
  console.error("✖ Out of date — run `node scripts/render.mjs`:\n  " + stale.join("\n  "));
  process.exit(1);
}
console.log(CHECK ? "✓ All pages up to date" : "✓ Pages rendered");
