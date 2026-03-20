import express from 'express';

const router = express.Router();
import { requireAuth } from '../middlewares/auth';
router.use(requireAuth);



// Finalize Weekly Report
router.post('/finalize', (req, res) => {
  try {
    // 1. Get current stats
    const stats = req.db!.prepare(`
      SELECT 
        COUNT(*) as total_scanned,
        SUM(CASE WHEN sv.status = 'matched' THEN 1 ELSE 0 END) as total_matched,
        SUM(CASE WHEN sv.status = 'mismatched' THEN 1 ELSE 0 END) as total_mismatched,
        SUM(sv.actual_stock * p.cost) as total_value_cost,
        SUM(sv.actual_stock * p.price) as total_value_retail
      FROM stock_verifications sv
      LEFT JOIN products p ON sv.sku = p.sku
      WHERE sv.report_id IS NULL
    `).get() as any;

    if (stats.total_scanned === 0) {
      return res.status(400).json({ error: 'No verifications to finalize' });
    }

    // 2. Insert into weekly_reports
    const stmt = req.db!.prepare(`
      INSERT INTO weekly_reports (total_scanned, total_matched, total_mismatched, total_value_cost, total_value_retail)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      stats.total_scanned, 
      stats.total_matched || 0, 
      stats.total_mismatched || 0,
      stats.total_value_cost || 0,
      stats.total_value_retail || 0
    );
    const newReportId = result.lastInsertRowid;

    // 3. Link verifications to the new report instead of deleting them
    const updateStmt = req.db!.prepare(`UPDATE stock_verifications SET report_id = ? WHERE report_id IS NULL`);
    updateStmt.run(newReportId);

    res.json({ success: true, message: 'Weekly report finalized', report_id: newReportId });
  } catch (error) {
    console.error('Error finalizing report:', error);
    res.status(500).json({ error: 'Failed to finalize report' });
  }
});

// Get Historical Weekly Reports
router.get('/', (req, res) => {
  try {
    const reports = req.db!.prepare('SELECT * FROM weekly_reports ORDER BY created_at DESC').all();
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get specific items for a historical report
router.get('/:id/items', (req, res) => {
  try {
    const items = req.db!.prepare(`
      SELECT sv.*, p.image_url, p.cost, p.price
      FROM stock_verifications sv 
      LEFT JOIN products p ON sv.sku = p.sku 
      WHERE sv.report_id = ? 
      ORDER BY sv.created_at DESC
    `).all(req.params.id);
    res.json(items);
  } catch (error) {
    console.error('Error fetching report items:', error);
    res.status(500).json({ error: 'Failed to fetch report items' });
  }
});

export default router;
