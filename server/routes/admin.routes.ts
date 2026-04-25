import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../middlewares/auth';
import { mapStore, supabaseAdmin } from '../lib/supabase';
import { parseBody, sendError } from '../lib/http';
import { createStoreSchema, updateLocationSchema, updateMappingSchema } from '../lib/schemas';

const router = express.Router();

router.use(requireAdmin);

router.get('/stores', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json((data || []).map(mapStore));
  } catch (error) {
    return sendError(res, error, 'Failed to fetch stores');
  }
});

router.post('/stores', async (req, res) => {
  try {
    const { name, password, code } = parseBody(createStoreSchema, req.body);
    const password_hash = await bcrypt.hash(password, 12);
    const storeCode = code || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { data, error } = await supabaseAdmin
      .from('stores')
      .insert({ name, code: storeCode, password_hash })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Store code already exists' });
      throw error;
    }

    return res.status(201).json({ ...mapStore(data), success: true, temporary_password_set: true });
  } catch (error) {
    return sendError(res, error, 'Failed to create store');
  }
});

router.delete('/stores/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('stores').delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error, 'Failed to delete store');
  }
});

router.delete('/stores/:id/data', async (req, res) => {
  const { id } = req.params;
  try {
    const tables = ['stock_verifications', 'verification_reports', 'products'];
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq('store_id', id);
      if (error) throw error;
    }

    const { data: files } = await supabaseAdmin.storage.from('product-images').list(id);
    if (files && files.length > 0) {
      await supabaseAdmin.storage.from('product-images').remove(files.map(file => `${id}/${file.name}`));
    }

    return res.json({ success: true, message: 'Store data cleared' });
  } catch (error) {
    return sendError(res, error, 'Failed to clear store data');
  }
});

router.put('/stores/:id/mapping', async (req, res) => {
  const { id } = req.params;
  try {
    const { mapping } = parseBody(updateMappingSchema, req.body);
    const { data, error } = await supabaseAdmin
      .from('stores')
      .update({ csv_mapping: mapping })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return res.json({ ...mapStore(data), success: true, mapping });
  } catch (error) {
    return sendError(res, error, 'Failed to update mapping');
  }
});

router.put('/stores/:id/location', async (req, res) => {
  const { id } = req.params;

  try {
    const body = parseBody(updateLocationSchema, req.body);
    const { data, error } = await supabaseAdmin
      .from('stores')
      .update({
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        radius_miles: body.radius_miles ?? null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return res.json({ ...mapStore(data), success: true });
  } catch (error) {
    return sendError(res, error, 'Failed to update store location');
  }
});

export default router;
