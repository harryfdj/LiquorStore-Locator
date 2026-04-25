import express from 'express';

const router = express.Router();
import { requireAuth } from '../middlewares/auth';
import { requireStoreId, sendError } from '../lib/http';
import { verificationSchema } from '../lib/schemas';
import { supabaseAdmin } from '../lib/supabase';
router.use(requireAuth);

// Save a stock verification
router.post('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const body = verificationSchema.parse(req.body);

    const { data: existing } = await supabaseAdmin
      .from('stock_verifications')
      .select('id')
      .eq('store_id', storeId)
      .eq('sku', body.sku)
      .is('report_id', null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('stock_verifications')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('stock_verifications')
        .insert({ ...body, store_id: storeId });
      if (error) throw error;
    }

    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error, 'Failed to save verification');
  }
});

// Get all stock verifications (active/unreported only)
router.get('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { data, error } = await supabaseAdmin
      .from('stock_verifications')
      .select('*')
      .eq('store_id', storeId)
      .is('report_id', null)
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
    return sendError(res, error, 'Failed to fetch verifications');
  }
});

// Clear all stock verifications (active ones)
router.delete('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { error } = await supabaseAdmin
      .from('stock_verifications')
      .delete()
      .eq('store_id', storeId)
      .is('report_id', null);

    if (error) throw error;
    return res.json({ success: true, message: 'Verifications cleared' });
  } catch (error) {
    return sendError(res, error, 'Failed to clear verifications');
  }
});

export default router;
