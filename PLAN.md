# The Official Robot — current plan

Company: The Official Robot, Huntington Beach, California. theofficialrobot.com  
Five businesses, one platform: Amazon-style marketplace (new + used + parts) · direct distribution · financing · service · extended warranties. Ambition: largest used/resale robot market on earth.

This plan continues from Phase A. It includes the later CEO requests: unique home vs store aleph treatments, and an approved full-stack marketplace (Vite + React + Tailwind, Express, SQLite, JWT + bcrypt). Do not throw away the static Configuration Lab. Do not dummy the catalog.

Execute one phase at a time after CEO approval.

---

## Two surfaces (keep both)

| Surface | Role | How it opens |
|---|---|---|
| **Static site** | Brand splash, waitlist, Configuration Lab | `index.html` / `store.html` in a browser (relative paths) |
| **Marketplace app** | Amazon/Alibaba-style buy & sell | `npm.cmd run dev` → http://127.0.0.1:5173 (API :3001) |

Same company, same catalog, same tokens. Unique aleph treatments stay unique: **home = open gradient mark**; **store / sell = checker tile, white aleph**. Do not merge them.

---

## Done

### Phase A — shared static shell
`css/theme.css`, `css/shell.css`, `js/theme.js`, `js/nav.js`, `js/shell.js`. Four themes via `or_theme_v1`. Splash (`or_splash_seen_v1`). Mobile nav. Configurator tiles and `paintModelCheckers()` still live.

### Phase B — one catalog file, two consumers
`data/robots.js` holds `ROBOTS` (444), `TYPE_META`, `ADDONS`, `MAKER_ORIGIN`, `WARRANTY_PLANS`. `store.html` is ~10 KB and loads `data/robots.js` + `js/store.js`. Seed reads the same file. Lab cart persists in `localStorage` (`or_lab_cart_v1`). Dead `addonCatalog` / `interestSelect` removed.

### Phase M0 — marketplace v1 (requested stack)
`client/` Vite React Tailwind. `server/` Express + better-sqlite3 + JWT. Password hashing is bcrypt via `bcryptjs` (native `bcrypt` would not compile on this Node 24 machine without Python).

Seeded **444 real SKUs** from `store.html` (plus member listings). Routes: `/` Home, `/robots/:id` Detail, `/add` Add Robot, `/login`, `/register`, plus `/cart` and `/account`. Public browse + search by title/specs. Auth to sell (new / like new / CPO / used) and to buy. Humanoid is the default aisle. Financing CTA on the configured build. Related listings on detail.

### Phase C — information architecture
Static pages on the Phase A shell: `news.html`, `partners.html`, `financing.html`, `service.html`, `warranty.html`, `sell.html` + `css/pages.css`. Nav and footer link all of them. React routes `/news /partners /financing /service /warranty /sell`. Home category tiles deep-link Configuration Lab (`store.html?type=`) and marketplace (`/?type=`). Pillars route to marketplace, financing, service, warranty.

Catalog photos: 42 Downloads webps copied into `imagine_images/` under the bot display names. Shared frames stay shared (OceanAlpha pairs, VideoRay quartet, Xiaomi CyberDog 2/Pro). Old PNG/webp replacements deleted.

---

### Phase D — used-robot market
Sell by exact catalog SKU (`GET /api/catalog`, `POST /api/robots` with `catalogId`). CPO requires inspection notes; badge on card/detail. Watchlist + compare in `localStorage` (`or_watch_v1`, `or_compare_v1`). Cart attaches warranty (mfr / 10% / 17% / 24%) and service request; checkout stores `warranty_id`, `warranty_price`, `service_requested`. Hands are a parts aisle on marketing home (strip under the four classes), not a peer of Humanoid.

---

### Phase E — performance
Lab tiles: first 16 photos eager, rest `data-src` + IntersectionObserver (`js/store.js`). Marketplace listing/card thumbs `loading="lazy"`; detail hero eager. 13 large product webps compressed in place (same filenames); `/imagine_images` Cache-Control 1 day. Did not add Vite to the static lab.

---

## Next (in order)

Phase E is done. Further work only if the CEO asks (deploy, more research-workbook SKUs, or polish).

---

## Hard rules (every phase)
- Integrate; do not rebuild from a blank page.
- Never replace `ROBOTS` with dummy products.
- Four themes only. Inter + Space Grotesk. Existing color tokens.
- Default type: humanoid. Type picker is the sub-nav on the lab, not configurator step 1.
- Do not revive Robopedia / `#fleet`.
- Accessibility, mobile nav, theme persistence survive every change.
- Use `npm.cmd` on this machine (`npm.ps1` is execution-policy blocked). Bind the web app so `http://127.0.0.1:5173` works (not IPv6-only).

---

### Phase C — information architecture
Static pages on the Phase A shell: `news.html`, `partners.html`, `financing.html`, `service.html`, `warranty.html`, `sell.html`. Matching React routes on the marketplace app. Nav and footer point at real pages.

## Suggested next execution
**Phase D** (SKU picker on sell, CPO badge, watchlist/compare, warranty+service attach) unless the CEO says otherwise.
