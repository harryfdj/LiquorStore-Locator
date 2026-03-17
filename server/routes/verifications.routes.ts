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
      VALUES (@sku, @mainupc, @name, @system_stock, @actual_stock, @status)
      ON CONFLICT(sku, COALESCE(report_id, 0)) DO UPDATE SET
        system_stock = excluded.system_stock,
        actual_stock = excluded.actual_stock,
        status = excluded.status,
        created_at = CURRENT_TIMESTAMP
    `);
    stmt.run({ sku, mainupc, name, system_stock, actual_stock, status });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving verification:', error);
    res.status(500).json({ error: 'Failed to save verification' });
  }
});

// Get all stock verifications (active/unreported only)
router.get('/', (req, res) => {
  try {
    const verifications = req.db!.prepare(`
      SELECT sv.*, p.image_url 
      FROM stock_verifications sv 
      LEFT JOIN products p ON sv.sku = p.sku 
      WHERE sv.report_id IS NULL 
      ORDER BY sv.created_at DESC
    `).all();
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
