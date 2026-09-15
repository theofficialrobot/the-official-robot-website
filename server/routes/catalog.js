const express = require('express');
const path = require('path');
const { warrantyPlans } = require('../warranty');
const { TYPE_SPEC_GROUPS } = require('../specGroups');
const { safe } = require('../util');

const router = express.Router();
const catalog = require(path.join(__dirname, '..', '..', 'data', 'robots.js'));
const ROBOTS = catalog.ROBOTS || {};

const TYPE_ORDER = { humanoid: 0, hand: 1, campanionoid: 2, aerial: 3, water: 4 };

router.get('/spec-groups', safe((_req, res) => {
  res.json({ specGroups: TYPE_SPEC_GROUPS });
}));

router.get('/', safe((_req, res) => {
  const robots = Object.values(ROBOTS).map((robot) => ({
    id: robot.id,
    name: robot.name,
    maker: robot.maker || '',
    type: robot.type || 'humanoid',
    year: robot.releaseYear || null,
    image: robot.image || null,
    price: Number(robot.basePrice) || 0
  })).sort((a, b) => {
    const byType = (TYPE_ORDER[a.type] ?? 5) - (TYPE_ORDER[b.type] ?? 5);
    if (byType) return byType;
    return String(a.name || '').localeCompare(String(b.name || ''), 'en');
  });
  res.json({ robots, warrantyPlans: warrantyPlans() });
}));

module.exports = router;
