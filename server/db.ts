import Database from 'better-sqlite3';

const db = new Database('inventory.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    sku TEXT PRIMARY KEY,
    name TEXT,
    size TEXT,
    pack TEXT,
    price REAL,
    stock INTEGER,
    location TEXT,
    image_url TEXT,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS stock_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT,
    mainupc TEXT,
    name TEXT,
    system_stock INTEGER,
    actual_stock INTEGER,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS weekly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_scanned INTEGER,
    total_matched INTEGER,
    total_mismatched INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add report_id to stock_verifications
try {
  db.exec(`ALTER TABLE stock_verifications ADD COLUMN report_id INTEGER DEFAULT NULL`);
} catch (e) {}

// Add category column if it doesn't exist (for existing DBs)
try {
  db.exec(`ALTER TABLE products ADD COLUMN category TEXT DEFAULT ''`);
} catch (e) {}

// Add mainupc column if it doesn't exist
try {
  db.exec(`ALTER TABLE products ADD COLUMN mainupc TEXT DEFAULT ''`);
} catch (e) {}

// Add depname column if it doesn't exist
try {
  db.exec(`ALTER TABLE products ADD COLUMN depname TEXT DEFAULT ''`);
} catch (e) {}

export default db;
