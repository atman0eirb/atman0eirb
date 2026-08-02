# Active Directory — Pentest Notes 🛡️

A structured, searchable static website built from my Active Directory pentest notes.
Covers core concepts, attacks & lateral movement, permission abuse, persistence and
forest-level trust abuse — with 230+ diagrams.

## ✨ Features

- **11 sections**, fully cross-linked — 5 Active Directory sections (from Notion)
  plus 6 field-notes sections imported from the Obsidian vault: **TI interne**,
  **Pentest web**, **Cloud & K8s**, **Priv escalation & Tools**,
  **Web Vulnerability Checklist**, and **Méthodologie ORNISEC**.
- **Full-text search** — find any word across all notes, see it in context with a
  highlighted snippet, and click to jump straight to it (the term is highlighted on
  the destination page too). Supports multi-word (AND) and `"exact phrases"`.
  Press `/` to focus, or open the dedicated **🔎 Full-text search** page.
- **Dark / light theme** (remembers your choice)
- **Syntax-highlighted** code blocks with one-click copy
- **Command-focused** — text and reusable commands only, no images
- **Right-rail "On this page"** navigation with scroll-spy
- Fully **responsive** (mobile drawer menu)
- **No build step, no framework** — pure HTML/CSS/JS. Works offline.

## 📁 Structure

```
.
├── index.html                 # Overview / landing page
├── 00_things-to-understand-prior.html
├── 01_attacks-lateral-movement.html
├── 02_permissions-abuse.html
├── 03_persistence.html
├── 04_forest-privilege-escalation-trust-abuse-technique.html
├── search.html                # Dedicated full-text search page
├── assets/
│   ├── style.css              # Theme + layout
│   ├── app.js                 # Full-text search, theme, lightbox, copy, scroll-spy
│   ├── fulltext-index.json    # Full-text content index (word → location + snippet)
│   └── search-index.json      # Topic/heading index (sidebar)
├── images/                    # 230 diagrams (from the Notion export)
└── .nojekyll                  # Tell GitHub Pages to serve files as-is
```

## 🚀 Deploy on GitHub Pages

1. Create a new repository (e.g. `ad-notes`).
2. Copy all these files into it and push:
   ```bash
   git init
   git add .
   git commit -m "Publish AD pentest notes site"
   git branch -M main
   git remote add origin https://github.com/<your-user>/ad-notes.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source = Deploy from a branch**,
   **Branch = `main`**, folder = **`/ (root)`**, then **Save**.
5. Your site goes live at `https://<your-user>.github.io/ad-notes/` in ~1 minute.

> The included `.nojekyll` file ensures the `assets/` folder and file names with
> spaces are served correctly.

## 🖥️ Preview locally

```bash
# from this folder
python3 -m http.server 8080
# then open http://localhost:8080
```

## 🔧 Editing content

The pages are generated HTML. To change wording, edit the corresponding
`*.html` file directly, or re-export from Notion and rebuild.

---

*Built from a Notion export.*
