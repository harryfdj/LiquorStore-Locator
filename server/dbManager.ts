import Database from 'better-sqlite3';
import path from 'path';

export const adminDb = new Database(path.join(process.cwd(), 'admin.db'));

adminDb.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

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
      depname TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL,
      system_stock INTEGER NOT NULL,
      actual_stock INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sku) REFERENCES products(sku)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_items INTEGER NOT NULL,
      matched_items INTEGER NOT NULL,
      mismatched_items INTEGER NOT NULL,
      accuracy_percentage REAL NOT NULL,
      report_data TEXT NOT NULL
    )
  `);

  storeDbs.set(storeId, db);
  return db;
}
