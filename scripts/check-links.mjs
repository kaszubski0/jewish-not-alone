#!/usr/bin/env node
// Checks every URL in data/organizations.json.
//
// A dead link here sends someone in distress to a dead end, so this fails on:
//   • 404 / 410 / other 4xx (except bot-protection responses, see below), 5xx
//   • DNS, TLS, or connection errors and timeouts
//   • a redirect to a different registrable domain (e.g. an expired domain
//     redirecting to a "domain for sale" page)
//   • an org's primary page no longer containing its `verifyText`
//     (catches hijacked domains that still answer 200 OK)
//   • wording typical of parked or hijacked domains on any page
//
// Some sites sit behind bot protection and answer automated requests with
// 401/403/429. Those can't be verified by a robot, so they are reported as
// warnings — check them by hand when they appear.
//
// Usage: node scripts/check-links.mjs

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const orgs = JSON.parse(readFileSync(join(ROOT, "data/organizations.json"), "utf8"));

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36 jewish-not-alone-linkcheck";
const BLOCKED = new Set([401, 403, 429]);
const TIMEOUT_MS = 25000;
// Wording typical of parked, expired, or hijacked domains. Checked on every link.
const PARKED = /(domain (name )?(is|may be) for sale|buy this domain|this domain is parked|parkingcrew|sedoparking|bodis\.com|afternic|dan\.com\/buy|casino|slot machines)/i;

// Collect unique URLs with the text expected on them (if any).
const targets = new Map();
const add = (url, who, verifyText) => {
  const t = targets.get(url) || { url, who: new Set(), verifyText: null };
  t.who.add(who);
  if (verifyText) t.verifyText = verifyText;
  targets.set(url, t);
};
for (const o of orgs) {
  add(o.primaryAction.url, o.id, o.verifyText);
  for (const c of o.contact || []) if (c.url) add(c.url, o.id);
}

const baseDomain = (host) => host.replace(/^www\./, "").split(".").slice(-2).join(".");

async function check(t) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(t.url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    const finalHost = new URL(res.url).hostname;
    if (baseDomain(finalHost) !== baseDomain(new URL(t.url).hostname)) {
      return { level: "fail", msg: `redirected off-domain to ${res.url}` };
    }
    if (BLOCKED.has(res.status)) return { level: "warn", msg: `${res.status} (bot protection?) — check by hand` };
    if (!res.ok) return { level: "fail", msg: `HTTP ${res.status}` };
    const body = await res.text();
    const parked = body.match(PARKED);
    if (parked) return { level: "fail", msg: `looks parked or hijacked (found "${parked[0]}")` };
    // A near-empty page whose only job is a script redirect is a typical parked-domain "lander".
    const text = body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "").trim();
    if (text.length < 40 && /location\.(href|replace)|\/lander/i.test(body)) {
      return { level: "fail", msg: "page is empty and only redirects by script (parked domain?)" };
    }
    if (t.verifyText) {
      if (!body.toLowerCase().includes(t.verifyText.toLowerCase())) {
        return { level: "fail", msg: `page no longer mentions "${t.verifyText}"` };
      }
    }
    return { level: "ok", msg: `HTTP ${res.status}` };
  } catch (err) {
    return { level: "fail", msg: err.name === "AbortError" ? "timed out" : String(err.cause?.code || err.message) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkWithRetry(t) {
  let r = await check(t);
  if (r.level === "fail") {
    await new Promise((res) => setTimeout(res, 3000));
    r = await check(t);
  }
  return r;
}

const results = await Promise.all([...targets.values()].map(async (t) => ({ t, r: await checkWithRetry(t) })));

let failures = 0;
let warnings = 0;
for (const { t, r } of results) {
  const mark = r.level === "ok" ? "✓" : r.level === "warn" ? "!" : "✖";
  if (r.level === "fail") failures++;
  if (r.level === "warn") warnings++;
  console.log(`${mark} ${t.url}  [${[...t.who].join(", ")}]  ${r.msg}`);
  if (r.level === "warn" && process.env.GITHUB_ACTIONS) console.log(`::warning::${t.url} — ${r.msg}`);
  if (r.level === "fail" && process.env.GITHUB_ACTIONS) console.log(`::error::${t.url} — ${r.msg}`);
}

console.log(`\n${results.length} links · ${failures} failed · ${warnings} need a manual check`);
process.exit(failures ? 1 : 0);
