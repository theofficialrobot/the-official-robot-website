const TOKEN_KEY = 'or_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function fail(res, data, fallback) {
  const err = new Error(data.error || data.message || fallback);
  err.status = res.status;
  err.code = data.code
    || (data.error === 'EMAIL_UNVERIFIED' ? 'EMAIL_UNVERIFIED' : undefined)
    || (data.error === 'KYC_REQUIRED' ? 'KYC_REQUIRED' : undefined);
  err.data = data;
  return err;
}

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw fail(res, data, 'Request failed');
  return data;
}

export async function apiUpload(path, formData, { method = 'POST' } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  // Browser sets multipart boundary — do not set Content-Type.
  const res = await fetch(path, { method, headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw fail(res, data, 'Upload failed');
  return data;
}

export function mediaUrl(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  return data.url || data.path || data.image || data.src || data.href || '';
}

export function isUnverifiedError(err) {
  if (!err) return false;
  if (err.code === 'EMAIL_UNVERIFIED') return true;
  if (err.status === 403 && /unverified|verify your email/i.test(String(err.message || ''))) return true;
  return false;
}

export function isNotFound(err) {
  return Boolean(err && err.status === 404);
}

export function isKycRequired(err) {
  if (!err) return false;
  if (err.code === 'KYC_REQUIRED') return true;
  if (err.status === 403 && /kyc/i.test(String(err.message || '') + ' ' + String(err.code || ''))) return true;
  return false;
}

export function isKycEmpty(payload) {
  if (payload == null) return true;
  const kyc = payload.kyc !== undefined ? payload.kyc : payload;
  if (!kyc || typeof kyc !== 'object') return true;
  const status = String(kyc.status || kyc.state || '').toLowerCase();
  if (['approved', 'verified', 'submitted', 'pending', 'review', 'in_review', 'complete', 'completed'].includes(status)) {
    return false;
  }
  const first = kyc.firstName || kyc.first_name;
  const last = kyc.lastName || kyc.last_name;
  if (first && last) return false;
  if (kyc.legalCompanyName || kyc.legal_company_name || kyc.companyName || kyc.company_name) return false;
  if (kyc.id || kyc.documentUrl || kyc.document_url || kyc.identityDocument || kyc.formationDocumentUrl) return false;
  const keys = Object.keys(kyc).filter((k) => kyc[k] != null && kyc[k] !== '' && k !== 'kind');
  return keys.length === 0 || (keys.length === 1 && (keys[0] === 'ok' || keys[0] === 'success'));
}

export function imageSrc(image) {
  if (!image) return '';
  const path = image.startsWith('/') ? image : '/' + image;
  return encodeURI(path);
}

export function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function priceInfo(robot) {
  const sale = Number(robot && robot.price) || 0;
  const listRaw = robot && (robot.listPrice != null ? robot.listPrice : robot.list_price);
  const listNum = Number(listRaw);
  const list = Number.isFinite(listNum) && listNum > 0 ? listNum : sale;
  let pct = Number(robot && (robot.discountPct != null ? robot.discountPct : robot.discount_pct));
  if (!Number.isFinite(pct) || pct <= 0) {
    pct = list > sale && sale >= 0 ? Math.round((1 - sale / list) * 100) : 0;
  } else {
    pct = Math.round(pct);
  }
  const hasDiscount = pct > 0 && list > sale;
  return { sale, list, discount: hasDiscount ? pct : 0, hasDiscount };
}

export const TYPES = [
  { id: '', label: 'All platforms' },
  { id: 'humanoid', label: 'Humanoid' },
  { id: 'campanionoid', label: 'Campanionoid' },
  { id: 'aerial', label: 'Aerial' },
  { id: 'water', label: 'Water' },
  { id: 'hand', label: 'Hands / parts' }
];

export const CONDITIONS = [
  { id: '', label: 'Any condition' },
  { id: 'new', label: 'New' },
  { id: 'cpo', label: 'Certified pre-owned' },
  { id: 'used', label: 'Used' }
];

export const ITEM_CONDITIONS = [
  { id: 'excellent', label: 'Excellent' },
  { id: 'very_good', label: 'Very good' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
  { id: 'poor', label: 'Poor' }
];

export function conditionLabel(id) {
  if (id === 'like_new') return 'Used';
  return (CONDITIONS.find((c) => c.id === id) || {}).label || id || 'New';
}

export function itemConditionLabel(id) {
  if (!id) return '';
  const key = String(id).toLowerCase().replace(/\s+/g, '_');
  if (key === 'like_new') return 'Excellent';
  return (ITEM_CONDITIONS.find((c) => c.id === key) || {}).label || id;
}

export function typeLabel(id) {
  return (TYPES.find((t) => t.id === id) || {}).label || id || '';
}

export const FALLBACK_WARRANTY_PLANS = [
  { id: 'mfr', name: 'Manufacturer', pricePct: 0, years: 0 },
  { id: '1yr', name: '1yr 10%', pricePct: 0.10, years: 1 },
  { id: '2yr', name: '2yr 17%', pricePct: 0.17, years: 2 },
  { id: '3yr', name: '3yr 24%', pricePct: 0.24, years: 3 }
];

export function warrantyPct(warrantyId, plans = FALLBACK_WARRANTY_PLANS) {
  const plan = (plans || []).find((p) => p.id === warrantyId);
  let pct = plan && Number.isFinite(Number(plan.pricePct)) ? Number(plan.pricePct) : NaN;
  if (!Number.isFinite(pct)) {
    if (warrantyId === '1yr') pct = 0.10;
    else if (warrantyId === '2yr') pct = 0.17;
    else if (warrantyId === '3yr') pct = 0.24;
    else pct = 0;
  }
  if (pct > 1) pct = pct / 100;
  return pct;
}

export function warrantyAmount(price, qty, warrantyId, plans) {
  return Math.round((Number(price) || 0) * (qty || 1) * warrantyPct(warrantyId, plans));
}

export function warrantyTermLabel(plan) {
  if (!plan) return '';
  const years = Number(plan.years);
  if (Number.isFinite(years) && years > 0) return years === 1 ? '1 year' : years + ' years';
  if (plan.id === 'mfr' || !plan.pricePct) return 'Manufacturer standard';
  return String(plan.name || plan.id).replace(/\s+\d+%.*$/, '').trim();
}

export function warrantyOptionLabel(plan) {
  return warrantyTermLabel(plan);
}

export function warrantyTermPriceLabel(plan, amount) {
  const years = Number(plan && plan.years);
  let term;
  if (Number.isFinite(years) && years > 0) {
    term = years === 1 ? '1 year' : years + ' years';
  } else {
    term = (plan && plan.name) ? String(plan.name).replace(/\s+\d+%.*$/, '').trim() : 'Manufacturer';
  }
  return term + ' — ' + money(amount);
}

export async function fetchCatalog() {
  try {
    const d = await api('/api/catalog');
    const robots = Array.isArray(d.robots) ? d.robots : [];
    const warrantyPlans = Array.isArray(d.warrantyPlans) && d.warrantyPlans.length
      ? d.warrantyPlans
      : FALLBACK_WARRANTY_PLANS;
    return { robots, warrantyPlans };
  } catch {
    return { robots: [], warrantyPlans: FALLBACK_WARRANTY_PLANS };
  }
}

export async function fetchRobotsByIds(ids) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  const results = await Promise.all(unique.map((id) =>
    api('/api/robots/' + encodeURIComponent(id))
      .then((d) => d.robot)
      .catch(() => null)
  ));
  const byId = new Map(results.filter(Boolean).map((r) => [String(r.id), r]));
  return unique.map((id) => byId.get(id)).filter(Boolean);
}
