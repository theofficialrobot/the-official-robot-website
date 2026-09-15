# The Official Robot — Grok Build Kickoff

Use this from PowerShell on the desktop copy of the site.
Repo path the CEO is using: `~\the-official-robot-website` (or `~\Desktop\the-official-robot-website`).

---

## 1. One-time install (PowerShell)

```powershell
irm https://x.ai/cli/install.ps1 | iex
grok --version
```

Close and reopen PowerShell after install if `grok` is not found.

---

## 2. Open the site folder and start Grok Build

```powershell
cd $HOME\the-official-robot-website
# if that folder is on Desktop instead:
# cd $HOME\Desktop\the-official-robot-website

Get-ChildItem
grok
```

First launch opens a browser to sign in with the SuperGrok account.

Copy `AGENTS.md` (below, or from this file’s companion section) into the **root of that folder** before the first `grok` session so the agent inherits brand and architecture rules.

Interactive TUI is preferred for this work. Headless one-shot (optional):

```powershell
grok -p @"
PASTE THE FIRST SESSION PROMPT HERE
"@
```

---

## 3. First session prompt — paste into Grok Build

```
You are taking over The Official Robot website in this folder. Do not rebuild from a blank page. Integrate and upgrade the existing site.

COMPANY
The Official Robot (theofficialrobot.com), Huntington Beach, California.
Premier global marketplace, authorized distributor, wholesaler, and retailer of humanoid robots, quadruped robots, aerial robots/drones, and water drones. Primary ambition: become the largest market in the world for used and resale robots.
Five businesses on one platform:
1. Amazon-style marketplace (new + used listings by exact model, plus parts/accessories)
2. Direct distribution and retail
3. Financing (spread + fee revenue)
4. Service and repair
5. Extended warranties

CURRENT CODEBASE (read this first — do not invent a new stack yet)
- index.html — marketing splash / waitlist / category tiles / four pillars (marketplace, financing, service, warranty). On-load splash popup (sessionStorage or_splash_seen_v1). Theme toggle on the aleph mark.
- store.html — Configuration Lab marketplace. Catalog + configurator live in this file. It is large (~1.7MB) because ROBOTS / TYPE_META / model tiles / pricing logic are inlined. Do not delete the catalog.
- imagine_images/ — brand marks, product photos, splash stills. Keep filenames. Official mark is imagine_images/official_robot_mark.svg (themeable). Favicons stay PNG: [The_Official_Robot]_icon_large_square.png and related logo files.
- Shared theme via localStorage key or_theme_v1. Four themes only: cyan-purple (default), yellow-brown, magenta-orange, yellow-green. CSS variables --accent, --accent-bright, --purple, etc. Fonts: Inter + Space Grotesk.
- Platform type picker lives in a themed .sub-nav-bar. Configurator steps are 1–5 starting at Select Platform. Default type is humanoid.
- Model tiles: branded cyan→purple checker on check-brand cells; check-white is plain white. paintModelCheckers() + ResizeObserver. Product photos sit on --model-photo.
- Display-name standard: [Manufacturer] Model (Year).
- Types in catalog: humanoid, companionoid, hand (parts/accessories — not mixed into All_Platforms conceptually), quadruped, aerial, marine.
- Robopedia / #fleet carousel was removed. Do not bring it back unless I explicitly ask.

HARD RULES
- Respect existing color tokens, logos, aleph mark, and clean modern design. No new random palette.
- Do not drop or rewrite the ROBOTS catalog as dummy products. Preserve IDs, names, prices, images, shortDescs, type mapping.
- Do not add README clutter, package.json, React, Vite, Next, Tailwind, or a backend unless I approve that step. First pass stays static HTML/CSS/JS that opens locally.
- Keep the site usable by opening index.html / store.html in a browser (relative paths).
- Accessibility, mobile nav, and theme persistence must survive every change.
- Speak and implement as the CEO of The Official Robot: marketplace liquidity, trust, used-robot dominance, financing + warranty + service attach.

YOUR FIRST JOB (do this in order)
1. Inventory the folder. Summarize files, what index.html and store.html each own, and the biggest structural risks (especially the store.html monolith).
2. Propose a phased upgrade plan. Do not start a rewrite until I approve the plan.
   Phase targets I already want:
   A. Shared design system extracted so index + store + future pages share one CSS/theme/nav/footer (no duplicated 400-line :root blocks).
   B. Split store.html: keep behavior, move catalog data to a data file (e.g. data/robots.js or data/robots.json) so the page is editable.
   C. Real multi-page site IA:
      - index.html (home)
      - store.html (configure / buy)
      - news.html (Robotics News — curated industry news)
      - partners.html (Partnership Opportunities — US + Vietnam manufacturing incentives)
      - financing.html, service.html, warranty.html, sell.html (used/resale listing flow)
   D. Marketplace features that make us the used-robot market: condition grades, certified pre-owned, seller listing by exact model SKU, watchlist, compare, request-financing CTA on every configured build.
   E. Performance: store.html must not stay a 1.7MB single file.
3. After the inventory, wait for my approval of the plan. Then execute Phase A only unless I say otherwise.

If AGENTS.md exists in this repo, follow it. If it does not, create it at the repo root with these rules before you edit pages.
```

---

## 4. AGENTS.md to place at the repo root

Save as `AGENTS.md` next to `index.html` and `store.html`.

```markdown
# The Official Robot — website conventions

Company: The Official Robot, Huntington Beach, California. Site: theofficialrobot.com
Marketplace + distributor + retailer for humanoid, quadruped, aerial, and marine robots. Goal: largest used/resale robot market on earth. Also: parts, financing, service, extended warranties.

## Stack
- Static HTML/CSS/JS unless the CEO explicitly approves a bundler or backend.
- Pages must open locally via relative paths.
- Do not introduce React, Next, Vite, Tailwind, or npm tooling without approval.

## Brand
- Fonts: Inter + Space Grotesk.
- Themes via localStorage `or_theme_v1`: cyan-purple, yellow-brown, magenta-orange, yellow-green.
- Tokens: --accent #0891b2, --accent-bright #06b6d4, --purple #7c3aed, --green #059669, white/#f8fafc/#f1f5f9 surfaces, text #0f172a / #475569.
- Aleph mark: imagine_images/official_robot_mark.svg. Favicons remain PNG in imagine_images/.
- Display names: [Manufacturer] Model (Year).

## Architecture
- index.html = splash / brand / waitlist / pillars.
- store.html = Configuration Lab. Catalog data is sacred — never replace ROBOTS with placeholders.
- Hands are parts/accessories (type hand), not a peer robot class in positioning.
- Default type: humanoid. Type picker is the sub-nav, not configurator step 1.
- Do not revive Robopedia / #fleet carousel.

## Product priorities
Used-robot liquidity, exact-model listing, financing attach, warranty attach, service, trust.
Planned pages: news, partners (US + Vietnam manufacturing incentives), financing, service, warranty, sell.

## Edit rules
- Improve; do not throw away working UI.
- Keep theme toggle, splash popup behavior, model-tile checker logic, and image filenames.
- After structural splits, verify index.html and store.html still load and theme together.
```

---

## 5. Follow-up prompts (after inventory)

Use these in later Grok Build turns, one phase at a time.

**Phase A — shared shell**
```
Execute Phase A only. Extract shared theme CSS, nav, footer, and aleph mark into reusable files (css/theme.css, js/theme.js, partials or a small include pattern that still works when opening files locally — prefer linked CSS/JS over a build step). index.html and store.html must use the same shell. Do not touch catalog data.
```

**Phase B — split catalog**
```
Execute Phase B only. Move ROBOTS, TYPE_META, and related catalog constants out of store.html into data/robots.js (or json + loader). store.html must load that file and behave identically. Keep every SKU, image path, price, and shortDesc.
```

**Phase C — partners + news shells**
```
Add news.html and partners.html using the shared shell. partners.html should sell US + Vietnam manufacturing / technology partnership: incentives, site selection, why list and build through The Official Robot. news.html is a curated robotics news layout with placeholder stories we can replace. Link both from nav.
```

**Phase D — used marketplace**
```
Add sell.html and a condition/CPO layer on configured platforms: New, Like New, Certified Pre-Owned, Used. Seller lists by exact model SKU from the catalog. Financing and warranty CTAs on the build summary.
```
