const jwt = require('jsonwebtoken');
const { db } = require('../db');

function secret() {
  return process.env.JWT_SECRET || 'or-dev-secret-change-me';
}

function isCompanyAccount(accountType) {
  return accountType === 'reseller' || accountType === 'manufacturer';
}

function splitNames(row) {
  const first = String(row.first_name || '').trim();
  const last = String(row.last_name || '').trim();
  if (first || last) return { firstName: first, lastName: last };
  if (isCompanyAccount(row.account_type)) return { firstName: '', lastName: '' };
  const name = String(row.name || '').trim();
  const i = name.indexOf(' ');
  if (i === -1) return { firstName: name, lastName: '' };
  return { firstName: name.slice(0, i), lastName: name.slice(i + 1).trim() };
}

function kycStatusFor(userId, accountType) {
  if (isCompanyAccount(accountType)) {
    const row = db.prepare('SELECT status FROM company_kyc WHERE user_id = ?').get(userId);
    return row ? row.status : null;
  }
  const row = db.prepare('SELECT status FROM user_kyc WHERE user_id = ?').get(userId);
  return row ? row.status : null;
}

function isKycApproved(row) {
  return !!row && String(row.status || '').toLowerCase() === 'approved';
}

function isKycComplete(row) {
  if (!row) return false;
  const required = [
    row.first_name, row.last_name, row.legal_name,
    row.citizenship_country, row.birth_country, row.date_of_birth,
    row.id_type, row.id_country,
    row.address_line1, row.city, row.region, row.postal_code, row.country,
    row.phone, row.id_document_url
  ];
  if (required.some((v) => !String(v || '').trim())) return false;
  if (row.id_type !== 'passport' && row.id_type !== 'government_id') return false;
  const doc = String(row.id_document_url || '');
  if (!doc.startsWith('/uploads/') || doc.includes('..')) return false;
  return true;
}

function isCompanyKycComplete(row) {
  if (!row) return false;
  const required = [
    row.legal_name, row.state_of_registration,
    row.address_line1, row.city, row.region, row.postal_code, row.country,
    row.phone
  ];
  if (required.some((v) => !String(v || '').trim())) return false;
  const doc = String(row.document_url || '').trim();
  if (doc && (!doc.startsWith('/uploads/') || doc.includes('..'))) return false;
  return true;
}

function toPublicUser(row) {
  if (!row) return null;
  const names = splitNames(row);
  const kycStatus = row.kyc_status !== undefined
    ? (row.kyc_status || null)
    : kycStatusFor(row.id, row.account_type || 'individual');
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: names.firstName,
    lastName: names.lastName,
    role: row.role || 'user',
    accountType: row.account_type || 'individual',
    companyName: row.company_name || null,
    kycStatus,
    emailVerified: !!row.email_verified,
    createdAt: row.created_at
  };
}

function authUser(row) {
  const names = splitNames(row);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: names.firstName,
    lastName: names.lastName,
    role: row.role || 'user',
    accountType: row.account_type || 'individual',
    companyName: row.company_name || null,
    emailVerified: !!row.email_verified
  };
}

function signUser(user) {
  const emailVerified = user.emailVerified != null ? !!user.emailVerified : !!user.email_verified;
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      emailVerified
    },
    secret(),
    { expiresIn: '7d' }
  );
}

function readBearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function loadUser(payload) {
  const id = Number(payload && payload.id);
  if (!Number.isInteger(id) || id < 1) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function requireAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(token, secret());
    const row = loadUser(payload);
    if (!row) return res.status(401).json({ error: 'Account not found.' });
    req.user = authUser(row);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, secret());
    const row = loadUser(payload);
    if (row) req.user = authUser(row);
  } catch { /* public still ok */ }
  next();
}

function requireVerified(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.emailVerified) {
      return res.status(403).json({ error: 'Verify your email to continue.', code: 'EMAIL_UNVERIFIED' });
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only.' });
    }
    next();
  });
}

function requireSell(req, res, next) {
  requireVerified(req, res, () => {
    if (isCompanyAccount(req.user.accountType)) {
      const kyc = db.prepare('SELECT * FROM company_kyc WHERE user_id = ?').get(req.user.id);
      if (!isCompanyKycComplete(kyc)) {
        return res.status(403).json({
          code: 'KYC_REQUIRED',
          error: 'Complete company verification to list a robot.'
        });
      }
      if (!isKycApproved(kyc)) {
        return res.status(403).json({
          code: 'KYC_PENDING',
          error: 'Company verification is awaiting admin approval.'
        });
      }
      return next();
    }
    const kyc = db.prepare('SELECT * FROM user_kyc WHERE user_id = ?').get(req.user.id);
    if (!isKycComplete(kyc)) {
      return res.status(403).json({
        code: 'KYC_REQUIRED',
        error: 'Complete individual identity verification to list a robot.'
      });
    }
    if (!isKycApproved(kyc)) {
      return res.status(403).json({
        code: 'KYC_PENDING',
        error: 'Identity verification is awaiting admin approval.'
      });
    }
    next();
  });
}

function requireManufacturer(req, res, next) {
  requireVerified(req, res, () => {
    if (req.user.accountType !== 'manufacturer') {
      return res.status(403).json({ error: 'Manufacturer account required.' });
    }
    next();
  });
}

module.exports = {
  signUser,
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireVerified,
  requireSell,
  requireManufacturer,
  isKycComplete,
  isKycApproved,
  isCompanyKycComplete,
  isCompanyAccount,
  toPublicUser
};
