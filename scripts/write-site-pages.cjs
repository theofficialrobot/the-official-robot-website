const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function page({ file, title, desc, dataPage, body }) {
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="cyan-purple">
<head>
<meta charset="UTF-8">
<script>
(function () {
  try {
    var t = localStorage.getItem('or_theme_v1');
    if (t === 'orange-magenta') t = 'magenta-orange';
    if (t === 'leo' || t === 'gemini' || t === 'capricorn') t = 'yellow-brown';
    if (t === 'sagittarius' || t === 'libra' || t === 'scorpio' || t === 'aries') t = 'magenta-orange';
    if (t === 'cyan-purple' || t === 'yellow-brown' || t === 'magenta-orange' || t === 'yellow-green') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="icon" type="image/png" href="imagine_images/[The_Official_Robot]_icon_large_square.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/theme.css">
<link rel="stylesheet" href="css/shell.css">
<link rel="stylesheet" href="css/pages.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<script src="js/theme.js"></script>
<script src="js/nav.js"></script>
<script src="js/shell.js" data-page="${dataPage}"></script>
<main id="main" class="page-copy">
  <div class="container">
${body}
  </div>
</main>
<footer id="or-footer"></footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, file), html, 'utf8');
  console.log('wrote', file);
}

page({
  file: 'news.html',
  title: 'Robotics News — The Official Robot™',
  desc: 'Robotics news for buyers, sellers, and operators. Huntington Beach, California.',
  dataPage: 'home',
  body: `<p class="kicker">Robotics News</p>
<h1>Signal from the robot economy</h1>
<p class="lead">We cover platform launches, used-market liquidity, and the service stack that makes ownership bankable — not press-release theater.</p>
<div class="page-grid">
  <article class="page-card"><h3>Used humanoids need a real market</h3><p>List by exact model SKU. Condition grades and Official Robot certification are how resale becomes liquid.</p></article>
  <article class="page-card"><h3>Attach is the margin</h3><p>Financing, warranty, and service on every build — new or pre-owned — is how this platform compounds.</p></article>
  <article class="page-card"><h3>Huntington Beach, global catalog</h3><p>Authorized distribution plus a public marketplace. Configure in the lab, transact in the market.</p></article>
</div>
<a class="page-cta" href="http://127.0.0.1:5173/">Open the live marketplace</a>`
});

page({
  file: 'partners.html',
  title: 'Partners — US + Vietnam — The Official Robot™',
  desc: 'US and Vietnam manufacturing and technology partnership. Incentives to build and list through The Official Robot.',
  dataPage: 'home',
  body: `<p class="kicker">Partners</p>
<h1>Build in the US. Scale in Vietnam. Sell everywhere.</h1>
<p class="lead">We partner with manufacturers and technology houses that want North American distribution plus a used-robot aftermarket that does not exist anywhere else.</p>
<h2>United States</h2>
<p>Huntington Beach headquarters. Authorized distributor and retailer. We structure channel, financing, warranty, and service so US buyers can acquire with confidence.</p>
<h2>Vietnam</h2>
<p>Manufacturing and technology partnership for cost, speed, and export. Incentives for partners who list new platforms and take back used units through our SKU catalog.</p>
<div class="page-grid">
  <div class="page-card"><h3>Why list with us</h3><p>Exact-model catalog. Global demand. Attach revenue on finance, service, and protection plans.</p></div>
  <div class="page-card"><h3>Why build with us</h3><p>A resale channel from day one. That is the difference between a product launch and a market.</p></div>
</div>
<a class="page-cta" href="mailto:hello@theofficialrobot.com?subject=Partnership%20Inquiry">Talk partnerships</a>`
});

page({
  file: 'financing.html',
  title: 'Financing — The Official Robot™',
  desc: 'Structured robot financing. Spread plus fee revenue. Request terms on any configured build.',
  dataPage: 'home',
  body: `<p class="kicker">Financing</p>
<h1>Acquire the platform. Spread the capital.</h1>
<p class="lead">High-intent buyers should not wait for a wire on a six-figure humanoid. We structure terms aligned with how platforms are actually delivered — and we earn on spread plus fee.</p>
<ul>
  <li>Request financing on every configured build in the marketplace.</li>
  <li>New, like new, certified pre-owned, and used — attach is not only for OEM-new units.</li>
  <li>Quote confirms landed cost, duties, and term. Estimates in the catalog are not a contract.</li>
</ul>
<a class="page-cta" href="http://127.0.0.1:5173/">Request financing on a listing</a>`
});

page({
  file: 'service.html',
  title: 'Service & Repair — The Official Robot™',
  desc: 'Professional service and repair for platforms sold through The Official Robot.',
  dataPage: 'home',
  body: `<p class="kicker">Service &amp; repair</p>
<h1>Support that continues after delivery</h1>
<p class="lead">A marketplace without service is a classifieds site. We service platforms sold here — parts, diagnostics, and repair — so used units stay in the fleet instead of becoming scrap.</p>
<div class="page-grid">
  <div class="page-card"><h3>Sold through us</h3><p>Priority service for units with Official Robot transaction history.</p></div>
  <div class="page-card"><h3>Parts aisle</h3><p>Hands and end-effectors live as accessories, listed by exact SKU next to the host platform.</p></div>
</div>
<a class="page-cta" href="mailto:hello@theofficialrobot.com?subject=Service%20and%20Repair">Book service</a>`
});

page({
  file: 'warranty.html',
  title: 'Extended Warranties — The Official Robot™',
  desc: 'Manufacturer coverage plus Official Robot Protection Plans on new and used robots.',
  dataPage: 'home',
  body: `<p class="kicker">Extended warranties</p>
<h1>Protect the asset. Keep it liquid.</h1>
<p class="lead">Manufacturer terms first. Then Official Robot Protection Plans — 1, 2, or 3 years — priced as a percent of configuration so used and new attach the same way.</p>
<ul>
  <li>1-year plan: 10% of configuration</li>
  <li>2-year plan: 17% of configuration</li>
  <li>3-year plan: 24% of configuration (lab default)</li>
</ul>
<p>Calibrated for robotics claim incidence, not consumer electronics folklore. Confirm on formal quote.</p>
<a class="page-cta" href="store.html">Add protection in the Configuration Lab</a>`
});

page({
  file: 'sell.html',
  title: 'Sell a robot — The Official Robot™',
  desc: 'List used and resale robots by exact model SKU. The Official Robot marketplace.',
  dataPage: 'sell',
  body: `<p class="kicker">Sell · used-robot liquidity</p>
<h1>List by exact model. Not “robot dog.”</h1>
<p class="lead">The largest resale market in robotics will be the one that refuses free-text junk. You pick the manufacturer and model from the catalog, grade condition, and publish.</p>
<div class="page-grid">
  <div class="page-card"><h3>New</h3><p>Authorized and direct. Same SKU as the lab.</p></div>
  <div class="page-card"><h3>Like new / CPO</h3><p>Inspected, documented, Official Robot badge on certified pre-owned.</p></div>
  <div class="page-card"><h3>Used</h3><p>Honest grade. Financing and warranty still attach.</p></div>
</div>
<a class="page-cta" href="http://127.0.0.1:5173/add">List a robot in the marketplace</a>
<p style="margin-top:16px;font-size:0.85rem;">Sign in required to publish. Anyone can browse.</p>`
});
