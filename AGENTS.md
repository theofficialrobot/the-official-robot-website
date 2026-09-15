```markdown
# The Official Robot — website conventions

Company: The Official Robot, Huntington Beach, California. Site: theofficialrobot.com
Marketplace + distributor + retailer for humanoid, quadruped, aerial, and marine robots. Goal: largest used/resale robot market on earth. Also: parts, financing, service, extended warranties.

## Stack
- Two surfaces: static Configuration Lab (`index.html`, `store.html`) and the approved marketplace app (`client/` Vite+React+Tailwind, `server/` Express + better-sqlite3, JWT + bcryptjs).
- `npm.cmd install` then `npm.cmd run dev` → API :3001, web http://127.0.0.1:5173. Do not delete the static lab.
- Current plan: `PLAN.md`. Phases A, B, M0, C, D, and E are done. Do not start a new phase unless the CEO asks.
- Catalog source of truth: `data/robots.js` (classic script + Node `module.exports`). `store.html` loads it with `js/store.js`. `server/seed.js` requires it. Never replace the catalog with dummy products.

## Brand
- Fonts: Inter + Space Grotesk.
- Themes via localStorage `or_theme_v1`: cyan-purple, yellow-brown, magenta-orange, yellow-green.
- Tokens: --accent #0891b2, --accent-bright #06b6d4, --purple #7c3aed, --green #059669, white/#f8fafc/#f1f5f9 surfaces, text #0f172a / #475569.
- Themeable aleph path: `imagine_images/official_robot_mark.svg`. Same glyph, two nav treatments — do not merge them: home is an open gradient fill (`url(#orMarkGrad)`); store is a cyan→purple checker tile with a white aleph. Do not swap either for a raster `<img>`. Favicon: `imagine_images/[The_Official_Robot]_icon_large_square.png`. OG/share: `imagine_images/[The_Official_Robot]_logo_square.png`. Press wordmarks: `_logo.png` / `_logo.jpg` (not themed UI).
- Display names: [Manufacturer] Model (Year).

## Architecture
- Shared shell (Phase A): `css/theme.css`, `css/shell.css`, `js/theme.js`, `js/nav.js`, `js/shell.js`. Page CSS: `css/home.css`, `css/store.css`. Tiny FOUC theme sniffer stays inline in each `<head>`.
- index.html = splash / brand / waitlist / pillars.
- store.html = Configuration Lab. Live `ROBOTS` keys are the marketplace catalog — never replace with placeholders.
- `Robot_Platforms_Humanoid_Air_Sea_Adult_August2026.xlsx` is the research workbook (humanoid.guide + AIXZD + TAAFT + store merge). Do not load it in the browser. Column A `Website ID` maps to `ROBOTS` keys. Blank ID = not on the site yet. Type keys: humanoid, campanionoid, aerial, water, hand.
- Hands are parts/accessories (type hand), not a peer robot class in positioning.
- Default type: humanoid. Type picker is the sub-nav, not configurator step 1.
- Do not revive Robopedia / #fleet carousel.

## Product priorities
Used-robot liquidity, exact-model listing, financing attach, warranty attach, service, trust.
Marketplace app already: Home, detail, add/sell, login, register, cart, account, search, new/used/CPO/like-new, financing CTA.
Phase C pages exist on both surfaces. Phase D: sell by catalog SKU, CPO inspection notes, watchlist/compare, warranty+service attach on cart. Hands are parts, not a peer class on marketing home. Phase E: lazy lab/marketplace photos; large catalog webps compressed in place.

## Edit rules
- Improve; do not throw away working UI.
- Keep theme toggle, splash popup behavior, model-tile checker logic, and image filenames.
- After structural splits, verify index.html and store.html still load and theme together.
```