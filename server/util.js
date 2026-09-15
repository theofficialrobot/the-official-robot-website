const crypto = require('crypto');

function safe(handler) {
  return (req, res, next) => {
    try {
      const out = handler(req, res, next);
      if (out && typeof out.then === 'function') out.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function parseIntId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function sanitizeRobotId(value) {
  const id = String(value || '');
  if (!id || id.length > 120 || id.includes('..') || id.includes('\0') || /[\\/]/.test(id)) return null;
  return id;
}

function pageParams(query, fallbackLimit, maxLimit) {
  const cap = maxLimit || 200;
  const def = fallbackLimit || 50;
  const limit = Math.min(cap, Math.max(1, Number(query && query.limit) || def));
  const offset = Math.max(0, Number(query && query.offset) || 0);
  return { limit, offset };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function newVerifyToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

function isSafePathToken(value) {
  const s = String(value || '').trim();
  return !(!s || s.length > 500 || s.includes('..') || s.includes('\\') || s.includes('\0'));
}

function isSafeUploadUrl(value) {
  const s = String(value || '').trim();
  if (!isSafePathToken(s)) return false;
  if (s.startsWith('/uploads/') && !s.includes('//')) return true;
  try {
    const url = new URL(s);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalUploadUrl(value) {
  const s = String(value || '').trim();
  return isSafePathToken(s) && s.startsWith('/uploads/') && !s.includes('//');
}

function isSafeMediaUrl(value) {
  const s = String(value || '').trim();
  if (!isSafePathToken(s)) return false;
  if (s.startsWith('/uploads/') && !s.includes('//')) return true;
  if (s.startsWith('imagine_images/') || s.startsWith('/imagine_images/')) return true;
  try {
    const url = new URL(s);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const PUBLIC_MAIL_ORGS = new Set([
  'gmail', 'googlemail', 'yahoo', 'ymail', 'outlook', 'hotmail', 'live', 'msn',
  'icloud', 'me', 'aol', 'protonmail', 'proton', 'gmx', 'yandex', 'mail', 'zoho',
  'hey', 'fastmail'
]);

function emailDomain(email) {
  const at = String(email || '').lastIndexOf('@');
  if (at < 0) return '';
  let domain = String(email).slice(at + 1).trim().toLowerCase();
  if (domain.startsWith('www.')) domain = domain.slice(4);
  return domain;
}

function companySlug(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

function orgLabel(domain) {
  const parts = String(domain || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  const secondLevel = new Set(['co', 'com', 'org', 'net', 'ac', 'gov']);
  if (parts.length >= 3 && secondLevel.has(parts[parts.length - 2])) {
    return parts[parts.length - 3];
  }
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || '';
}

function isPublicMailDomain(domain) {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return true;
  return PUBLIC_MAIL_ORGS.has(orgLabel(d));
}

function domainMatchesCompany(domain, companyName, companyDomain) {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return false;
  if (companyDomain) {
    let cd = String(companyDomain).trim().toLowerCase();
    cd = cd.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (cd) {
      const same =
        d === cd ||
        d.endsWith('.' + cd) ||
        companySlug(orgLabel(d)) === companySlug(orgLabel(cd)) ||
        companySlug(d) === companySlug(cd);
      if (same) return true;
    }
  }
  const slug = companySlug(companyName);
  if (!slug || slug.length < 2) return false;
  const org = companySlug(orgLabel(d));
  const first = companySlug(d.split('.')[0]);
  const withoutTld = companySlug(d.replace(/\.[^.]+$/, ''));
  return org === slug || first === slug || withoutTld === slug;
}

function parseIsoDate(value) {
  const s = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  if (y < 1900 || y > 2100) return null;
  return s;
}

function ageYears(isoDate) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return -1;
  const [y, m, d] = parsed.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  const nm = now.getMonth() + 1;
  const nd = now.getDate();
  if (nm < m || (nm === m && nd < d)) age -= 1;
  return age;
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeBrand(value) {
  return normalizeName(value)
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(incorporated|corporation|limited|company|inc|llc|ltd|co|corp)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function brandsMatch(a, b) {
  const x = normalizeBrand(a);
  const y = normalizeBrand(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function constraintName(err) {
  return String((err && err.message) || '');
}

module.exports = {
  safe,
  parseJson,
  parseIntId,
  sanitizeRobotId,
  pageParams,
  hashToken,
  newVerifyToken,
  isSafeUploadUrl,
  isLocalUploadUrl,
  isSafeMediaUrl,
  emailDomain,
  companySlug,
  isPublicMailDomain,
  domainMatchesCompany,
  parseIsoDate,
  ageYears,
  normalizeName,
  normalizeBrand,
  brandsMatch,
  constraintName
};
