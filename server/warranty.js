const path = require('path');
const catalog = require(path.join(__dirname, '..', 'data', 'robots.js'));

const DEFAULT_WARRANTY_PLANS = [
  { id: 'mfr', name: 'Manufacturer standard', pricePct: 0, years: 0 },
  { id: '1yr', name: '1-Year Protection Plan', pricePct: 0.10, years: 1 },
  { id: '2yr', name: '2-Year Protection Plan', pricePct: 0.17, years: 2 },
  { id: '3yr', name: '3-Year Protection Plan', pricePct: 0.24, years: 3 }
];

function warrantyPlans() {
  const src = catalog.WARRANTY_PLANS;
  return DEFAULT_WARRANTY_PLANS.map((fallback) => {
    const plan = src && src[fallback.id];
    if (!plan) return Object.assign({}, fallback);
    return {
      id: fallback.id,
      name: plan.name || fallback.name,
      pricePct: Number(plan.pricePct) || 0,
      years: Number(plan.years) || 0
    };
  });
}

function parseServiceRequested(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function attachWarranty(body, unitPrice, qty) {
  const raw = body && body.warrantyId;
  const id = String(raw == null || raw === '' ? 'mfr' : raw).trim();
  const plan = warrantyPlans().find((p) => p.id === id);
  if (!plan) {
    const err = new Error('Warranty plan must be mfr, 1yr, 2yr, or 3yr.');
    err.status = 400;
    throw err;
  }
  const nQty = Math.max(1, Number(qty) || 1);
  const price = Number(unitPrice) || 0;
  return {
    warrantyId: plan.id,
    warrantyPrice: Math.round(price * nQty * plan.pricePct),
    serviceRequested: parseServiceRequested(body && body.serviceRequested)
  };
}

module.exports = { warrantyPlans, attachWarranty, parseServiceRequested };
