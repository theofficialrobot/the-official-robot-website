const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const uploadsRoot = path.join(__dirname, 'uploads');
for (const dir of [uploadsRoot, path.join(uploadsRoot, 'listings'), path.join(uploadsRoot, 'reviews'), path.join(uploadsRoot, 'kyc')]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'marketplace.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  account_type TEXT NOT NULL DEFAULT 'individual',
  company_name TEXT,
  company_domain TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  verify_expires TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS robots (
  id TEXT PRIMARY KEY,
  seller_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  maker TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'humanoid',
  condition TEXT NOT NULL DEFAULT 'new',
  year INTEGER,
  model_number TEXT,
  price REAL NOT NULL DEFAULT 0,
  image TEXT,
  images_json TEXT NOT NULL DEFAULT '[]',
  short_desc TEXT,
  unique_summary TEXT,
  ideal_for TEXT,
  specs_intro TEXT,
  specs_json TEXT NOT NULL DEFAULT '{}',
  highlights_json TEXT NOT NULL DEFAULT '[]',
  variants_json TEXT NOT NULL DEFAULT '[]',
  colors_json TEXT NOT NULL DEFAULT '[]',
  website TEXT,
  icon TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  mfr_edited INTEGER NOT NULL DEFAULT 0,
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_robots_type ON robots(type);
CREATE INDEX IF NOT EXISTS idx_robots_condition ON robots(condition);
CREATE INDEX IF NOT EXISTS idx_robots_price ON robots(price);
CREATE INDEX IF NOT EXISTS idx_robots_search ON robots(search_text);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  robot_id TEXT NOT NULL REFERENCES robots(id),
  variant TEXT,
  price REAL NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'buy',
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  robot_id TEXT NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  photos_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(robot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_robot ON reviews(robot_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_robot ON orders(robot_id);

CREATE TABLE IF NOT EXISTS user_kyc (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  citizenship_country TEXT NOT NULL,
  birth_country TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  id_type TEXT NOT NULL,
  id_country TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company_kyc (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  state_of_registration TEXT NOT NULL,
  registration_number TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT NOT NULL,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

try { db.exec('DROP TABLE IF EXISTS comments'); } catch (_) { /* gone */ }

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function ensureColumn(table, name, ddl, afterAdd) {
  if (tableColumns(table).includes(name)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  if (afterAdd) afterAdd();
  return true;
}

try { db.exec('ALTER TABLE orders ADD COLUMN qty INTEGER NOT NULL DEFAULT 1'); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE orders ADD COLUMN kind TEXT NOT NULL DEFAULT \'buy\''); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE robots ADD COLUMN catalog_id TEXT'); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE robots ADD COLUMN inspection_notes TEXT'); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE orders ADD COLUMN warranty_id TEXT'); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE orders ADD COLUMN warranty_price REAL NOT NULL DEFAULT 0'); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE orders ADD COLUMN service_requested INTEGER NOT NULL DEFAULT 0'); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE orders ADD COLUMN seller_id INTEGER'); } catch (_) { /* exists */ }
try { db.exec('ALTER TABLE orders ADD COLUMN manufacturer_id INTEGER'); } catch (_) { /* exists */ }

ensureColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'user'");
ensureColumn('users', 'email_verified', 'email_verified INTEGER NOT NULL DEFAULT 0', () => {
  db.exec('UPDATE users SET email_verified = 1');
});
ensureColumn('users', 'verify_token', 'verify_token TEXT');
ensureColumn('users', 'verify_expires', 'verify_expires TEXT');
ensureColumn('users', 'first_name', 'first_name TEXT');
ensureColumn('users', 'last_name', 'last_name TEXT');
ensureColumn('users', 'account_type', "account_type TEXT NOT NULL DEFAULT 'individual'");
ensureColumn('users', 'company_name', 'company_name TEXT');
ensureColumn('users', 'company_domain', 'company_domain TEXT');
ensureColumn('robots', 'images_json', "images_json TEXT NOT NULL DEFAULT '[]'");
ensureColumn('robots', 'model_number', 'model_number TEXT');
ensureColumn('robots', 'mfr_edited', 'mfr_edited INTEGER NOT NULL DEFAULT 0');
ensureColumn('robots', 'item_condition', 'item_condition TEXT');
ensureColumn('robots', 'list_price', 'list_price REAL');
ensureColumn('robots', 'discount_pct', 'discount_pct REAL NOT NULL DEFAULT 0');
try {
  db.exec("UPDATE robots SET condition = 'used', item_condition = COALESCE(NULLIF(item_condition, ''), 'excellent') WHERE condition = 'like_new'");
} catch (_) { /* ignore */ }
db.exec('CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token)');

try {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_robots_unique_custom_maker_name
    ON robots (lower(trim(maker)), lower(trim(name)))
    WHERE source = 'user' AND catalog_id IS NULL
  `);
} catch (err) {
  console.error('Could not create custom-bot unique index:', err.message);
}

try {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_robots_unique_seller_catalog
    ON robots (seller_id, catalog_id)
    WHERE source = 'user' AND catalog_id IS NOT NULL AND seller_id IS NOT NULL
  `);
} catch (err) {
  console.error('Could not create seller-catalog unique index:', err.message);
}

function ensureAdmin() {
  const email = 'admin@theofficialrobot.com';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;
  const password_hash = bcrypt.hashSync('AdminRobot2026!', 10);
  db.prepare(`
    INSERT INTO users (email, name, password_hash, role, email_verified)
    VALUES (?, ?, ?, 'admin', 1)
  `).run(email, 'Admin', password_hash);
}

ensureAdmin();

function buildSearchText(row) {
  const specs = typeof row.specs === 'object' ? JSON.stringify(row.specs) : String(row.specs || '');
  return [
    row.name, row.maker, row.type, row.condition, row.year,
    row.short_desc, row.unique_summary, specs
  ].filter(Boolean).join(' ').toLowerCase();
}

module.exports = { db, buildSearchText, ensureAdmin, uploadsRoot };
