const express = require('express');
const { db } = require('../db');
const { requireAuth, requireVerified, isKycComplete, isCompanyKycComplete, isCompanyAccount } = require('../middleware/auth');
const { safe, parseIsoDate, ageYears, isLocalUploadUrl, normalizeName } = require('../util');

const router = express.Router();
const ID_TYPES = ['passport', 'government_id'];

function textField(value, label, min, max) {
  const s = normalizeName(value);
  if (s.length < min || s.length > max) {
    const err = new Error(label);
    err.status = 400;
    throw err;
  }
  return s;
}

function optionalField(value, max) {
  const s = normalizeName(value);
  if (!s) return '';
  if (s.length > max) {
    const err = new Error('Value is too long.');
    err.status = 400;
    throw err;
  }
  return s;
}

function pick(body, keys) {
  for (const k of keys) {
    if (body[k] != null && String(body[k]).trim()) return body[k];
  }
  return '';
}

function fail(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

function personName(value, label) {
  const s = textField(value, label + ' is required.', 1, 80);
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(s)) fail(label + ' can only include letters, spaces, hyphens, and apostrophes.');
  return s;
}

function placeName(value, label) {
  const s = textField(value, label + ' is required.', 1, 80);
  if (!/^[A-Za-z0-9][A-Za-z0-9 .,'-]*$/.test(s)) fail(label + ' has invalid characters.');
  return s;
}

function parsePostalCode(value) {
  const s = textField(value, 'Postal code is required.', 2, 20);
  if (!/^[A-Za-z0-9][A-Za-z0-9 \-]*$/.test(s)) fail('Postal code can only include letters, numbers, spaces, and hyphens.');
  return s;
}

function phoneNumber(value) {
  const raw = String(value || '').trim();
  if (!raw) fail('Phone number is required.');
  if (/[A-Za-z]/.test(raw)) fail('Phone number cannot include letters.');
  if (!/^\+?[0-9][0-9\s().\-]*$/.test(raw)) fail('Enter a valid phone number (digits, optional +, spaces, or dashes).');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) fail('Phone number must have 7 to 15 digits.');
  return raw.slice(0, 30);
}

function companyLegalName(value) {
  const s = textField(value, 'Legal name is required.', 2, 160);
  if (!/[A-Za-z]/.test(s)) fail('Legal name must include letters.');
  return s;
}

function toKyc(row, { includeDocument } = {}) {
  if (!row) return null;
  const out = {
    firstName: row.first_name,
    middleName: row.middle_name || '',
    lastName: row.last_name,
    legalName: row.legal_name,
    citizenshipCountry: row.citizenship_country,
    birthCountry: row.birth_country,
    dateOfBirth: row.date_of_birth,
    idType: row.id_type,
    idCountry: row.id_country,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 || '',
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    country: row.country,
    phone: row.phone,
    status: row.status,
    complete: isKycComplete(row),
    updatedAt: row.updated_at
  };
  if (includeDocument) out.idDocumentUrl = row.id_document_url;
  return out;
}

function toCompanyKyc(row, { includeDocument } = {}) {
  if (!row) return null;
  const out = {
    legalName: row.legal_name,
    stateOfRegistration: row.state_of_registration,
    registrationNumber: row.registration_number || '',
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 || '',
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    country: row.country,
    phone: row.phone,
    status: row.status,
    complete: isCompanyKycComplete(row),
    updatedAt: row.updated_at
  };
  if (includeDocument) out.documentUrl = row.document_url || '';
  return out;
}

function parseBody(body) {
  const firstName = personName(body.firstName, 'First name');
  const lastName = personName(body.lastName, 'Last name');
  const legalName = textField(body.legalName || [firstName, body.middleName, lastName].filter(Boolean).join(' '), 'Legal name as on ID is required.', 2, 160);
  const middleRaw = optionalField(body.middleName, 80);
  if (middleRaw && !/^[A-Za-z][A-Za-z .'-]*$/.test(middleRaw)) fail('Middle name can only include letters, spaces, hyphens, and apostrophes.');
  const middleName = middleRaw;
  const citizenshipCountry = textField(body.citizenshipCountry, 'Citizenship country is required.', 2, 80);
  const birthCountry = textField(body.birthCountry, 'Birth country is required.', 2, 80);
  const dob = parseIsoDate(body.dateOfBirth);
  if (!dob) {
    const err = new Error('Date of birth must be an ISO date (YYYY-MM-DD).');
    err.status = 400;
    throw err;
  }
  if (ageYears(dob) < 18) {
    const err = new Error('You must be at least 18 years old.');
    err.status = 400;
    throw err;
  }
  const idType = String(body.idType || '').trim();
  if (!ID_TYPES.includes(idType)) {
    const err = new Error('ID type must be passport or government_id.');
    err.status = 400;
    throw err;
  }
  const idCountry = textField(body.idCountry, 'ID country is required.', 2, 80);
  const addressLine1 = textField(body.addressLine1, 'Address is required.', 2, 200);
  const addressLine2 = optionalField(body.addressLine2, 200);
  const city = placeName(body.city, 'City');
  const region = placeName(body.region || body.state, 'State / Region');
  const postal = parsePostalCode(body.postalCode);
  const country = textField(body.country, 'Country is required.', 2, 80);
  const phone = phoneNumber(body.phone);
  const idDocumentUrl = String(body.idDocumentUrl || body.documentUrl || '').trim();
  if (!isLocalUploadUrl(idDocumentUrl) || !idDocumentUrl.startsWith('/uploads/kyc/')) {
    const err = new Error('Upload a KYC identity document first.');
    err.status = 400;
    throw err;
  }
  return {
    first_name: firstName,
    middle_name: middleName || null,
    last_name: lastName,
    legal_name: legalName,
    citizenship_country: citizenshipCountry,
    birth_country: birthCountry,
    date_of_birth: dob,
    id_type: idType,
    id_country: idCountry,
    address_line1: addressLine1,
    address_line2: addressLine2 || null,
    city,
    region,
    postal_code: postal,
    country,
    phone,
    id_document_url: idDocumentUrl
  };
}

function parseCompanyBody(body) {
  const legalName = companyLegalName(pick(body, ['legalName', 'legalCompanyName', 'legal_name', 'companyName', 'company_name']));
  const stateOfRegistration = placeName(
    pick(body, ['stateOfRegistration', 'registrationState', 'state_of_registration']),
    'State of registration'
  );
  const registrationNumber = optionalField(body.registrationNumber, 80);
  const addressLine1 = textField(body.addressLine1, 'Address is required.', 2, 200);
  const addressLine2 = optionalField(body.addressLine2, 200);
  const city = placeName(body.city, 'City');
  const region = placeName(pick(body, ['region', 'state']), 'State / Region');
  const postal = parsePostalCode(pick(body, ['postalCode', 'zip']));
  const country = textField(body.country, 'Country is required.', 2, 80);
  const phone = phoneNumber(body.phone);
  let documentUrl = String(body.documentUrl || '').trim();
  if (documentUrl) {
    if (!isLocalUploadUrl(documentUrl) || !documentUrl.startsWith('/uploads/kyc/')) {
      const err = new Error('Upload a company document first.');
      err.status = 400;
      throw err;
    }
  } else {
    documentUrl = null;
  }
  return {
    legal_name: legalName,
    state_of_registration: stateOfRegistration,
    registration_number: registrationNumber || null,
    address_line1: addressLine1,
    address_line2: addressLine2 || null,
    city,
    region,
    postal_code: postal,
    country,
    phone,
    document_url: documentUrl
  };
}

router.get('/', requireAuth, safe((req, res) => {
  if (isCompanyAccount(req.user.accountType)) {
    const row = db.prepare('SELECT * FROM company_kyc WHERE user_id = ?').get(req.user.id);
    return res.json({ kind: 'company', kyc: toCompanyKyc(row, { includeDocument: true }) });
  }
  const row = db.prepare('SELECT * FROM user_kyc WHERE user_id = ?').get(req.user.id);
  res.json({ kind: 'individual', kyc: toKyc(row, { includeDocument: true }) });
}));

router.put('/company', requireVerified, safe((req, res) => {
  if (!isCompanyAccount(req.user.accountType)) {
    return res.status(403).json({ error: 'Company verification is for reseller and manufacturer accounts.' });
  }
  const fields = parseCompanyBody(req.body || {});
  db.prepare(`
    INSERT INTO company_kyc (
      user_id, legal_name, state_of_registration, registration_number,
      address_line1, address_line2, city, region, postal_code, country, phone,
      document_url, status, updated_at
    ) VALUES (
      @user_id, @legal_name, @state_of_registration, @registration_number,
      @address_line1, @address_line2, @city, @region, @postal_code, @country, @phone,
      @document_url, 'submitted', datetime('now')
    )
    ON CONFLICT(user_id) DO UPDATE SET
      legal_name = excluded.legal_name,
      state_of_registration = excluded.state_of_registration,
      registration_number = excluded.registration_number,
      address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2,
      city = excluded.city,
      region = excluded.region,
      postal_code = excluded.postal_code,
      country = excluded.country,
      phone = excluded.phone,
      document_url = excluded.document_url,
      status = 'submitted',
      updated_at = datetime('now')
  `).run({ user_id: req.user.id, ...fields });
  const row = db.prepare('SELECT * FROM company_kyc WHERE user_id = ?').get(req.user.id);
  res.json({ kind: 'company', kyc: toCompanyKyc(row, { includeDocument: true }) });
}));

router.put('/', requireVerified, safe((req, res) => {
  if (isCompanyAccount(req.user.accountType)) {
    return res.status(403).json({ error: 'Company accounts must complete company verification.' });
  }
  const fields = parseBody(req.body || {});
  db.prepare(`
    INSERT INTO user_kyc (
      user_id, first_name, middle_name, last_name, legal_name,
      citizenship_country, birth_country, date_of_birth, id_type, id_country,
      address_line1, address_line2, city, region, postal_code, country, phone,
      id_document_url, status, updated_at
    ) VALUES (
      @user_id, @first_name, @middle_name, @last_name, @legal_name,
      @citizenship_country, @birth_country, @date_of_birth, @id_type, @id_country,
      @address_line1, @address_line2, @city, @region, @postal_code, @country, @phone,
      @id_document_url, 'submitted', datetime('now')
    )
    ON CONFLICT(user_id) DO UPDATE SET
      first_name = excluded.first_name,
      middle_name = excluded.middle_name,
      last_name = excluded.last_name,
      legal_name = excluded.legal_name,
      citizenship_country = excluded.citizenship_country,
      birth_country = excluded.birth_country,
      date_of_birth = excluded.date_of_birth,
      id_type = excluded.id_type,
      id_country = excluded.id_country,
      address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2,
      city = excluded.city,
      region = excluded.region,
      postal_code = excluded.postal_code,
      country = excluded.country,
      phone = excluded.phone,
      id_document_url = excluded.id_document_url,
      status = 'submitted',
      updated_at = datetime('now')
  `).run({ user_id: req.user.id, ...fields });
  const row = db.prepare('SELECT * FROM user_kyc WHERE user_id = ?').get(req.user.id);
  res.json({ kind: 'individual', kyc: toKyc(row, { includeDocument: true }) });
}));

module.exports = { router, toKyc, toCompanyKyc };
