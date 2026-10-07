// Jewish, Not Alone — progressive enhancements.
// Everything here is optional: every page works without it.
// No network requests, no innerHTML, no third-party code.
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function closeIcon() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M4 4l12 12M16 4L4 16");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    return svg;
  }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- Menu
  function initMenu() {
    var button = document.querySelector(".menu-btn");
    var nav = document.getElementById("site-nav");
    if (!button || !nav) return;

    var overlay = el("div", {
      id: "menu-overlay",
      class: "menu-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Menu",
    });
    overlay.hidden = true;

    var panel = el("div", { class: "menu-panel" });
    var close = el("button", { type: "button", class: "menu-close", "aria-label": "Close menu" });
    close.appendChild(closeIcon());

    var list = el("ul", { class: "menu-list" });
    nav.querySelectorAll("a").forEach(function (a) {
      var li = el("li");
      var link = el("a", { href: a.getAttribute("href") }, a.textContent);
      if (a.getAttribute("aria-current")) link.setAttribute("aria-current", "page");
      li.appendChild(link);
      list.appendChild(li);
    });

    var menuNav = el("nav", { "aria-label": "Main" });
    menuNav.appendChild(list);

    var note = el("p", { class: "menu-note" }, "An independent guide. Not affiliated with any organization listed.");

    panel.appendChild(close);
    panel.appendChild(menuNav);
    panel.appendChild(note);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    var lastFocus = null;

    function focusables() {
      return Array.prototype.slice.call(panel.querySelectorAll("a[href], button:not([disabled])"));
    }

    function open() {
      lastFocus = document.activeElement;
      overlay.hidden = false;
      document.body.classList.add("menu-open");
      button.setAttribute("aria-expanded", "true");
      // Force a frame so the fade/scale transition runs.
      requestAnimationFrame(function () {
        overlay.classList.add("is-open");
      });
      var current = panel.querySelector('[aria-current="page"]');
      (current || close).focus();
      document.addEventListener("keydown", onKey);
    }

    function shut() {
      overlay.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
      document.removeEventListener("keydown", onKey);
      var done = function () {
        overlay.hidden = true;
      };
      if (reduceMotion) done();
      else setTimeout(done, 190);
      (lastFocus && lastFocus.focus ? lastFocus : button).focus();
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        shut();
        return;
      }
      if (e.key === "Tab") {
        var items = focusables();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!panel.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    button.addEventListener("click", open);
    close.addEventListener("click", shut);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) shut();
    });
  }

  // ---------------------------------------------------------------- Filter
  function initFilter() {
    var filter = document.querySelector("[data-filter]");
    var list = document.querySelector("[data-filter-list]");
    if (!filter || !list) return;

    var cards = Array.prototype.slice.call(list.querySelectorAll(".org"));
    var status = document.querySelector("[data-filter-status]");
    var empty = document.querySelector("[data-filter-empty]");
    var state = { where: "anywhere", type: null, anon: null };

    function matches(card) {
      var situations = (card.getAttribute("data-situations") || "").split(" ");
      var types = (card.getAttribute("data-types") || "").split(" ");
      var anon = card.getAttribute("data-anonymous");
      if (state.where !== "anywhere" && situations.indexOf(state.where) === -1) return false;
      if (state.type && types.indexOf(state.type) === -1) return false;
      if (state.anon === "yes" && anon !== "yes") return false;
      return true;
    }

    function apply() {
      var shown = cards.filter(matches);
      var none = shown.length === 0;
      cards.forEach(function (c) {
        c.hidden = !none && shown.indexOf(c) === -1;
      });
      if (empty) empty.hidden = !none;
      var total = cards.length;
      if (status) {
        status.textContent = none
          ? "No exact match — showing all " + total + " organizations that take reports."
          : shown.length === total
          ? "Showing all " + total + " organizations."
          : "Showing " + shown.length + " of " + total + " organizations.";
      }
    }

    filter.querySelectorAll("[data-group]").forEach(function (group) {
      var key = group.getAttribute("data-group");
      var pills = Array.prototype.slice.call(group.querySelectorAll(".pill"));
      pills.forEach(function (pill) {
        pill.addEventListener("click", function () {
          var value = pill.getAttribute("data-value");
          var pressed = pill.getAttribute("aria-pressed") === "true";
          // "Where" always has one value; other questions can be cleared by pressing again.
          var next = pressed && key !== "where" ? null : value;
          state[key] = next;
          pills.forEach(function (p) {
            p.setAttribute("aria-pressed", String(p.getAttribute("data-value") === next));
          });
          apply();
        });
      });
    });

    var reset = filter.querySelector("[data-filter-reset]");
    if (reset) {
      reset.addEventListener("click", function () {
        state = { where: "anywhere", type: null, anon: null };
        filter.querySelectorAll(".pill").forEach(function (p) {
          var g = p.closest("[data-group]").getAttribute("data-group");
          p.setAttribute("aria-pressed", String(g === "where" && p.getAttribute("data-value") === "anywhere"));
        });
        apply();
      });
    }

    apply();
  }

  // ---------------------------------------------------------------- Notes
  var STORE_KEY = "jna-notes-draft-v1";

  function storageGet() {
    try {
      return window.localStorage.getItem(STORE_KEY);
    } catch (e) {
      return null;
    }
  }
  function storageSet(v) {
    try {
      window.localStorage.setItem(STORE_KEY, v);
      return true;
    } catch (e) {
      return false;
    }
  }
  function storageClear() {
    try {
      window.localStorage.removeItem(STORE_KEY);
    } catch (e) {
      /* storage unavailable — nothing to clear */
    }
  }

  function initNotes() {
    var form = document.querySelector("[data-notes]");
    if (!form) return;

    var statusEl = document.querySelector("[data-notes-status]");
    var copyBtn = document.querySelector("[data-notes-copy]");
    var dlBtn = document.querySelector("[data-notes-download]");
    var clearBtn = document.querySelector("[data-notes-clear]");
    var fields = Array.prototype.slice.call(form.querySelectorAll("input, textarea"));

    function say(msg) {
      if (!statusEl) return;
      statusEl.textContent = "";
      // Re-set on next frame so screen readers announce repeated messages.
      requestAnimationFrame(function () {
        statusEl.textContent = msg;
      });
    }

    function collect() {
      var data = {};
      fields.forEach(function (f) {
        if (f.type === "checkbox") data[f.name + ":" + f.value] = f.checked;
        else data[f.name] = f.value;
      });
      return data;
    }

    function restore(data) {
      fields.forEach(function (f) {
        if (f.type === "checkbox") f.checked = !!data[f.name + ":" + f.value];
        else if (typeof data[f.name] === "string") f.value = data[f.name];
      });
    }

    function formatWhen(v) {
      if (!v) return "";
      var d = new Date(v);
      if (isNaN(d.getTime())) return v;
      try {
        return d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
      } catch (e) {
        return v;
      }
    }

    function toText() {
      var get = function (name) {
        var f = form.elements.namedItem(name);
        return f && f.value ? f.value.trim() : "";
      };
      var evidence = fields
        .filter(function (f) {
          return f.type === "checkbox" && f.name === "evidence" && f.checked;
        })
        .map(function (f) {
          return f.value;
        });

      var sections = [
        ["Date and time", formatWhen(get("when"))],
        ["Location", get("where")],
        ["What happened", get("what")],
        ["Who was involved", get("who")],
        ["Witnesses", get("witnesses")],
        ["Evidence I have", evidence.join(", ")],
        ["Already reported to", get("reported")],
        ["How it affected me", get("impact")],
      ];

      var out = ["INCIDENT NOTES", "Written: " + formatWhen(new Date().toISOString()), ""];
      sections.forEach(function (s) {
        out.push(s[0].toUpperCase());
        out.push(s[1] || "(not filled in)");
        out.push("");
      });
      return out.join("\n").trim() + "\n";
    }

    // Draft saving (this device only).
    var saved = storageGet();
    if (saved) {
      try {
        restore(JSON.parse(saved));
        say("Your saved draft was restored from this device.");
      } catch (e) {
        storageClear();
      }
    }

    var saveTimer = null;
    form.addEventListener("input", function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        storageSet(JSON.stringify(collect()));
      }, 400);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = toText();
        var fallback = function () {
          var ta = el("textarea", { readonly: "", "aria-hidden": "true" });
          ta.value = text;
          ta.className = "visually-hidden";
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try {
            ok = document.execCommand("copy");
          } catch (e) {
            ok = false;
          }
          document.body.removeChild(ta);
          say(ok ? "Copied. You can paste it into any organization's form." : "Copy didn't work in this browser. Try Download instead.");
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            say("Copied. You can paste it into any organization's form.");
          }, fallback);
        } else {
          fallback();
        }
      });
    }

    if (dlBtn) {
      dlBtn.addEventListener("click", function () {
        var blob = new Blob([toText()], { type: "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = el("a", { href: url, download: "incident-notes.txt" });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
        say("Downloaded incident-notes.txt to this device.");
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!window.confirm("Clear everything on this page, including the saved draft?")) return;
        form.reset();
        storageClear();
        say("Cleared. Nothing is saved on this device.");
      });
    }
  }

  // ---------------------------------------------------------------- Print
  // Open every <details> while printing so answers aren't hidden on paper.
  function initPrint() {
    var opened = [];
    window.addEventListener("beforeprint", function () {
      document.querySelectorAll("details:not([open])").forEach(function (d) {
        d.open = true;
        opened.push(d);
      });
    });
    window.addEventListener("afterprint", function () {
      opened.forEach(function (d) {
        d.open = false;
      });
      opened = [];
    });
  }

  function init() {
    initMenu();
    initFilter();
    initNotes();
    initPrint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
