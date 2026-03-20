import Database from 'better-sqlite3';
import path from 'path';

export const adminDb = new Database(path.join(process.cwd(), 'admin.db'));

adminDb.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    csv_mapping TEXT DEFAULT '{}',
    lat REAL,
    lng REAL,
    radius_miles REAL
  )
`);

try {
  adminDb.exec(`ALTER TABLE stores ADD COLUMN csv_mapping TEXT DEFAULT '{}'`);
} catch (e) {}

try {
  adminDb.exec(`ALTER TABLE stores ADD COLUMN lat REAL`);
  adminDb.exec(`ALTER TABLE stores ADD COLUMN lng REAL`);
  adminDb.exec(`ALTER TABLE stores ADD COLUMN radius_miles REAL`);
} catch (e) {}

const storeDbs = new Map<number, Database.Database>();

export function getStoreDb(storeId: number): Database.Database {
  if (storeDbs.has(storeId)) {
    return storeDbs.get(storeId)!;
  }

  const db = new Database(path.join(process.cwd(), `store_${storeId}.db`));
  
  // Initialize store schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size TEXT,
      pack TEXT,
      price REAL,
      stock INTEGER,
      location TEXT,
      image_url TEXT,
      category TEXT,
      mainupc TEXT,
      depname TEXT,
      alt_upcs TEXT DEFAULT '',
      cost REAL
    )
  `);

  try {
    db.exec(`ALTER TABLE products ADD COLUMN alt_upcs TEXT DEFAULT ''`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE products ADD COLUMN cost REAL`);
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT,
      mainupc TEXT,
      name TEXT,
      system_stock INTEGER,
      actual_stock INTEGER,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      report_id INTEGER DEFAULT NULL
    )
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_verifications_unq 
    ON stock_verifications(sku, COALESCE(report_id, 0))
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_scanned INTEGER,
      total_matched INTEGER,
      total_mismatched INTEGER,
      total_value_cost REAL DEFAULT 0,
      total_value_retail REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.exec(`ALTER TABLE weekly_reports ADD COLUMN total_value_cost REAL DEFAULT 0`);
    db.exec(`ALTER TABLE weekly_reports ADD COLUMN total_value_retail REAL DEFAULT 0`);
  } catch (e) {}

  storeDbs.set(storeId, db);
  return db;
}
