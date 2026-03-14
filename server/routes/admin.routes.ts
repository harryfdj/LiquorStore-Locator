import express from 'express';
import { adminDb, getStoreDb } from '../dbManager';
import { requireAdmin } from '../middlewares/auth';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.use(requireAdmin);

router.get('/stores', (req, res) => {
  try {
    const stores = adminDb.prepare('SELECT id, name, created_at, password, csv_mapping, lat, lng, radius_miles FROM stores ORDER BY id DESC').all();
    res.json(stores.map((s: any) => ({
      ...s,
      csv_mapping: s.csv_mapping ? JSON.parse(s.csv_mapping) : {}
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

router.post('/stores', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Name and password required' });

  try {
    const result = adminDb.prepare('INSERT INTO stores (name, password) VALUES (?, ?)').run(name, password);
    res.json({ id: result.lastInsertRowid, name, password, success: true });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Store name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create store' });
    }
  }
});

router.delete('/stores/:id', (req, res) => {
  const { id } = req.params;
  try {
    adminDb.prepare('DELETE FROM stores WHERE id = ?').run(id);
    
    // Delete the isolated database file and connection
    const dbPath = path.join(process.cwd(), `store_${id}.db`);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete store' });
  }
});

router.delete('/stores/:id/data', (req, res) => {
  const { id } = req.params;
  try {
    const storeDb = getStoreDb(Number(id));
    storeDb.exec('DELETE FROM products');
    storeDb.exec('DELETE FROM stock_verifications');
    storeDb.exec('DELETE FROM weekly_reports');
    
    // Also delete all locally downloaded images for this specific store
    const imagesDir = path.join(process.cwd(), 'public', `product-images-${id}`);
    if (fs.existsSync(imagesDir)) {
      fs.rmSync(imagesDir, { recursive: true, force: true });
    }

    res.json({ success: true, message: 'Store data cleared' });
  } catch (error) {
    console.error('Failed to clear store data:', error);
    res.status(500).json({ error: 'Failed to clear store data', details: error instanceof Error ? error.message : String(error) });
  }
});

router.put('/stores/:id/mapping', (req, res) => {
  const { id } = req.params;
  const { mapping } = req.body;
  if (!mapping || typeof mapping !== 'object') {
    return res.status(400).json({ error: 'Valid mapping object required' });
  }

  try {
    adminDb.prepare('UPDATE stores SET csv_mapping = ? WHERE id = ?').run(JSON.stringify(mapping), id);
    res.json({ success: true, mapping });
  } catch (error) {
    console.error('Failed to update mapping:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

router.put('/stores/:id/location', (req, res) => {
  const { id } = req.params;
  const { lat, lng, radius_miles } = req.body;
  
  try {
    adminDb.prepare('UPDATE stores SET lat = ?, lng = ?, radius_miles = ? WHERE id = ?').run(
      lat ?? null, 
      lng ?? null, 
      radius_miles ?? null, 
      id
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update store location:', error);
    res.status(500).json({ error: 'Failed to update store location' });
  }
});

export default router;
