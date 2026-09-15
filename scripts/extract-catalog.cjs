const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'store.html'), 'utf8').split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

const robots = slice(191, 30738);
const maker = slice(30740, 30991);
const addons = slice(30993, 31507);
const warranty = slice(31527, 31532);
const typeMeta = slice(31606, 31612);

const header = `(function (root, factory) {
  var catalog = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = catalog;
  } else {
    root.OR_CATALOG = catalog;
    root.ROBOTS = catalog.ROBOTS;
    root.MAKER_ORIGIN = catalog.MAKER_ORIGIN;
    root.ADDONS = catalog.ADDONS;
    root.WARRANTY_PLANS = catalog.WARRANTY_PLANS;
    root.TYPE_META = catalog.TYPE_META;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
`;

const footer = `
  return { ROBOTS, MAKER_ORIGIN, ADDONS, WARRANTY_PLANS, TYPE_META };
});
`;

fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'data', 'robots.js'),
  header + '\n' + robots + '\n\n' + maker + '\n\n' + addons + '\n\n' + warranty + '\n\n' + typeMeta + footer,
  'utf8'
);

let store = slice(31508, 32502);
store = store.replace(/\/\*\*[\s\S]*?\*\/\r?\nconst WARRANTY_PLANS = \{[\s\S]*?\};\r?\n\r?\n/, '');
store = store.replace(/\r?\nconst TYPE_META = \{[\s\S]*?\};\r?\n/, '\n');
store = store.replace(/\r?\nlet currentAddonFilter = 'All';[\s\S]*?function populateInterestSelect\(\) \{[\s\S]*?\}\r?\n/, '\n');
store = store.replace(/\s*renderAddonCatalogForCurrent\(\);/g, '');

const persist = `const LAB_CART_KEY = 'or_lab_cart_v1';
function loadLabCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAB_CART_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}
function saveLabCart() {
  try { localStorage.setItem(LAB_CART_KEY, JSON.stringify(state.cart || [])); } catch (e) {}
}

`;
store = persist + store;
store = store.replace('cart: []', 'cart: loadLabCart()');
store = store.replace(
  '    total: basePrice + colorPremium + addonsTotal + warrantyPrice\n  });\n  renderCart();',
  '    total: basePrice + colorPremium + addonsTotal + warrantyPrice\n  });\n  saveLabCart();\n  renderCart();'
);
store = store.replace(
  '  state.cart.splice(i, 1);\n  renderCart();',
  '  state.cart.splice(i, 1);\n  saveLabCart();\n  renderCart();'
);

fs.writeFileSync(path.join(root, 'js', 'store.js'), store + '\n', 'utf8');

const catalog = require(path.join(root, 'data', 'robots.js'));
const types = {};
for (const r of Object.values(catalog.ROBOTS)) {
  types[r.type] = (types[r.type] || 0) + 1;
}
console.log('robots.js', fs.statSync(path.join(root, 'data', 'robots.js')).size);
console.log('store.js', fs.statSync(path.join(root, 'js', 'store.js')).size);
console.log('SKU count', Object.keys(catalog.ROBOTS).length);
console.log('types', types);
console.log('TYPE_META', Object.keys(catalog.TYPE_META));
console.log('ADDONS', Object.keys(catalog.ADDONS).length);
console.log('WARRANTY', Object.keys(catalog.WARRANTY_PLANS));
console.log('go2', catalog.ROBOTS.go2 && catalog.ROBOTS.go2.name);
