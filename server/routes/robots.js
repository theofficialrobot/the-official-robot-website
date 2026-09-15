const express = require('express');
const path = require('path');
const { db, buildSearchText } = require('../db');
const { requireAuth, requireVerified, requireSell, optionalAuth } = require('../middleware/auth');
const { attachWarranty } = require('../warranty');
const {
  safe,
  parseJson,
  sanitizeRobotId,
  parseIntId,
  isSafeUploadUrl,
  normalizeName,
  brandsMatch,
  constraintName
} = require('../util');

const router = express.Router();
const catalog = require(path.join(__dirname, '..', '..', 'data', 'robots.js'));
const ROBOTS = catalog.ROBOTS || {};
const TYPES = ['humanoid', 'campanionoid', 'aerial', 'water', 'hand'];
const CONDITIONS = ['new', 'cpo', 'used'];
const ITEM_CONDITIONS = ['excellent', 'very_good', 'good', 'fair', 'poor'];

function iconFor(type) {
  return type === 'hand' ? '🖐️' : type === 'campanionoid' ? '🐕' : type === 'aerial' ? '🛸' : type === 'water' ? '🌊' : '🤖';
}

function gallery(row) {
  const extra = parseJson(row.images_json, []);
  const list = Array.isArray(extra) ? extra.map(String).filter(Boolean) : [];
  if (row.image && !list.includes(row.image)) return [row.image, ...list];
  return list.length ? list : (row.image ? [row.image] : []);
}

function toPublic(row) {
  if (!row) return null;
  const specs = parseJson(row.specs_json, {});
  const ratingCount = Number(row.rating_count != null ? row.rating_count : row.ratingCount) || 0;
  const ratingAvg = ratingCount
    ? Math.round(Number(row.rating_avg != null ? row.rating_avg : row.ratingAvg) * 100) / 100
    : 0;
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || (row.source === 'catalog' ? 'The Official Robot' : null),
    catalogId: row.catalog_id || (row.source === 'catalog' ? row.id : null),
    name: row.name,
    maker: row.maker,
    type: row.type,
    condition: row.condition,
    year: row.year,
    modelNumber: row.model_number || specs.Model || null,
    price: row.price,
    listPrice: row.list_price != null ? Number(row.list_price) : Number(row.price) || 0,
    discountPct: Number(row.discount_pct) || 0,
    image: row.image,
    images: gallery(row),
    shortDesc: row.short_desc,
    uniqueSummary: row.unique_summary,
    idealFor: row.ideal_for,
    specsIntro: row.specs_intro,
    specs,
    highlights: parseJson(row.highlights_json, []),
    variants: parseJson(row.variants_json, []),
    colors: parseJson(row.colors_json, []),
    website: row.website,
    icon: row.icon,
    inspectionNotes: row.inspection_notes || null,
    itemCondition: row.item_condition || null,
    source: row.source,
    createdAt: row.created_at,
    ratingAvg,
    ratingCount
  };
}

function publicReview(row) {
  return {
    id: row.id,
    robotId: row.robot_id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    body: row.body,
    photos: parseJson(row.photos_json, []),
    createdAt: row.created_at
  };
}

function unitPriceFor(robot, variant) {
  const variants = parseJson(robot.variants_json, []);
  const match = variant && variants.find((v) => v.id === variant);
  return match && Number.isFinite(Number(match.price)) ? Number(match.price) : Number(robot.price) || 0;
}

function parseImages(input) {
  const raw = Array.isArray(input) ? input : [];
  const out = [];
  for (const item of raw.slice(0, 12)) {
    const s = String(item || '').trim();
    if (!isSafeUploadUrl(s)) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function parsePhotos(input) {
  const raw = Array.isArray(input) ? input : [];
  const out = [];
  for (const item of raw.slice(0, 8)) {
    const s = String(item || '').trim();
    if (!isSafeUploadUrl(s)) {
      const err = new Error('Review photos must be uploaded image URLs.');
      err.status = 400;
      throw err;
    }
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function ratingSummary(robotId) {
  const row = db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE robot_id = ?').get(robotId);
  const n = Number(row && row.n) || 0;
  const avg = n ? Math.round(Number(row.avg) * 100) / 100 : 0;
  return { ratingAvg: avg, ratingCount: n };
}

function reviewsFor(robotId) {
  return db.prepare(`
    SELECT reviews.*, users.name AS user_name
    FROM reviews JOIN users ON users.id = reviews.user_id
    WHERE reviews.robot_id = ?
    ORDER BY reviews.created_at DESC
  `).all(robotId).map(publicReview);
}

function parseSpecsMap(input) {
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

function insertRobot(payload) {
  db.prepare(`
    INSERT INTO robots (
      id, seller_id, catalog_id, name, maker, type, condition, year, model_number, price, image, images_json,
      short_desc, unique_summary, ideal_for, specs_intro, specs_json, highlights_json,
      variants_json, colors_json, website, icon, inspection_notes, item_condition, source, search_text
    ) VALUES (
      @id, @seller_id, @catalog_id, @name, @maker, @type, @condition, @year, @model_number, @price, @image, @images_json,
      @short_desc, @unique_summary, @ideal_for, @specs_intro, @specs_json, @highlights_json,
      @variants_json, @colors_json, @website, @icon, @inspection_notes, @item_condition, @source, @search_text
    )
  `).run(payload);
}

const SELECT = `
  SELECT robots.*, users.name AS seller_name,
    COALESCE(rv.rating_avg, 0) AS rating_avg,
    COALESCE(rv.rating_count, 0) AS rating_count
  FROM robots
  LEFT JOIN users ON users.id = robots.seller_id
  LEFT JOIN (
    SELECT robot_id, AVG(rating) AS rating_avg, COUNT(*) AS rating_count
    FROM reviews
    GROUP BY robot_id
  ) rv ON rv.robot_id = robots.id
`;

function catalogKeyFor(robot) {
  if (!robot) return null;
  if (robot.catalog_id) return String(robot.catalog_id);
  if (robot.source === 'catalog') return String(robot.id);
  return null;
}

function hasConfirmedPurchase(userId, robot) {
  if (!userId || !robot) return false;
  const catalogId = catalogKeyFor(robot);
  if (catalogId) {
    const row = db.prepare(`
      SELECT orders.id FROM orders
      JOIN robots r ON r.id = orders.robot_id
      WHERE orders.user_id = ?
        AND orders.status IN ('sold', 'paid', 'fulfilled', 'confirmed')
        AND (orders.robot_id = ? OR r.catalog_id = ? OR r.id = ?)
      LIMIT 1
    `).get(userId, robot.id, catalogId, catalogId);
    return !!row;
  }
  const row = db.prepare(`
    SELECT id FROM orders
    WHERE user_id = ? AND robot_id = ? AND status IN ('sold', 'paid', 'fulfilled', 'confirmed')
    LIMIT 1
  `).get(userId, robot.id);
  return !!row;
}

function listingCondition(body, user) {
  let condition = CONDITIONS.includes(body.condition) ? body.condition : (body.condition ? null : 'used');
  if (body.condition === 'like_new') condition = 'used';
  if (!condition) {
    const err = new Error('Condition must be new, used, or cpo.');
    err.status = 400;
    throw err;
  }
  const accountType = (user && (user.accountType || user.account_type)) || 'individual';
  if (condition === 'cpo' && accountType !== 'manufacturer') {
    const err = new Error('Only manufacturers can list certified pre-owned robots.');
    err.status = 403;
    throw err;
  }
  const inspectionNotes = String(body.inspectionNotes || '').trim();
  if (condition === 'cpo' && inspectionNotes.length < 20) {
    const err = new Error('Certified pre-owned listings need inspection notes (at least 20 characters).');
    err.status = 400;
    throw err;
  }
  let itemCondition = String(body.itemCondition || body.item_condition || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (condition === 'used') {
    if (itemCondition === 'like_new' || itemCondition === 'like new') itemCondition = 'excellent';
    if (!ITEM_CONDITIONS.includes(itemCondition)) {
      const err = new Error('Used robots need an item condition: excellent, very good, good, fair, or poor.');
      err.status = 400;
      throw err;
    }
  } else {
    itemCondition = null;
  }
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    const err = new Error('A valid asking price is required.');
    err.status = 400;
    throw err;
  }
  return { condition, inspectionNotes, itemCondition, price };
}

function uniqueConstraintResponse(res, err, custom) {
  const msg = constraintName(err);
  if (!/UNIQUE|CONSTRAINT/i.test(msg) && err.code !== 'SQLITE_CONSTRAINT_UNIQUE' && err.code !== 'SQLITE_CONSTRAINT') {
    throw err;
  }
  if (custom || /custom_maker_name/.test(msg)) {
    return res.status(409).json({ error: 'A custom listing with this maker and name already exists.' });
  }
  return res.status(409).json({ error: 'You already have an active listing for this catalog model.' });
}

router.get('/', optionalAuth, safe((req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const type = String(req.query.type || '').trim();
  const condition = String(req.query.condition || '').trim();
  const clauses = [];
  const params = [];
  if (q) {
    clauses.push('robots.search_text LIKE ?');
    params.push('%' + q.replace(/[%_]/g, '') + '%');
  }
  if (type && TYPES.includes(type)) {
    clauses.push('robots.type = ?');
    params.push(type);
  }
  if (condition && CONDITIONS.includes(condition)) {
    if (condition === 'used') {
      clauses.push("robots.condition IN ('used', 'like_new')");
    } else {
      clauses.push('robots.condition = ?');
      params.push(condition);
    }
  }
  if (req.query.mine === '1') {
    if (!req.user) return res.status(401).json({ error: 'Sign in to see your listings.' });
    clauses.push('robots.seller_id = ?');
    params.push(req.user.id);
  }
  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM robots${where}`).get(...params).n;
  const limit = Math.min(96, Math.max(1, Number(req.query.limit) || 48));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const order = `ORDER BY CASE robots.type WHEN 'humanoid' THEN 0 WHEN 'hand' THEN 1 WHEN 'campanionoid' THEN 2 WHEN 'aerial' THEN 3 WHEN 'water' THEN 4 ELSE 5 END, robots.price DESC, robots.name ASC`;
  const rows = db.prepare(`${SELECT}${where} ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({
    count: total,
    robots: rows.map(toPublic)
  });
}));

router.post('/', requireSell, safe((req, res) => {
  const body = req.body || {};
  const catalogId = String(body.catalogId || '').trim();
  if (catalogId) return createCatalogListing(req, res, body, catalogId);
  return createCustomListing(req, res, body);
}));

function assertManufacturerBrand(user, maker) {
  const accountType = (user && (user.accountType || user.account_type)) || 'individual';
  if (accountType !== 'manufacturer') return;
  const brand = user.companyName || user.company_name || '';
  if (!brand) {
    const err = new Error('Manufacturer accounts must have a manufacturer name before listing.');
    err.status = 400;
    throw err;
  }
  if (!brandsMatch(maker, brand)) {
    const err = new Error('Manufacturers can only list robots from their own brand (' + brand + ').');
    err.status = 403;
    throw err;
  }
}

function createCatalogListing(req, res, body, catalogId) {
  const platform = ROBOTS[catalogId];
  if (!platform || !platform.id) return res.status(400).json({ error: 'Unknown catalog SKU. Pick a platform from /api/catalog.' });
  try {
    assertManufacturerBrand(req.user, platform.maker);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const dup = db.prepare(`
    SELECT id FROM robots WHERE seller_id = ? AND catalog_id = ? AND source = 'user'
  `).get(req.user.id, String(platform.id));
  if (dup) return res.status(409).json({ error: 'You already have an active listing for this catalog model.' });

  let condition;
  let inspectionNotes;
  let itemCondition;
  let price;
  try {
    ({ condition, inspectionNotes, itemCondition, price } = listingCondition(body, req.user));
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  const shortDesc = String(body.shortDesc || '').trim() || platform.shortDesc || '';
  const type = TYPES.includes(platform.type) ? platform.type : 'humanoid';
  const year = platform.releaseYear ? Number(platform.releaseYear) : null;
  const slug = String(platform.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
  const id = 'u_' + slug + '_' + Date.now().toString(36);
  const specs = platform.specs && typeof platform.specs === 'object' ? platform.specs : {};
  const highlights = Array.isArray(platform.highlights) ? platform.highlights : [];
  const extras = parseImages(body.images);
  const modelNumber = specs.Model ? String(specs.Model) : (platform.name || '');
  const payload = {
    id,
    seller_id: req.user.id,
    catalog_id: String(platform.id),
    name: platform.name,
    maker: platform.maker || '',
    type,
    condition,
    year,
    model_number: modelNumber || null,
    price,
    image: platform.image || null,
    images_json: JSON.stringify(extras),
    short_desc: shortDesc,
    unique_summary: platform.uniqueSummary || shortDesc,
    ideal_for: platform.idealFor || '',
    specs_intro: platform.specsIntro || '',
    specs_json: JSON.stringify(specs),
    highlights_json: JSON.stringify(highlights),
    variants_json: JSON.stringify(Array.isArray(platform.variants) ? platform.variants : []),
    colors_json: JSON.stringify(Array.isArray(platform.colors) ? platform.colors : []),
    website: platform.website || '',
    icon: platform.icon || iconFor(type),
    inspection_notes: inspectionNotes || null,
    item_condition: itemCondition || null,
    source: 'user',
    search_text: ''
  };
  payload.search_text = buildSearchText({ ...payload, specs, short_desc: shortDesc, unique_summary: payload.unique_summary });

  try {
    insertRobot(payload);
  } catch (err) {
    return uniqueConstraintResponse(res, err, false);
  }

  const row = db.prepare(`${SELECT} WHERE robots.id = ?`).get(id);
  res.status(201).json({ robot: toPublic(row) });
}

function createCustomListing(req, res, body) {
  const name = normalizeName(body.name);
  const accountType = (req.user && (req.user.accountType || req.user.account_type)) || 'individual';
  const maker = accountType === 'manufacturer'
    ? normalizeName(req.user.companyName || req.user.company_name || body.maker)
    : normalizeName(body.maker);
  if (name.length < 3 || name.length > 80) {
    return res.status(400).json({ error: 'Custom bot name must be at least 3 characters.' });
  }
  if (!maker) return res.status(400).json({ error: 'Maker is required for a custom bot.' });
  if (maker.length > 80) return res.status(400).json({ error: 'Maker is too long.' });
  try {
    assertManufacturerBrand(req.user, maker);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  const type = String(body.type || '').trim();
  if (!TYPES.includes(type)) {
    return res.status(400).json({ error: 'Type must be humanoid, campanionoid, aerial, water, or hand.' });
  }
  let condition;
  let inspectionNotes;
  let itemCondition;
  let price;
  try {
    ({ condition, inspectionNotes, itemCondition, price } = listingCondition(body, req.user));
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 1950 || year > 2100) {
    return res.status(400).json({ error: 'Year must be a valid year between 1950 and 2100.' });
  }
  const modelNumber = normalizeName(body.modelNumber);
  if (!modelNumber || modelNumber.length > 80) {
    return res.status(400).json({ error: 'Model number is required.' });
  }
  let specs = {};
  if (body.specs != null) {
    specs = parseSpecsMap(body.specs);
  }
  specs.Model = modelNumber;
  const imageRaw = String(body.image || '').trim();
  if (imageRaw && !isSafeUploadUrl(imageRaw)) {
    return res.status(400).json({ error: 'Image must be an uploaded file URL.' });
  }
  const shortDesc = String(body.shortDesc || '').trim().slice(0, 2000);
  const extras = parseImages(body.images);

  const dup = db.prepare(`
    SELECT id FROM robots
    WHERE source = 'user' AND catalog_id IS NULL
      AND lower(trim(maker)) = lower(?) AND lower(trim(name)) = lower(?)
  `).get(maker, name);
  if (dup) {
    return res.status(409).json({ error: 'A custom listing with this maker and name already exists.' });
  }

  const slug = (maker + '_' + name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50) || 'custom';
  const id = 'u_' + slug + '_' + Date.now().toString(36);
  const payload = {
    id,
    seller_id: req.user.id,
    catalog_id: null,
    name,
    maker,
    type,
    condition,
    year,
    model_number: modelNumber,
    price,
    image: imageRaw || null,
    images_json: JSON.stringify(extras),
    short_desc: shortDesc,
    unique_summary: shortDesc,
    ideal_for: '',
    specs_intro: '',
    specs_json: JSON.stringify(specs),
    highlights_json: JSON.stringify(Array.isArray(body.highlights) ? body.highlights : []),
    variants_json: JSON.stringify([]),
    colors_json: JSON.stringify([]),
    website: '',
    icon: iconFor(type),
    inspection_notes: inspectionNotes || null,
    item_condition: itemCondition || null,
    source: 'user',
    search_text: ''
  };
  payload.search_text = buildSearchText({ ...payload, specs, short_desc: shortDesc, unique_summary: shortDesc });

  try {
    insertRobot(payload);
  } catch (err) {
    return uniqueConstraintResponse(res, err, true);
  }

  const row = db.prepare(`${SELECT} WHERE robots.id = ?`).get(id);
  res.status(201).json({ robot: toPublic(row) });
}

router.post('/:id/reviews', requireVerified, safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(id);
  if (!robot) return res.status(404).json({ error: 'Listing not found.' });
  if (robot.seller_id && robot.seller_id === req.user.id) {
    return res.status(403).json({ error: 'You cannot review your own listing.' });
  }
  if (!hasConfirmedPurchase(req.user.id, robot)) {
    return res.status(403).json({ error: 'Only confirmed purchasers can review this robot.', code: 'PURCHASE_REQUIRED' });
  }
  const existing = db.prepare('SELECT id FROM reviews WHERE robot_id = ? AND user_id = ?').get(id, req.user.id);
  if (existing) return res.status(409).json({ error: 'You have already reviewed this listing.' });

  const rating = Number(req.body && req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer from 1 to 5.' });
  }
  const body = String((req.body && req.body.body) || '').trim();
  if (body.length > 4000) return res.status(400).json({ error: 'Review is too long.' });
  const photos = parsePhotos(req.body && req.body.photos);

  try {
    const info = db.prepare(`
      INSERT INTO reviews (robot_id, user_id, rating, body, photos_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.user.id, rating, body, JSON.stringify(photos));
    const row = db.prepare(`
      SELECT reviews.*, users.name AS user_name
      FROM reviews JOIN users ON users.id = reviews.user_id
      WHERE reviews.id = ?
    `).get(info.lastInsertRowid);
    res.status(201).json({ review: publicReview(row) });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'You have already reviewed this listing.' });
    }
    throw err;
  }
}));

router.patch('/:id/reviews/:reviewId', requireVerified, safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  const reviewId = parseIntId(req.params.reviewId);
  if (!id || !reviewId) return res.status(404).json({ error: 'Review not found.' });
  const existing = db.prepare('SELECT * FROM reviews WHERE id = ? AND robot_id = ?').get(reviewId, id);
  if (!existing) return res.status(404).json({ error: 'Review not found.' });
  if (existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own review.' });
  }

  const bodyIn = req.body || {};
  let rating = existing.rating;
  if (bodyIn.rating !== undefined) {
    rating = Number(bodyIn.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer from 1 to 5.' });
    }
  }
  let body = existing.body;
  if (bodyIn.body !== undefined) {
    body = String(bodyIn.body || '').trim();
    if (body.length > 4000) return res.status(400).json({ error: 'Review is too long.' });
  }
  let photos = parseJson(existing.photos_json, []);
  if (bodyIn.photos !== undefined) photos = parsePhotos(bodyIn.photos);

  db.prepare('UPDATE reviews SET rating = ?, body = ?, photos_json = ? WHERE id = ?').run(
    rating, body, JSON.stringify(photos), reviewId
  );
  const row = db.prepare(`
    SELECT reviews.*, users.name AS user_name
    FROM reviews JOIN users ON users.id = reviews.user_id
    WHERE reviews.id = ?
  `).get(reviewId);
  res.json({ review: publicReview(row) });
}));

router.post('/:id/buy', requireAuth, safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(id);
  if (!robot) return res.status(404).json({ error: 'Listing not found.' });
  const body = req.body || {};
  const variant = String(body.variant || '').trim() || null;
  const qty = Math.max(1, Number(body.qty) || 1);
  const price = unitPriceFor(robot, variant);
  let attach;
  try {
    attach = attachWarranty(body, price, qty);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  const info = db.prepare(`
    INSERT INTO orders (user_id, robot_id, variant, price, qty, kind, warranty_id, warranty_price, service_requested, status)
    VALUES (?, ?, ?, ?, ?, 'buy', ?, ?, ?, 'requested')
  `).run(req.user.id, robot.id, variant, price, qty, attach.warrantyId, attach.warrantyPrice, attach.serviceRequested);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({
    order: {
      id: order.id,
      robotId: order.robot_id,
      variant: order.variant,
      price: order.price,
      qty: order.qty,
      kind: order.kind,
      warrantyId: order.warranty_id || 'mfr',
      warrantyPrice: Number(order.warranty_price) || 0,
      serviceRequested: Number(order.service_requested) ? 1 : 0,
      status: order.status,
      createdAt: order.created_at
    }
  });
}));

router.get('/:id', optionalAuth, safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const row = db.prepare(`${SELECT} WHERE robots.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });
  const related = db.prepare(`${SELECT} WHERE robots.type = ? AND robots.id != ? ORDER BY robots.price DESC LIMIT 21`).all(row.type, row.id);
  const ratings = ratingSummary(row.id);
  const images = gallery(row);
  const reviews = reviewsFor(row.id);
  let canReview = false;
  let canReviewReason = 'sign_in';
  if (req.user) {
    if (row.seller_id && row.seller_id === req.user.id) {
      canReviewReason = 'own_listing';
    } else if (reviews.some((r) => r.userId === req.user.id)) {
      canReviewReason = 'already_reviewed';
    } else if (hasConfirmedPurchase(req.user.id, row)) {
      canReview = true;
      canReviewReason = 'ok';
    } else {
      canReviewReason = 'purchase_required';
    }
  }
  res.json({
    robot: { ...toPublic(row), ...ratings, canReview, canReviewReason },
    related: related.map(toPublic),
    reviews,
    images,
    canReview,
    canReviewReason,
    ...ratings
  });
}));

module.exports = router;
