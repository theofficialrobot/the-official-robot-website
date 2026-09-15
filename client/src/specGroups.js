import { api } from './api';

export const MINI_SPEC_KEYS = {
  humanoid: ['Height', 'Weight', 'Degrees of Freedom', 'Payload', 'Max Speed', 'Battery / Runtime'],
  hand: ['Degrees of Freedom', 'Fingers', 'Weight', 'Payload', 'Motor Tech', 'Tactile / Force Sensors'],
  campanionoid: ['Weight', 'Degrees of Freedom', 'Payload', 'Max Speed', 'Battery / Runtime', 'Camera / Vision'],
  aerial: ['Weight', 'Flight Time', 'Payload', 'Max Speed', 'Camera / Vision', 'Battery / Runtime'],
  water: ['Weight', 'Payload', 'Depth Rating', 'Camera / Vision', 'Battery / Runtime', 'Control Interface']
};

const KEY_SPEC_ORDER = [
  'Height', 'Standing Envelope', 'Standing Size', 'Standing Height', 'Size',
  'Weight', 'Operating Weight',
  'Degrees of Freedom', 'DOF',
  'Max Speed', 'Speed',
  'Payload', 'Payload Capacity',
  'Battery / Runtime', 'Battery', 'Runtime'
];

export const HUMANOID_SPEC_GROUPS = [
  { name: 'General', keys: ['Type', 'Manufacturer', 'Model', 'Model Year', 'Origin', 'Status', 'Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Height', 'Weight', 'Standing Envelope'] },
  { name: 'Performance', keys: ['Degrees of Freedom', 'Max Speed', 'Walking Speed', 'Payload', 'Rise After Fall'] },
  { name: 'Power', keys: ['Battery / Runtime', 'Charging'] },
  { name: 'Manipulation', keys: ['Hands / End-effectors', 'Hand DOF', 'Number of Fingers', 'Manipulation Score'] },
  { name: 'Sensing', keys: ['Camera / Vision', 'Camera Resolution', 'Video', 'Audio', 'LiDAR', 'Sensors', 'Tactile / Force Sensors'] },
  { name: 'Compute & software', keys: ['Compute', 'CPU / GPU', 'Operating System', 'LLM Integration', 'Connectivity', 'Control Interface', 'Navigation', 'Navigation Score'] },
  { name: 'Mechanical', keys: ['Motor Tech', 'Gear Tech', 'Main Structural Material', 'IP Rating', 'Safe with Humans'] },
  { name: 'Commercial', keys: ['List Price', 'Warranty (std)', 'Best Fit'] }
];

export const CAMPANIONOID_SPEC_GROUPS = [
  { name: 'General', keys: ['Type', 'Manufacturer', 'Model', 'Model Year', 'Origin', 'Status', 'Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Standing Size', 'Height', 'Weight'] },
  { name: 'Performance', keys: ['Degrees of Freedom', 'Max Speed', 'Payload'] },
  { name: 'Power', keys: ['Battery / Runtime', 'Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision', 'Video', 'LiDAR', 'Sensors', 'Obstacle Sensing'] },
  { name: 'Compute & software', keys: ['Compute', 'Connectivity', 'Control Interface', 'Navigation'] },
  { name: 'Mechanical', keys: ['Motor Tech', 'IP Rating', 'Operating Environment'] },
  { name: 'Commercial', keys: ['List Price', 'Warranty (std)', 'Best Fit'] }
];

export const AERIAL_SPEC_GROUPS = [
  { name: 'General', keys: ['Type', 'Manufacturer', 'Model', 'Model Year', 'Origin', 'Status', 'Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight', 'Size / Envelope'] },
  { name: 'Performance', keys: ['Max Speed', 'Flight Time', 'Range / Link', 'Payload'] },
  { name: 'Power', keys: ['Battery / Runtime', 'Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision', 'Video', 'Gimbal', 'Obstacle Sensing'] },
  { name: 'Compute & software', keys: ['Compute', 'Connectivity', 'Control Interface'] },
  { name: 'Mechanical', keys: ['IP Rating', 'Operating Environment'] },
  { name: 'Commercial', keys: ['List Price', 'Warranty (std)', 'Best Fit'] }
];

export const WATER_SPEC_GROUPS = [
  { name: 'General', keys: ['Type', 'Manufacturer', 'Model', 'Model Year', 'Origin', 'Status', 'Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight', 'Size / Envelope'] },
  { name: 'Performance', keys: ['Depth Rating', 'Payload', 'Max Speed'] },
  { name: 'Power', keys: ['Battery / Runtime', 'Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision', 'Video', 'Lights', 'Sensors'] },
  { name: 'Propulsion', keys: ['Thrusters', 'Tether', 'Range / Link'] },
  { name: 'Compute & software', keys: ['Control Interface', 'Connectivity', 'Navigation'] },
  { name: 'Mechanical', keys: ['IP Rating', 'Operating Environment'] },
  { name: 'Commercial', keys: ['List Price', 'Warranty (std)', 'Best Fit'] }
];

export const HAND_SPEC_GROUPS = [
  { name: 'General', keys: ['Type', 'Manufacturer', 'Model', 'Model Year', 'Origin', 'Status', 'Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight', 'Size', 'Envelope'] },
  { name: 'Performance', keys: ['Degrees of Freedom', 'Fingers', 'Payload', 'Strength'] },
  { name: 'Sensing', keys: ['Tactile / Force Sensors'] },
  { name: 'Mechanical', keys: ['Motor Tech', 'Structure'] },
  { name: 'Commercial', keys: ['List Price', 'Warranty (std)', 'Best Fit'] }
];

export const TYPE_SPEC_GROUPS = {
  humanoid: HUMANOID_SPEC_GROUPS,
  campanionoid: CAMPANIONOID_SPEC_GROUPS,
  aerial: AERIAL_SPEC_GROUPS,
  water: WATER_SPEC_GROUPS,
  hand: HAND_SPEC_GROUPS
};

export function isUndisclosed(v) {
  if (v == null) return true;
  const s = String(v).trim();
  return !s || /^(not disclosed|—|-|n\/a|na|unknown)$/i.test(s);
}

export function pickMiniSpecs(robot) {
  if (!robot || !robot.specs) return [];
  const keys = MINI_SPEC_KEYS[robot.type] || KEY_SPEC_ORDER.slice(0, 6);
  const specs = robot.specs;
  const entries = Object.entries(specs);
  return keys.map((key) => {
    const exact = specs[key];
    if (exact != null && String(exact).trim() !== '') return [key, exact];
    const found = entries.find(([k]) => k.toLowerCase() === key.toLowerCase() || k.toLowerCase().includes(key.toLowerCase()));
    return [key, found ? found[1] : 'Not disclosed'];
  });
}

export function groupsForType(type, groups = TYPE_SPEC_GROUPS) {
  return (groups && groups[type]) || TYPE_SPEC_GROUPS[type] || [];
}

export function groupedSpecRows(robot, groups = TYPE_SPEC_GROUPS) {
  const specs = (robot && robot.specs) || {};
  const list = groupsForType(robot && robot.type, groups);
  const used = new Set();
  const out = [];
  for (const g of list) {
    const rows = (g.keys || []).map((k) => {
      used.add(k);
      const empty = isUndisclosed(specs[k]);
      return { key: k, value: empty ? 'Not disclosed' : String(specs[k]), empty };
    });
    out.push({ name: g.name, rows });
  }
  const extras = Object.entries(specs).filter(([k]) => !used.has(k));
  if (extras.length) {
    out.push({
      name: 'Additional',
      rows: extras.map(([k, v]) => {
        const empty = isUndisclosed(v);
        return { key: k, value: empty ? 'Not disclosed' : String(v), empty };
      })
    });
  }
  return out;
}

function normalizeGroups(data) {
  if (!data || typeof data !== 'object') return null;
  const raw = data.specGroups || data.groups || data;
  if (!raw || typeof raw !== 'object') return null;
  if (raw.humanoid || raw.campanionoid || raw.aerial || raw.water || raw.hand) {
    const out = { ...TYPE_SPEC_GROUPS };
    for (const type of Object.keys(TYPE_SPEC_GROUPS)) {
      if (Array.isArray(raw[type]) && raw[type].length) out[type] = raw[type];
    }
    return out;
  }
  return null;
}

let cachedGroups = null;
let groupsPromise = null;

export async function loadSpecGroups() {
  if (cachedGroups) return cachedGroups;
  if (groupsPromise) return groupsPromise;
  groupsPromise = api('/api/catalog/spec-groups')
    .then((d) => {
      cachedGroups = normalizeGroups(d) || TYPE_SPEC_GROUPS;
      return cachedGroups;
    })
    .catch(() => {
      cachedGroups = TYPE_SPEC_GROUPS;
      return cachedGroups;
    })
    .finally(() => {
      groupsPromise = null;
    });
  return groupsPromise;
}
