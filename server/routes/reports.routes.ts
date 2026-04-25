import express from 'express';

const router = express.Router();
import { requireAuth } from '../middlewares/auth';
import { requireStoreId, sendError } from '../lib/http';
import { supabaseAdmin } from '../lib/supabase';
router.use(requireAuth);



// Finalize Weekly Report
router.post('/finalize', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { data: verifications, error } = await supabaseAdmin
      .from('stock_verifications')
      .select('*')
      .eq('store_id', storeId)
      .is('report_id', null);

    if (error) throw error;
    if (!verifications || verifications.length === 0) {
      return res.status(400).json({ error: 'No verifications to finalize' });
    }

    const skus = [...new Set(verifications.map((row: any) => row.sku))];
    const { data: products, error: productError } = await supabaseAdmin
      .from('products')
      .select('sku,cost,price')
      .eq('store_id', storeId)
      .in('sku', skus);

    if (productError) throw productError;
    const productBySku = new Map((products || []).map((product: any) => [product.sku, product]));

    const stats = verifications.reduce((acc: any, verification: any) => {
      const product = productBySku.get(verification.sku) as any;
      acc.total_scanned += 1;
      if (verification.status === 'matched') acc.total_matched += 1;
      if (verification.status === 'mismatched') acc.total_mismatched += 1;
      acc.total_value_cost += Number(verification.actual_stock) * Number(product?.cost || 0);
      acc.total_value_retail += Number(verification.actual_stock) * Number(product?.price || 0);
      return acc;
    }, {
      total_scanned: 0,
      total_matched: 0,
      total_mismatched: 0,
      total_value_cost: 0,
      total_value_retail: 0,
    });

    const { data: report, error: reportError } = await supabaseAdmin
      .from('verification_reports')
      .insert({ ...stats, store_id: storeId })
      .select('*')
      .single();

    if (reportError) throw reportError;

    const { error: updateError } = await supabaseAdmin
      .from('stock_verifications')
      .update({ report_id: report.id })
      .eq('store_id', storeId)
      .is('report_id', null);

    if (updateError) throw updateError;

    return res.json({ success: true, message: 'Weekly report finalized', report_id: report.id });
  } catch (error) {
    return sendError(res, error, 'Failed to finalize report');
  }
});

// Get Historical Weekly Reports
router.get('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { data, error } = await supabaseAdmin
      .from('verification_reports')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return sendError(res, error, 'Failed to fetch reports');
  }
});

// Get specific items for a historical report
router.get('/:id/items', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { data, error } = await supabaseAdmin
      .from('stock_verifications')
      .select('*')
      .eq('store_id', storeId)
      .eq('report_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const skus = [...new Set((data || []).map((row: any) => row.sku))];
    const { data: products, error: productError } = await supabaseAdmin
      .from('products')
      .select('sku,image_url,cost,price')
      .eq('store_id', storeId)
      .in('sku', skus.length > 0 ? skus : ['__none__']);

    if (productError) throw productError;
    const productBySku = new Map((products || []).map((product: any) => [product.sku, product]));

    return res.json((data || []).map((row: any) => {
      const product = productBySku.get(row.sku) as any;
      return {
        ...row,
        image_url: product?.image_url || '',
        cost: Number(product?.cost || 0),
        price: Number(product?.price || 0),
      };
    }));
  } catch (error) {
    return sendError(res, error, 'Failed to fetch report items');
  }
});

export default router;
