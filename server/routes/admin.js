const express = require('express');
const { db, buildSearchText } = require('../db');
const { requireAdmin, toPublicUser } = require('../middleware/auth');
const { toKyc, toCompanyKyc } = require('./kyc');
const { safe, parseJson, parseIntId, sanitizeRobotId, pageParams, isSafeMediaUrl, normalizeName } = require('../util');

const KYC_STATUSES = ['submitted', 'approved', 'rejected'];

const router = express.Router();
const ORDER_STATUSES = ['requested', 'quoted', 'sold', 'cancelled'];
const ROLES = ['user', 'admin'];
const ACCOUNT_TYPES = ['individual', 'reseller', 'manufacturer'];
const TYPES = ['humanoid', 'campanionoid', 'aerial', 'water', 'hand'];
const CONDITIONS = ['new', 'cpo', 'used'];
const ITEM_CONDITIONS = ['excellent', 'very_good', 'good', 'fair', 'poor'];
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

router.use(requireAdmin);

function listingRow(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || null,
    sellerEmail: row.seller_email || null,
    catalogId: row.catalog_id,
    name: row.name,
    maker: row.maker,
    type: row.type,
    condition: row.condition,
    itemCondition: row.item_condition || null,
    year: row.year,
    price: row.price,
    image: row.image,
    images: parseJson(row.images_json, []),
    shortDesc: row.short_desc,
    uniqueSummary: row.unique_summary,
    specs: parseJson(row.specs_json, {}),
    variants: parseJson(row.variants_json, []),
    colors: parseJson(row.colors_json, []),
    highlights: parseJson(row.highlights_json, []),
    modelNumber: row.model_number,
    source: row.source,
    mfrEdited: Number(row.mfr_edited) ? 1 : 0,
    createdAt: row.created_at
  };
}

function orderRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    robotId: row.robot_id,
    robotName: row.robot_name,
    variant: row.variant,
    price: Number(row.price) || 0,
    qty: Number(row.qty) || 1,
    kind: row.kind,
    warrantyId: row.warranty_id || 'mfr',
    warrantyPrice: Number(row.warranty_price) || 0,
    serviceRequested: Number(row.service_requested) ? 1 : 0,
    status: row.status,
    createdAt: row.created_at
  };
}

function reviewRow(row) {
  return {
    id: row.id,
    robotId: row.robot_id,
    robotName: row.robot_name,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    rating: row.rating,
    body: row.body,
    photos: parseJson(row.photos_json, []),
    createdAt: row.created_at
  };
}

function parseSpecs(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const err = new Error('Specs must be an object.');
    err.status = 400;
    throw err;
  }
  const out = {};
  for (const key of Object.keys(input).slice(0, 80)) {
    const k = String(key).trim().slice(0, 80);
    if (!k) continue;
    const v = input[key];
    if (v == null) continue;
    out[k] = typeof v === 'string' ? v.trim().slice(0, 2000) : String(v).slice(0, 2000);
  }
  return out;
}

function parseVariants(input) {
  if (!Array.isArray(input)) {
    const err = new Error('Variants must be an array.');
    err.status = 400;
    throw err;
  }
  return input.slice(0, 24).map((v) => {
    if (!v || typeof v !== 'object') {
      const err = new Error('Each variant needs id, name, and price.');
      err.status = 400;
      throw err;
    }
    const id = String(v.id || '').trim().slice(0, 80);
    const name = String(v.name || '').trim().slice(0, 120);
    const price = Number(v.price);
    if (!id || !name || !Number.isFinite(price) || price < 0) {
      const err = new Error('Each variant needs id, name, and a valid price.');
      err.status = 400;
      throw err;
    }
    return { id, name, price };
  });
}

function parseColors(input) {
  if (!Array.isArray(input)) {
    const err = new Error('Colors must be an array.');
    err.status = 400;
    throw err;
  }
  return input.slice(0, 24).map((c) => {
    if (!c || typeof c !== 'object') {
      const err = new Error('Each color needs id and name.');
      err.status = 400;
      throw err;
    }
    const id = String(c.id || '').trim().slice(0, 80);
    const name = String(c.name || '').trim().slice(0, 80);
    const hex = String(c.hex || '').trim().slice(0, 20);
    if (!id || !name) {
      const err = new Error('Each color needs id and name.');
      err.status = 400;
      throw err;
    }
    const premium = Number(c.premium);
    const image = String(c.image || c.photo || '').trim();
    if (image && !isSafeMediaUrl(image)) {
      const err = new Error('Finish photos must be uploaded image URLs.');
      err.status = 400;
      throw err;
    }
    const out = { id, name, hex, premium: Number.isFinite(premium) ? premium : 0 };
    if (image) out.image = image;
    return out;
  });
}

function parseHighlights(input) {
  if (!Array.isArray(input)) {
    const err = new Error('Highlights must be an array.');
    err.status = 400;
    throw err;
  }
  return input.slice(0, 24).map((h) => String(h || '').trim().slice(0, 500)).filter(Boolean);
}

function parseImages(input) {
  const raw = Array.isArray(input) ? input : [];
  const out = [];
  for (const item of raw.slice(0, 12)) {
    const s = String(item || '').trim();
    if (!isSafeMediaUrl(s)) {
      const err = new Error('Images must be catalog or uploaded file URLs.');
      err.status = 400;
      throw err;
    }
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

router.get('/overview', safe((_req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  res.json({
    users: count('SELECT COUNT(*) AS n FROM users'),
    listings: count('SELECT COUNT(*) AS n FROM robots'),
    orders: count('SELECT COUNT(*) AS n FROM orders'),
    reviews: count('SELECT COUNT(*) AS n FROM reviews'),
    unverified: count('SELECT COUNT(*) AS n FROM users WHERE email_verified = 0')
  });
}));

router.get('/users', safe((req, res) => {
  const { limit, offset } = pageParams(req.query);
  const total = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const rows = db.prepare(`
    SELECT users.*,
      CASE
        WHEN users.account_type IN ('reseller', 'manufacturer') THEN company_kyc.status
        ELSE user_kyc.status
      END AS kyc_status
    FROM users
    LEFT JOIN user_kyc ON user_kyc.user_id = users.id
    LEFT JOIN company_kyc ON company_kyc.user_id = users.id
    ORDER BY users.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  res.json({
    users: rows.map(toPublicUser),
    total,
    limit,
    offset
  });
}));

router.get('/users/:id', safe((req, res) => {
  const id = parseIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const accountType = user.account_type || 'individual';
  const company = accountType === 'reseller' || accountType === 'manufacturer';
  const kycRow = company
    ? db.prepare('SELECT * FROM company_kyc WHERE user_id = ?').get(id)
    : db.prepare('SELECT * FROM user_kyc WHERE user_id = ?').get(id);
  const kyc = company
    ? toCompanyKyc(kycRow, { includeDocument: true })
    : toKyc(kycRow, { includeDocument: true });
  const listingCount = db.prepare('SELECT COUNT(*) AS n FROM robots WHERE seller_id = ?').get(id).n;
  const orderCount = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?').get(id).n;
  res.json({
    user: toPublicUser(user),
    kycKind: company ? 'company' : 'individual',
    kyc,
    listingCount,
    orderCount
  });
}));

router.get('/listings', safe((req, res) => {
  const { limit, offset } = pageParams(req.query);
  const bucket = String(req.query.bucket || '').trim().toLowerCase();
  if (bucket && bucket !== 'new' && bucket !== 'used') {
    return res.status(400).json({ error: 'bucket must be new or used.' });
  }
  const newCount = db.prepare(
    "SELECT COUNT(*) AS n FROM robots WHERE condition = 'new'"
  ).get().n;
  const usedCount = db.prepare(
    "SELECT COUNT(*) AS n FROM robots WHERE condition IN ('used', 'cpo')"
  ).get().n;
  const where = bucket === 'new'
    ? "WHERE robots.condition = 'new'"
    : bucket === 'used'
      ? "WHERE robots.condition IN ('used', 'cpo', 'like_new')"
      : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM robots ${where}`).get().n;
  const rows = db.prepare(`
    SELECT robots.*, users.name AS seller_name, users.email AS seller_email
    FROM robots
    LEFT JOIN users ON users.id = robots.seller_id
    ${where}
    ORDER BY robots.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  res.json({ listings: rows.map(listingRow), total, newCount, usedCount, limit, offset });
}));

router.get('/orders', safe((req, res) => {
  const { limit, offset } = pageParams(req.query);
  const total = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  const rows = db.prepare(`
    SELECT orders.*, users.name AS user_name, users.email AS user_email, robots.name AS robot_name
    FROM orders
    JOIN users ON users.id = orders.user_id
    JOIN robots ON robots.id = orders.robot_id
    ORDER BY orders.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  res.json({ orders: rows.map(orderRow), total, limit, offset });
}));

router.get('/reviews', safe((req, res) => {
  const { limit, offset } = pageParams(req.query);
  const total = db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n;
  const rows = db.prepare(`
    SELECT reviews.*, users.name AS user_name, users.email AS user_email, robots.name AS robot_name
    FROM reviews
    JOIN users ON users.id = reviews.user_id
    JOIN robots ON robots.id = reviews.robot_id
    ORDER BY reviews.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  res.json({ reviews: rows.map(reviewRow), total, limit, offset });
}));

router.patch('/users/:id', safe((req, res) => {
  const id = parseIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const body = req.body || {};
  const updates = [];
  const params = [];

  if (body.role !== undefined) {
    const role = String(body.role);
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Role must be user or admin.' });
    if (role !== 'admin' && req.user && req.user.id === id) {
      return res.status(400).json({ error: 'You cannot remove your own admin role.' });
    }
    updates.push('role = ?');
    params.push(role);
  }
  if (body.emailVerified !== undefined) {
    const verified = body.emailVerified === true || body.emailVerified === 1 || body.emailVerified === '1' || body.emailVerified === 'true';
    updates.push('email_verified = ?');
    params.push(verified ? 1 : 0);
    if (verified) {
      updates.push('verify_token = NULL');
      updates.push('verify_expires = NULL');
    }
  }
  if (body.email !== undefined) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
    const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
    if (clash) return res.status(409).json({ error: 'An account with that email already exists.' });
    updates.push('email = ?');
    params.push(email);
  }
  if (body.firstName !== undefined) {
    updates.push('first_name = ?');
    params.push(normalizeName(body.firstName).slice(0, 80) || null);
  }
  if (body.lastName !== undefined) {
    updates.push('last_name = ?');
    params.push(normalizeName(body.lastName).slice(0, 80) || null);
  }
  if (body.accountType !== undefined) {
    const accountType = String(body.accountType || '').trim().toLowerCase();
    if (!ACCOUNT_TYPES.includes(accountType)) {
      return res.status(400).json({ error: 'Account type must be individual, reseller, or manufacturer.' });
    }
    updates.push('account_type = ?');
    params.push(accountType);
  }
  if (body.companyName !== undefined) {
    const companyName = normalizeName(body.companyName).slice(0, 120) || null;
    updates.push('company_name = ?');
    params.push(companyName);
  }
  if (body.firstName !== undefined || body.lastName !== undefined || body.companyName !== undefined || body.accountType !== undefined) {
    const nextType = body.accountType !== undefined
      ? String(body.accountType).trim().toLowerCase()
      : (user.account_type || 'individual');
    const first = body.firstName !== undefined ? normalizeName(body.firstName) : (user.first_name || '');
    const last = body.lastName !== undefined ? normalizeName(body.lastName) : (user.last_name || '');
    const company = body.companyName !== undefined ? normalizeName(body.companyName) : (user.company_name || '');
    const display = (nextType === 'reseller' || nextType === 'manufacturer')
      ? (company || user.name)
      : [first, last].filter(Boolean).join(' ') || user.name;
    updates.push('name = ?');
    params.push(display);
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

  params.push(id);
  db.prepare('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ user: toPublicUser(fresh) });
}));

router.patch('/orders/:id', safe((req, res) => {
  const id = parseIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid order id.' });
  const status = String((req.body && req.body.status) || '');
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be requested, quoted, sold, or cancelled.' });
  }
  const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  const row = db.prepare(`
    SELECT orders.*, users.name AS user_name, users.email AS user_email, robots.name AS robot_name
    FROM orders
    JOIN users ON users.id = orders.user_id
    JOIN robots ON robots.id = orders.robot_id
    WHERE orders.id = ?
  `).get(id);
  res.json({ order: orderRow(row) });
}));

router.get('/listings/:id', safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const row = db.prepare(`
    SELECT robots.*, users.name AS seller_name, users.email AS seller_email
    FROM robots
    LEFT JOIN users ON users.id = robots.seller_id
    WHERE robots.id = ?
  `).get(id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });
  res.json({ listing: listingRow(row) });
}));

router.patch('/listings/:id', safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const row = db.prepare('SELECT * FROM robots WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });

  const body = req.body || {};
  const updates = [];
  const params = [];
  const specs = parseJson(row.specs_json, {});
  let nextSpecs = specs;
  let touchedSpecs = false;

  if (body.name !== undefined) {
    const name = normalizeName(body.name);
    if (!name || name.length > 160) return res.status(400).json({ error: 'Name is required.' });
    updates.push('name = ?');
    params.push(name);
  }
  if (body.maker !== undefined) {
    const maker = normalizeName(body.maker);
    if (!maker || maker.length > 120) return res.status(400).json({ error: 'Maker is required.' });
    updates.push('maker = ?');
    params.push(maker);
  }
  if (body.type !== undefined) {
    const type = String(body.type || '').trim();
    if (!TYPES.includes(type)) {
      return res.status(400).json({ error: 'Type must be humanoid, campanionoid, aerial, water, or hand.' });
    }
    updates.push('type = ?');
    params.push(type);
  }
  if (body.condition !== undefined) {
    const condition = String(body.condition || '').trim();
    if (condition === 'like_new') condition = 'used';
    if (!CONDITIONS.includes(condition)) {
      return res.status(400).json({ error: 'Condition must be new, used, or cpo.' });
    }
    updates.push('condition = ?');
    params.push(condition);
  }
  if (body.itemCondition !== undefined || body.item_condition !== undefined) {
    let itemCondition = String(body.itemCondition || body.item_condition || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!itemCondition) {
      updates.push('item_condition = ?');
      params.push(null);
    } else {
      if (itemCondition === 'like_new') itemCondition = 'excellent';
      if (!ITEM_CONDITIONS.includes(itemCondition)) {
        return res.status(400).json({ error: 'Item condition must be excellent, very good, good, fair, or poor.' });
      }
      updates.push('item_condition = ?');
      params.push(itemCondition);
    }
  }
  if (body.year !== undefined) {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) {
      return res.status(400).json({ error: 'Year must be a valid year between 1950 and 2100.' });
    }
    updates.push('year = ?');
    params.push(year);
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'A valid price is required.' });
    }
    updates.push('price = ?');
    params.push(price);
  }
  if (body.shortDesc !== undefined) {
    updates.push('short_desc = ?');
    params.push(String(body.shortDesc || '').trim().slice(0, 4000));
  }
  if (body.uniqueSummary !== undefined) {
    updates.push('unique_summary = ?');
    params.push(String(body.uniqueSummary || '').trim().slice(0, 4000));
  }
  if (body.specs !== undefined) {
    nextSpecs = parseSpecs(body.specs);
    touchedSpecs = true;
  }
  if (body.modelNumber !== undefined) {
    const modelNumber = normalizeName(body.modelNumber);
    if (!modelNumber || modelNumber.length > 80) {
      return res.status(400).json({ error: 'Model number is required.' });
    }
    updates.push('model_number = ?');
    params.push(modelNumber);
    nextSpecs = { ...nextSpecs, Model: modelNumber };
    touchedSpecs = true;
  }
  if (touchedSpecs) {
    updates.push('specs_json = ?');
    params.push(JSON.stringify(nextSpecs));
  }
  if (body.variants !== undefined) {
    updates.push('variants_json = ?');
    params.push(JSON.stringify(parseVariants(body.variants)));
  }
  if (body.colors !== undefined) {
    updates.push('colors_json = ?');
    params.push(JSON.stringify(parseColors(body.colors)));
  }
  if (body.highlights !== undefined) {
    updates.push('highlights_json = ?');
    params.push(JSON.stringify(parseHighlights(body.highlights)));
  }
  if (body.image !== undefined) {
    const image = String(body.image || '').trim();
    if (image && !isSafeMediaUrl(image)) {
      return res.status(400).json({ error: 'Image must be a catalog or uploaded file URL.' });
    }
    updates.push('image = ?');
    params.push(image || null);
  }
  if (body.images !== undefined) {
    updates.push('images_json = ?');
    params.push(JSON.stringify(parseImages(body.images)));
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });
  if (row.source === 'catalog') updates.push('mfr_edited = 1');

  params.push(id);
  db.prepare('UPDATE robots SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);

  const fresh = db.prepare('SELECT * FROM robots WHERE id = ?').get(id);
  const searchText = buildSearchText({
    name: fresh.name,
    maker: fresh.maker,
    type: fresh.type,
    condition: fresh.condition,
    year: fresh.year,
    short_desc: fresh.short_desc,
    unique_summary: fresh.unique_summary,
    specs: parseJson(fresh.specs_json, {})
  });
  db.prepare('UPDATE robots SET search_text = ? WHERE id = ?').run(searchText, id);

  const out = db.prepare(`
    SELECT robots.*, users.name AS seller_name, users.email AS seller_email
    FROM robots
    LEFT JOIN users ON users.id = robots.seller_id
    WHERE robots.id = ?
  `).get(id);
  res.json({ listing: listingRow(out) });
}));

router.delete('/listings/:id', safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(id);
  if (!robot) return res.status(404).json({ error: 'Listing not found.' });
  if (robot.source === 'catalog') {
    return res.status(400).json({ error: 'Official catalog platforms cannot be deleted.' });
  }
  const orders = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE robot_id = ?').get(id).n;
  if (orders) return res.status(409).json({ error: 'Cannot delete a listing that has orders.' });
  db.prepare('DELETE FROM robots WHERE id = ?').run(id);
  res.json({ ok: true });
}));

router.delete('/reviews/:id', safe((req, res) => {
  const id = parseIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid review id.' });
  const info = db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Review not found.' });
  res.json({ ok: true });
}));

router.get('/kyc', safe((req, res) => {
  const { limit, offset } = pageParams(req.query);
  const total = db.prepare('SELECT COUNT(*) AS n FROM user_kyc').get().n;
  const rows = db.prepare(`
    SELECT user_kyc.*, users.email AS user_email, users.name AS user_name
    FROM user_kyc
    JOIN users ON users.id = user_kyc.user_id
    ORDER BY user_kyc.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  res.json({
    kyc: rows.map((row) => ({
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      ...toKyc(row, { includeDocument: true })
    })),
    total,
    limit,
    offset
  });
}));

router.get('/kyc/:userId', safe((req, res) => {
  const userId = parseIntId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'Invalid user id.' });
  const row = db.prepare(`
    SELECT user_kyc.*, users.email AS user_email, users.name AS user_name
    FROM user_kyc
    JOIN users ON users.id = user_kyc.user_id
    WHERE user_kyc.user_id = ?
  `).get(userId);
  if (!row) return res.status(404).json({ error: 'KYC record not found.' });
  res.json({
    kyc: {
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      ...toKyc(row, { includeDocument: true })
    }
  });
}));

router.patch('/kyc/:userId', safe((req, res) => {
  const userId = parseIntId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'Invalid user id.' });
  const status = String((req.body && req.body.status) || '');
  if (!KYC_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be submitted, approved, or rejected.' });
  }
  const user = db.prepare('SELECT id, account_type FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const company = user.account_type === 'reseller' || user.account_type === 'manufacturer';
  if (company) {
    const existing = db.prepare('SELECT user_id FROM company_kyc WHERE user_id = ?').get(userId);
    if (!existing) return res.status(404).json({ error: 'Company KYC record not found.' });
    db.prepare(`UPDATE company_kyc SET status = ?, updated_at = datetime('now') WHERE user_id = ?`).run(status, userId);
    const row = db.prepare(`
      SELECT company_kyc.*, users.email AS user_email, users.name AS user_name
      FROM company_kyc
      JOIN users ON users.id = company_kyc.user_id
      WHERE company_kyc.user_id = ?
    `).get(userId);
    return res.json({
      kycKind: 'company',
      kyc: {
        userId: row.user_id,
        userEmail: row.user_email,
        userName: row.user_name,
        ...toCompanyKyc(row, { includeDocument: true })
      }
    });
  }
  const existing = db.prepare('SELECT user_id FROM user_kyc WHERE user_id = ?').get(userId);
  if (!existing) return res.status(404).json({ error: 'KYC record not found.' });
  db.prepare(`UPDATE user_kyc SET status = ?, updated_at = datetime('now') WHERE user_id = ?`).run(status, userId);
  const row = db.prepare(`
    SELECT user_kyc.*, users.email AS user_email, users.name AS user_name
    FROM user_kyc
    JOIN users ON users.id = user_kyc.user_id
    WHERE user_kyc.user_id = ?
  `).get(userId);
  res.json({
    kycKind: 'individual',
    kyc: {
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      ...toKyc(row, { includeDocument: true })
    }
  });
}));

module.exports = router;
