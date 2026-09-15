const fs = require('fs');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signUser, requireAuth, toPublicUser } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const {
  safe,
  hashToken,
  newVerifyToken,
  normalizeName,
  emailDomain,
  isPublicMailDomain,
  domainMatchesCompany
} = require('../util');

const ACCOUNT_TYPES = ['individual', 'reseller', 'manufacturer'];

const router = express.Router();
const authLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAIL_LOG = path.join(__dirname, '..', 'data', 'mail_log.txt');
const VERIFY_BASE = 'http://127.0.0.1:5173/verify-email?token=';

function verifyUrl(raw) {
  return VERIFY_BASE + encodeURIComponent(raw);
}

function appendMailLog(email, url) {
  const line = '[' + new Date().toISOString() + '] to=' + email + ' verifyUrl=' + url + '\n';
  fs.appendFileSync(MAIL_LOG, line);
}

function issueVerify(userId, email) {
  const { raw, hash } = newVerifyToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?').run(hash, expires, userId);
  const url = verifyUrl(raw);
  appendMailLog(email, url);
  return url;
}

function verifyAccount(req, res) {
  const raw = String((req.body && req.body.token) || req.query.token || '').trim();
  if (!raw || raw.length > 200) {
    return res.status(400).json({ error: 'A valid verification token is required.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(hashToken(raw));
  if (!user) return res.status(400).json({ error: 'Invalid or expired verification token.' });
  if (!user.verify_expires || new Date(user.verify_expires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Verification link expired.' });
  }
  db.prepare(`
    UPDATE users SET email_verified = 1, verify_token = NULL, verify_expires = NULL WHERE id = ?
  `).run(user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ token: signUser(fresh), user: toPublicUser(fresh) });
}

router.post('/register', authLimit, safe((req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  const password = String(body.password || '');
  const accountType = String(body.accountType || '').trim().toLowerCase();
  const companyName = normalizeName(body.companyName);
  const companyDomainIn = String(body.companyDomain || '').trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!ACCOUNT_TYPES.includes(accountType)) {
    return res.status(400).json({ error: 'Account type must be individual, reseller, or manufacturer.' });
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include a letter, a number, and a special character.' });
  }

  let storedCompany = null;
  let storedDomain = null;
  let storedFirst = null;
  let storedLast = null;
  let name;
  if (accountType === 'individual') {
    if (!firstName || firstName.length > 80) return res.status(400).json({ error: 'First name is required.' });
    if (!lastName || lastName.length > 80) return res.status(400).json({ error: 'Last name is required.' });
    storedFirst = firstName;
    storedLast = lastName;
    name = firstName + ' ' + lastName;
  } else {
    const label = accountType === 'manufacturer' ? 'manufacturer' : 'reseller';
    if (!companyName || companyName.length > 120) {
      return res.status(400).json({ error: 'Company name is required for ' + label + ' accounts.' });
    }
    const domain = emailDomain(email);
    if (isPublicMailDomain(domain) || !domainMatchesCompany(domain, companyName, companyDomainIn)) {
      return res.status(400).json({
        error: (accountType === 'manufacturer' ? 'Manufacturer' : 'Reseller') +
          ' accounts must use a company email on your company domain.'
      });
    }
    storedCompany = companyName;
    storedDomain = domain;
    name = companyName;
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'An account with that email already exists.' });

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (email, name, first_name, last_name, password_hash, role, account_type, company_name, company_domain, email_verified)
    VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?, 0)
  `).run(email, name, storedFirst, storedLast, password_hash, accountType, storedCompany, storedDomain);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const url = issueVerify(user.id, user.email);
  res.status(201).json({ user: toPublicUser(user), verifyUrl: url });
}));

router.post('/login', authLimit, safe((req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (!user.email_verified) {
    return res.status(403).json({ error: 'Verify your email to continue.', code: 'EMAIL_UNVERIFIED' });
  }
  res.json({ token: signUser(user), user: toPublicUser(user) });
}));

router.get('/verify', safe(verifyAccount));
router.post('/verify', safe(verifyAccount));

router.post('/resend-verify', authLimit, safe((req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (email && EMAIL_RE.test(email)) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user && !user.email_verified) issueVerify(user.id, user.email);
  }
  res.json({ ok: true });
}));

router.get('/me', requireAuth, safe((req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: toPublicUser(user) });
}));

module.exports = router;
