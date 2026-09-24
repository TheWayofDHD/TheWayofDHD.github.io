# The Way of DHD — site source

Static site for the **The Way of DHD / Путь ХЧК** NFT collection (TON). Published with GitHub Pages from the repository root.

**Live URL:** https://thewayofdhd.github.io/

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Home: live stats, rarity table (Epic / Exclusive / Diamond), Dickpaper teaser, `$DHD` jetton section, FAQ, links, sources |
| `collection.html` | Full browser of all 1022 NFTs with type filters and ask prices |
| `dickpaper.html` | Full-resolution Dickpaper viewer with loading progress, zoom and pan |
| `about.html` | About the project: story, official links, contract |
| `contact.html` | Telegram-only contact methods |
| `privacy.html` | Privacy policy (localStorage language preference, third-party services) |
| `llms.txt` | AI/LLM site description (llmstxt.org) |
| `404.html` | Not-found page (noindex) |
| `robots.txt` | Crawler policy — all traditional and AI bots allowed |
| `sitemap.xml` | URLs with `x-default`/`en`/`ru` alternates |

## Hosting limitation (GitHub Pages)

GitHub Pages does not allow custom response security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`). HSTS is set by GitHub (`max-age=31556952`). Mitigations in this repo:

- `<meta http-equiv="X-Content-Type-Options" content="nosniff">` and `<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">` on every page (limited browser support for meta forms).
- No inline event handlers; scripts use `defer`.
- Full header control would require Cloudflare Pages/Netlify or a reverse proxy in front of Pages.

## Data

`data/collection-stats.json` is the baked on-chain snapshot used for the rarity table and floor price. It is rebuilt from the public TON API:

```bash
python scripts/build_collection_stats.py --all
```

- TON API returns at most 100 items per request, so the script walks the collection in pages and caches each page in `scripts/.cache/`.
- `floorPrice` = the cheapest active `sale` lot among all items (as agreed for this project).
- The scheduled workflow `.github/workflows/refresh-stats.yml` refreshes the snapshot daily at 06:17 UTC and commits it if it changed.

The page itself additionally refreshes supply and owner counters live from `https://tonapi.io/v2/nfts/collections/<address>` on every visit.

## SEO / GEO

- Unique `<title>` and `<meta name="description">` per page, canonical URLs, `hreflang` alternates (`x-default`, `en`, `ru`).
- JSON-LD: `WebSite`, `Organization`, `CollectionPage`, `Product` + `Offer`, `FAQPage`, `BreadcrumbList`, `VisualArtwork`, `SpeakableSpecification` — with stable `@id` references.
- GEO content pattern: answer-first paragraphs, concrete statistics (1000/21/1 items, 97.85/2.05/0.10%, 658 owners, 249 listings, floor 1 TON), citations to TON API / Getgems / Tonviewer, and a Sources block.
- `robots.txt` explicitly allows GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended, Bingbot, Applebot-Extended, CCBot.
- `llms.txt` at the site root for AI discovery; `meta robots` allows snippets (no `max-snippet:-1`).
- All images have descriptive `alt` text; the Dickpaper image is served with a blurred inline preview plus a real progress indicator. Full resolution is `assets/dickpaper-full.webp` (~1.9 MB WebP 8000×8000) instead of the old 21 MB PNG.
- Accessibility: skip-link, `<main id="main">` landmark, labeled controls, heading hierarchy H1→H2→H3.

## Internationalisation

`js/i18n.js` ships 10 languages (en, ru, es, zh, pt, tr, ja, ko, ar, hi). Base strings live in the first dictionary block; project-specific strings (SEO sections, rarity table, Dickpaper page) are merged from the `v2Layer*` objects. `?lang=ru` deep links are supported and persisted to `localStorage`.

## Local preview

```bash
python -m http.server 8080
# open http://localhost:8080/
```

## Brand separation

- **The Way of DHD / Путь ХЧК** — the NFT collection; mark: `assets/logo.svg` (HCHK mark).
- **$DHD** — the fungible jetton; mark: `assets/logo-coin.png`. Contract `EQBCFwW8uFUh-amdRmNY9NyeDEaeDYXd9ggJGsicpqVcHq7B`.