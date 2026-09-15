const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { attachWarranty } = require('../warranty');
const { safe, brandsMatch } = require('../util');

const router = express.Router();

function publicOrder(row) {
  return {
    id: row.id,
    robotId: row.robot_id,
    robotName: row.robot_name,
    robotImage: row.robot_image,
    variant: row.variant,
    price: Number(row.price) || 0,
    qty: Number(row.qty) || 1,
    kind: row.kind,
    warrantyId: row.warranty_id || 'mfr',
    warrantyPrice: Number(row.warranty_price) || 0,
    serviceRequested: Number(row.service_requested) ? 1 : 0,
    sellerId: row.seller_id || null,
    manufacturerId: row.manufacturer_id || null,
    direction: row.direction || (Number(row.user_id) === Number(row._viewer) ? 'purchase' : 'sale'),
    status: row.status,
    createdAt: row.created_at
  };
}

function findManufacturerId(maker) {
  const mfrs = db.prepare("SELECT id, company_name FROM users WHERE account_type = 'manufacturer'").all();
  const hit = mfrs.find((u) => brandsMatch(u.company_name, maker));
  return hit ? hit.id : null;
}

router.get('/', requireAuth, safe((req, res) => {
  const rows = db.prepare(`
    SELECT orders.*, robots.name AS robot_name, robots.image AS robot_image
    FROM orders
    JOIN robots ON robots.id = orders.robot_id
    WHERE orders.user_id = ? OR orders.seller_id = ? OR orders.manufacturer_id = ?
    ORDER BY orders.created_at DESC
  `).all(req.user.id, req.user.id, req.user.id);
  res.json({
    orders: rows.map((row) => publicOrder({
      ...row,
      direction: Number(row.user_id) === Number(req.user.id) ? 'purchase' : 'sale'
    }))
  });
}));

router.post('/checkout', requireAuth, safe((req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const kind = req.body.kind === 'financing' ? 'financing' : 'buy';
  if (!items.length) return res.status(400).json({ error: 'Cart is empty.' });

  const insert = db.prepare(`
    INSERT INTO orders (user_id, robot_id, variant, price, qty, kind, warranty_id, warranty_price, service_requested, seller_id, manufacturer_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')
  `);
  const getRobot = db.prepare('SELECT * FROM robots WHERE id = ?');

  const created = [];
  const tx = db.transaction(() => {
    for (const item of items) {
      const robot = getRobot.get(String(item.robotId || ''));
      if (!robot) throw Object.assign(new Error('Listing not found: ' + item.robotId), { status: 404 });
      const variant = String(item.variant || '').trim() || null;
      const qty = Math.max(1, Number(item.qty) || 1);
      const variants = (() => { try { return JSON.parse(robot.variants_json || '[]'); } catch { return []; } })();
      const match = variants.find((v) => v.id === variant);
      const price = match && Number.isFinite(Number(match.price)) ? Number(match.price) : Number(robot.price) || 0;
      const attach = attachWarranty(item, price, qty);
      const sellerId = robot.seller_id || null;
      const manufacturerId = findManufacturerId(robot.maker);
      const info = insert.run(
        req.user.id, robot.id, variant, price, qty, kind,
        attach.warrantyId, attach.warrantyPrice, attach.serviceRequested,
        sellerId, manufacturerId
      );
      created.push(info.lastInsertRowid);
    }
  });

  try {
    tx();
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const rows = created.map((id) => db.prepare(`
    SELECT orders.*, robots.name AS robot_name, robots.image AS robot_image
    FROM orders JOIN robots ON robots.id = orders.robot_id WHERE orders.id = ?
  `).get(id));
  res.status(201).json({ orders: rows.map(publicOrder) });
}));

module.exports = router;
