/* ===== AD Pentest Notes – client script ===== */
(function () {
  // ---- Theme ----
  const saved = localStorage.getItem("adnotes-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon();

  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("adnotes-theme", next);
    updateThemeIcon();
    swapHljsTheme(next);
  };
  function updateThemeIcon() {
    const t = document.documentElement.getAttribute("data-theme");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
  }
  function swapHljsTheme(theme) {
    const link = document.querySelector('link[href*="highlight.js"]');
    if (!link) return;
    link.href = theme === "dark"
      ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
      : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
  }
  swapHljsTheme(document.documentElement.getAttribute("data-theme"));

  // ---- Sidebar groups ----
  window.toggleGroup = function (btn) {
    btn.closest(".nav-group").classList.toggle("open");
  };

  // ---- Mobile menu ----
  const menuToggle = document.getElementById("menuToggle");
  const sideNav = document.getElementById("sideNav");
  if (menuToggle && sideNav) {
    menuToggle.addEventListener("click", () => sideNav.classList.toggle("open"));
    document.querySelector(".content")?.addEventListener("click", () => sideNav.classList.remove("open"));
  }

  // ---- Syntax highlighting ----
  document.addEventListener("DOMContentLoaded", function () {
    if (window.hljs) {
      document.querySelectorAll("pre code").forEach((el) => {
        try { hljs.highlightElement(el); } catch (e) {}
      });
    }
    addCopyButtons();
    buildSearch();
    buildSearchPage();
    highlightOnArrival();
    setupScrollSpy();
  });

  // ---- Copy buttons ----
  function addCopyButtons() {
    document.querySelectorAll(".article pre").forEach((pre) => {
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(() => {
          btn.textContent = "Copied ✓"; btn.classList.add("done");
          setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1600);
        });
      });
      pre.appendChild(btn);
    });
  }

  // ---- Full-text search engine (shared) ----
  let FT = [];               // full-text index
  let FT_READY = null;       // promise
  function loadFT() {
    if (!FT_READY) {
      // Preferred: index injected as a global via <script src="fulltext-index.js">.
      // This works under file:// and any host (fetch() is blocked on file://).
      if (window.__FT_INDEX__) {
        FT = window.__FT_INDEX__;
        FT_READY = Promise.resolve(FT);
      } else {
        // Fallback to fetch (when served over http/https).
        FT_READY = fetch("assets/fulltext-index.json")
          .then(r => r.json())
          .then(data => { FT = data; return FT; })
          .catch(() => { FT = []; return FT; });
      }
    }
    return FT_READY;
  }

  // parse query into terms (support "exact phrase")
  function parseQuery(q) {
    const phrases = [];
    q = q.replace(/"([^"]+)"/g, (_, p) => { phrases.push(p.toLowerCase().trim()); return " "; });
    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    return { phrases, words };
  }

  function scoreBlock(block, terms) {
    const hay = (block.t + " \n " + block.c).toLowerCase();
    for (const p of terms.phrases) if (!hay.includes(p)) return null;
    for (const w of terms.words) if (!hay.includes(w)) return null;
    // score: title hits weigh more + count occurrences
    const all = [...terms.phrases, ...terms.words];
    let score = 0;
    const tl = block.t.toLowerCase();
    for (const t of all) {
      if (!t) continue;
      const inTitle = tl.includes(t);
      const re = new RegExp(escapeReg(t), "g");
      const n = (hay.match(re) || []).length;
      score += n + (inTitle ? 25 : 0);
    }
    if (block.lvl === 1) score += 5;
    return score;
  }

  function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function makeSnippet(text, terms, len) {
    const all = [...terms.phrases, ...terms.words].filter(Boolean);
    if (!text) return "";
    const low = text.toLowerCase();
    let pos = -1;
    for (const t of all) { const i = low.indexOf(t); if (i !== -1 && (pos === -1 || i < pos)) pos = i; }
    if (pos === -1) pos = 0;
    const half = Math.floor(len / 2);
    let start = Math.max(0, pos - half);
    let end = Math.min(text.length, start + len);
    start = Math.max(0, end - len);
    let snip = text.slice(start, end);
    if (start > 0) snip = "… " + snip;
    if (end < text.length) snip = snip + " …";
    return highlight(snip, all);
  }

  function highlight(text, terms) {
    let out = escapeHtml(text);
    // sort longest first to avoid nested partials
    [...terms].sort((a, b) => b.length - a.length).forEach(t => {
      if (!t) return;
      const re = new RegExp("(" + escapeReg(escapeHtml(t)) + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  function ftSearch(q, limit) {
    const terms = parseQuery(q);
    if (!terms.words.length && !terms.phrases.length) return [];
    const scored = [];
    for (const b of FT) {
      const s = scoreBlock(b, terms);
      if (s !== null) scored.push([s, b]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return { terms, results: scored.slice(0, limit || 50).map(x => x[1]),
             total: scored.length };
  }

  // ---- Sidebar quick search (now full-text) ----
  function buildSearch() {
    loadFT();
    const input = document.getElementById("navSearch");
    const box = document.getElementById("searchResults");
    if (!input || !box) return;

    function render(q) {
      if (!q) { box.classList.remove("show"); box.innerHTML = ""; return; }
      loadFT().then(() => {
        const { terms, results } = ftSearch(q, 12);
        if (!results.length) {
          box.innerHTML = '<div class="sr-empty">No matches for “' + escapeHtml(q) + '”</div>';
        } else {
          box.innerHTML = results.map(r => {
            const snip = makeSnippet(r.c || r.t, terms, 90);
            return `<a href="${r.u}?q=${encodeURIComponent(q)}">` +
                   `<span class="sr-t">${highlight(r.t, [...terms.phrases, ...terms.words])}</span>` +
                   `<span class="sr-snip">${snip}</span>` +
                   `<span class="sr-s">${escapeHtml(r.sec)}</span></a>`;
          }).join("");
        }
        box.classList.add("show");
      });
    }
    let deb;
    input.addEventListener("input", e => { clearTimeout(deb); const v = e.target.value.trim(); deb = setTimeout(() => render(v), 120); });
    input.addEventListener("focus", e => { if (e.target.value.trim()) render(e.target.value.trim()); });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const v = e.target.value.trim();
        if (v) window.location.href = "search.html?q=" + encodeURIComponent(v);
      }
    });
    document.addEventListener("click", e => {
      if (!e.target.closest(".nav-search")) box.classList.remove("show");
    });
    document.addEventListener("keydown", e => {
      if (e.key === "/" && document.activeElement !== input &&
          !/^(input|textarea)$/i.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus();
      }
    });
  }

  // ---- Dedicated search page ----
  function buildSearchPage() {
    const input = document.getElementById("ftInput");
    const meta = document.getElementById("ftMeta");
    const wrap = document.getElementById("ftResults");
    if (!input || !wrap) return;

    function render(q) {
      if (!q) { meta.textContent = ""; wrap.innerHTML =
        '<div class="ft-empty">Start typing to search across all notes.</div>'; return; }
      loadFT().then(() => {
        const t0 = performance.now();
        const { terms, results, total } = ftSearch(q, 100);
        const ms = (performance.now() - t0).toFixed(0);
        if (!results.length) {
          meta.textContent = "";
          wrap.innerHTML = '<div class="ft-empty">No results for “' + escapeHtml(q) + '”.</div>';
          return;
        }
        meta.innerHTML = `<b>${total}</b> block${total > 1 ? "s" : ""} match ` +
                         `“${escapeHtml(q)}” · ${ms} ms`;
        const hl = [...terms.phrases, ...terms.words];
        wrap.innerHTML = results.map(r => {
          const snip = makeSnippet(r.c || r.t, terms, 260);
          const lvlTag = r.lvl === 1 ? "section" : "topic";
          return `<a class="ft-card" href="${r.u}?q=${encodeURIComponent(q)}">
            <div class="ft-card-top">
              <span class="ft-badge">${escapeHtml(r.sec)}</span>
              <span class="ft-lvl">${lvlTag}</span>
            </div>
            <div class="ft-title">${highlight(r.t, hl)}</div>
            <div class="ft-snip">${snip || "<i>(heading match)</i>"}</div>
          </a>`;
        }).join("");
      });
    }

    const params = new URLSearchParams(location.search);
    const initial = params.get("q") || "";
    if (initial) { input.value = initial; }
    render(initial);
    let deb;
    input.addEventListener("input", e => {
      clearTimeout(deb); const v = e.target.value.trim();
      deb = setTimeout(() => {
        render(v);
        const u = new URL(location); if (v) u.searchParams.set("q", v); else u.searchParams.delete("q");
        history.replaceState(null, "", u);
      }, 140);
    });
    input.focus();
  }

  // ---- Highlight arriving search term on a content page ----
  function highlightOnArrival() {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const article = document.querySelector(".article");
    if (!q || !article) return;
    const terms = parseQuery(q);
    const all = [...terms.phrases, ...terms.words].filter(Boolean);
    if (!all.length) return;
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentNode.nodeName.toLowerCase();
        if (p === "script" || p === "style" || p === "mark") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const re = new RegExp("(" + all.map(escapeReg).join("|") + ")", "gi");
    const targets = [];
    let n; while ((n = walker.nextNode())) if (re.test(n.nodeValue)) targets.push(n);
    let first = null;
    targets.forEach(node => {
      const span = document.createElement("span");
      span.innerHTML = node.nodeValue.replace(re, '<mark class="hit">$1</mark>');
      node.parentNode.replaceChild(span, node);
      if (!first) first = span.querySelector("mark");
    });
    if (first && !location.hash) first.scrollIntoView({ block: "center" });
    // floating "clear highlight" pill
    if (targets.length) {
      const pill = document.createElement("button");
      pill.className = "hl-pill";
      pill.innerHTML = `${targets.length} hit${targets.length > 1 ? "s" : ""} for “${escapeHtml(q)}” · clear ✕`;
      pill.onclick = () => {
        document.querySelectorAll("mark.hit").forEach(m => {
          m.replaceWith(document.createTextNode(m.textContent));
        });
        pill.remove();
        const u = new URL(location); u.searchParams.delete("q"); history.replaceState(null, "", u);
      };
      document.body.appendChild(pill);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- Scroll spy for right rail + back-to-top ----
  function setupScrollSpy() {
    const toTop = document.getElementById("toTop");
    window.addEventListener("scroll", () => {
      if (toTop) toTop.classList.toggle("show", window.scrollY > 500);
    });
    const links = [...document.querySelectorAll(".toc-rail a")];
    if (!links.length) return;
    const map = {};
    links.forEach(a => { const id = a.getAttribute("href").slice(1); map[id] = a; });
    const heads = links.map(a => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          links.forEach(l => l.classList.remove("active"));
          const a = map[en.target.id];
          if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "0px 0px -75% 0px", threshold: 0 });
    heads.forEach(h => obs.observe(h));
  }

})();
