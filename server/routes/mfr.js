const express = require('express');
const { db, buildSearchText } = require('../db');
const { requireManufacturer } = require('../middleware/auth');
const {
  safe,
  parseJson,
  sanitizeRobotId,
  isSafeMediaUrl,
  normalizeName,
  brandsMatch
} = require('../util');

const router = express.Router();
router.use(requireManufacturer);

function gallery(row) {
  const extra = parseJson(row.images_json, []);
  const list = Array.isArray(extra) ? extra.map(String).filter(Boolean) : [];
  if (row.image && !list.includes(row.image)) return [row.image, ...list];
  return list.length ? list : (row.image ? [row.image] : []);
}

function toMfrRobot(row) {
  if (!row) return null;
  const specs = parseJson(row.specs_json, {});
  return {
    id: row.id,
    sellerId: row.seller_id,
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
    specsIntro: row.specs_intro,
    specs,
    highlights: parseJson(row.highlights_json, []),
    variants: parseJson(row.variants_json, []),
    colors: parseJson(row.colors_json, []),
    source: row.source,
    mfrEdited: Number(row.mfr_edited) ? 1 : 0,
    createdAt: row.created_at
  };
}

const SELECT = `
  SELECT robots.*, users.name AS seller_name
  FROM robots
  LEFT JOIN users ON users.id = robots.seller_id
`;

function mfrFilter(user) {
  const company = String(user.companyName || '').trim();
  if (company) {
    return {
      sql: '(robots.seller_id = ? OR (robots.source = \'catalog\' AND lower(trim(robots.maker)) = lower(trim(?))))',
      params: [user.id, company]
    };
  }
  return { sql: 'robots.seller_id = ?', params: [user.id] };
}

function mfrOwns(user, robot) {
  if (!robot) return false;
  if (robot.seller_id && Number(robot.seller_id) === Number(user.id)) return true;
  const company = String(user.companyName || '').trim();
  if (!company) return false;
  return brandsMatch(robot.maker, company);
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

router.get('/robots', safe((req, res) => {
  const rows = db.prepare(`${SELECT} ORDER BY robots.name ASC`).all()
    .filter((row) => mfrOwns(req.user, row));
  res.json({ robots: rows.map(toMfrRobot) });
}));

router.get('/robots/:id', safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const row = db.prepare(`${SELECT} WHERE robots.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });
  if (!mfrOwns(req.user, row)) return res.status(403).json({ error: 'Not your platform.' });
  res.json({ robot: toMfrRobot(row) });
}));

router.patch('/robots/:id', safe((req, res) => {
  const id = sanitizeRobotId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Listing not found.' });
  const row = db.prepare('SELECT * FROM robots WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });
  if (!mfrOwns(req.user, row)) return res.status(403).json({ error: 'Not your platform.' });

  const body = req.body || {};
  const updates = [];
  const params = [];
  const specs = parseJson(row.specs_json, {});
  let nextSpecs = specs;
  let touchedSpecs = false;

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
  if (body.shortDesc !== undefined) {
    updates.push('short_desc = ?');
    params.push(String(body.shortDesc || '').trim().slice(0, 4000));
  }
  if (body.uniqueSummary !== undefined) {
    updates.push('unique_summary = ?');
    params.push(String(body.uniqueSummary || '').trim().slice(0, 4000));
  }
  if (body.specsIntro !== undefined) {
    updates.push('specs_intro = ?');
    params.push(String(body.specsIntro || '').trim().slice(0, 8000));
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
  if (body.year !== undefined) {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) {
      return res.status(400).json({ error: 'Year must be a valid year between 1950 and 2100.' });
    }
    updates.push('year = ?');
    params.push(year);
  }
  if (body.listPrice !== undefined || body.discountPct !== undefined) {
    const listPrice = body.listPrice !== undefined
      ? Number(body.listPrice)
      : (row.list_price != null ? Number(row.list_price) : Number(row.price) || 0);
    if (!Number.isFinite(listPrice) || listPrice < 0) {
      return res.status(400).json({ error: 'Listing price must be a valid amount.' });
    }
    let discountPct = body.discountPct !== undefined
      ? Number(body.discountPct)
      : Number(row.discount_pct) || 0;
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct >= 100) {
      return res.status(400).json({ error: 'Discount must be between 0 and 99 percent.' });
    }
    discountPct = Math.round(discountPct * 100) / 100;
    const sale = Math.round(listPrice * (1 - discountPct / 100));
    updates.push('list_price = ?');
    params.push(listPrice);
    updates.push('discount_pct = ?');
    params.push(discountPct);
    updates.push('price = ?');
    params.push(sale);
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

  updates.push('mfr_edited = 1');
  params.push(id);
  db.prepare('UPDATE robots SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);

  const fresh = db.prepare('SELECT * FROM robots WHERE id = ?').get(id);
  const searchSpecs = parseJson(fresh.specs_json, {});
  const searchText = buildSearchText({
    name: fresh.name,
    maker: fresh.maker,
    type: fresh.type,
    condition: fresh.condition,
    year: fresh.year,
    short_desc: fresh.short_desc,
    unique_summary: fresh.unique_summary,
    specs: searchSpecs
  });
  db.prepare('UPDATE robots SET search_text = ? WHERE id = ?').run(searchText, id);

  const out = db.prepare(`${SELECT} WHERE robots.id = ?`).get(id);
  res.json({ robot: toMfrRobot(out) });
}));

module.exports = router;
