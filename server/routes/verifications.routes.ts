import express from 'express';

const router = express.Router();
import { requireAuth } from '../middlewares/auth';
router.use(requireAuth);

// Save a stock verification
router.post('/', (req, res) => {
  const { sku, mainupc, name, system_stock, actual_stock, status } = req.body;
  try {
    const stmt = req.db!.prepare(`
      INSERT INTO stock_verifications (sku, mainupc, name, system_stock, actual_stock, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(sku, mainupc, name, system_stock, actual_stock, status);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving verification:', error);
    res.status(500).json({ error: 'Failed to save verification' });
  }
});

// Get all stock verifications (active/unreported only)
router.get('/', (req, res) => {
  try {
    const verifications = req.db!.prepare('SELECT * FROM stock_verifications WHERE report_id IS NULL ORDER BY created_at DESC').all();
    res.json(verifications);
  } catch (error) {
    console.error('Error fetching verifications:', error);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// Clear all stock verifications (active ones)
router.delete('/', (req, res) => {
  try {
    req.db!.exec('DELETE FROM stock_verifications WHERE report_id IS NULL');
    res.json({ success: true, message: 'Verifications cleared' });
  } catch (error) {
    console.error('Error clearing verifications:', error);
    res.status(500).json({ error: 'Failed to clear verifications' });
  }
});

export default router;
