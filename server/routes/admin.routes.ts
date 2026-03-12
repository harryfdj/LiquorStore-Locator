import express from 'express';
import { adminDb } from '../dbManager';
import { requireAdmin } from '../middlewares/auth';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.use(requireAdmin);

router.get('/stores', (req, res) => {
  try {
    const stores = adminDb.prepare('SELECT id, name, created_at, password FROM stores ORDER BY id DESC').all();
    res.json(stores);
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

export default router;
