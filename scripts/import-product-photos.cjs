const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dlDir = 'C:\\Users\\johnn\\Downloads';
const imgDir = path.join(root, 'imagine_images');
const catalogPath = path.join(root, 'data', 'robots.js');

const files = [
  '[Tokyo Robotics] ToraOne (2026).webp',
  '[Under Control Robotics] Moby old (2026).webp',
  '[Unitree Robotics] H2 Plus (2026).webp',
  '[VideoRay] Mission Specialist, Ally, Wraith, Defender (2010).webp',
  '[Weilan] Industrial Quadruped (2022).webp',
  '[Westwood Robotics] THEMIS V2 (2026).webp',
  '[Xiaomi] CyberDog 2, Pro (2023).webp',
  '[AgiBot] AGIBOT A2-W (2026).webp',
  '[AgiBot] A2 Max (2026).webp',
  '[Anduril] Dive-LD (2020).webp',
  '[Anduril] Dive-XL (2020).webp',
  '[CASBOT, Beijing Zhongke Huiling Robotics Technology Co., Ltd.] CASBOT W1 (2026).webp',
  '[Faraday Future Intelligent Electric Inc.] FF Master (2026).webp',
  '[Hexagon] AEON (2026).webp',
  '[GigaAI] Maker H01 (2026).webp',
  '[Humanoid.ai] HMND 01 (2026).webp',
  '[Lanxin Robotics] VB1-I (2026).webp',
  '[Kongsberg] HUGIN Series (2022).webp',
  '[Leju Robot] Roban2 (2026).webp',
  '[Leju Robotics] Kuavo-my (2026).webp',
  '[LG Electronics] CLOiD (2026).webp',
  '[Lumos Robotics] NIX (2026).webp',
  '[Mentee Robotics] MenteeBot V3 (2026).webp',
  '[Mentee Robotics] MenteeBot (2022).webp',
  '[NineRay] RayNex G3 (2026).webp',
  '[Noetix Robotics] Hobbs (2026).webp',
  '[Noetix] N2 (2025).webp',
  '[Noetix] N2, Athlete, EDU (2025).webp',
  '[Nori Robotics] NORI L3 (2026).webp',
  '[OceanAlpha] L25, L42 (2018).webp',
  '[OceanAlpha] L30, M75 (2018).webp',
  '[OceanAlpha] M40P, SL (2015).webp',
  '[O-ID] Modular (2026).webp',
  '[OpenLoong] Qinglong V3.0 (2026).webp',
  '[PAL Robotics] Kangaroo (2026).webp',
  '[PHYBOT] PHYBOT C1 (2026).webp',
  '[PHYBOT] PHYBOT M1 (2026).webp',
  '[PNDbotics] Adam SP (2026).webp',
  '[RoboForce] TITAN (2026).webp',
  '[Saildrone] Voyager (2023).webp',
  '[Sunday Robotics] MEMO (2026).webp',
  '[Svaya Robotics] Bimanual (2026).webp'
];

function stem(p) {
  return path.basename(p).replace(/\.(webp|png|jpg|jpeg)$/i, '');
}
function norm(s) {
  return String(s || '').toLowerCase().replace(/[\[\]\/,._-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const catalog = require(catalogPath);
const robots = Object.values(catalog.ROBOTS);

for (const f of files) {
  const src = path.join(dlDir, f);
  if (!fs.existsSync(src)) throw new Error('Missing download: ' + f);
  fs.copyFileSync(src, path.join(imgDir, f));
}

const destSet = new Set(files);
const updates = []; // {id, from, to}

function pickFileForRobot(r) {
  const name = r.name;
  const imgStem = r.image ? stem(r.image) : '';
  const imgBase = r.image ? path.basename(r.image) : '';

  // 1. filename stem equals display name
  const exactName = files.find((f) => stem(f) === name);
  if (exactName) return exactName;

  // 2. already pointing at this filename (png or webp)
  const sameBase = files.find((f) => stem(f) === imgStem);
  if (sameBase) return sameBase;

  // 3. catalog name with slash vs download with comma
  const nName = norm(name);
  const byNormName = files.find((f) => norm(stem(f)) === nName);
  if (byNormName) return byNormName;

  // 4. Sunday MEMO vs Memo
  if (nName === 'sunday robotics memo 2026') {
    return files.find((f) => norm(stem(f)) === 'sunday robotics memo 2026');
  }

  // 5. Unitree H2 Plus: display [Unitree] H2 Plus (2025), file [Unitree Robotics] H2 Plus (2026)
  if (r.id === 'unitree_robotics_h2_plus') {
    return '[Unitree Robotics] H2 Plus (2026).webp';
  }

  // 6. GigaAI Maker H01.webp (no year) -> Maker H01 (2026).webp
  if (imgStem === '[GigaAI] Maker H01' || name === '[GigaAI] Maker H01 (2026)') {
    return '[GigaAI] Maker H01 (2026).webp';
  }

  return null;
}

for (const r of robots) {
  const chosen = pickFileForRobot(r);
  if (!chosen) continue;
  const next = 'imagine_images/' + chosen;
  const prev = r.image || '';
  if (prev !== next) {
    updates.push({ id: r.id, name: r.name, from: prev, to: next });
  }
}

let src = fs.readFileSync(catalogPath, 'utf8');
for (const u of updates) {
  if (!u.from) {
    // insert image line after name if missing — rare; skip unless we can find the object
    continue;
  }
  const fromRel = u.from.replace(/\\/g, '/');
  const toRel = u.to.replace(/\\/g, '/');
  // Replace only within this robot if the old path is unique, else replace all (shared images stay shared)
  const count = src.split(fromRel).length - 1;
  if (count === 1) {
    src = src.replace(fromRel, toRel);
  } else if (fromRel !== toRel) {
    // shared old path: replace all occurrences of that path
    src = src.split(fromRel).join(toRel);
  }
}
fs.writeFileSync(catalogPath, src, 'utf8');

// Re-require is cached; parse image fields from updated file via regex
const used = new Set();
const imgRe = /image: '([^']+)'/g;
let m;
const updatedText = fs.readFileSync(catalogPath, 'utf8');
while ((m = imgRe.exec(updatedText))) used.add(path.basename(m[1]));

const brandKeep = /official|icon|logo|mark|splash|or_mark/i;
const deleted = [];
for (const u of updates) {
  if (!u.from) continue;
  const base = path.basename(u.from);
  if (base === path.basename(u.to)) continue;
  if (used.has(base)) continue;
  if (brandKeep.test(base)) continue;
  const p = path.join(imgDir, base);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    deleted.push(base);
  }
}

console.log('copied', files.length);
console.log('path updates', updates.length);
updates.forEach((u) => console.log('  ' + u.id + '\n    ' + u.from + '\n    -> ' + u.to));
console.log('deleted', deleted.length);
deleted.forEach((d) => console.log('  ' + d));
