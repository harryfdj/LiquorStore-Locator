import express from 'express';
import bcrypt from 'bcryptjs';
import { config, requireEnv } from '../lib/config';
import { createSupabaseAnonClient, mapStore, supabaseAdmin } from '../lib/supabase';
import { sendError } from '../lib/http';
import { loginSchema } from '../lib/schemas';
import { signStoreToken } from '../middlewares/auth';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const adminEmail = username.includes('@') ? username : config.ADMIN_EMAIL;

    if (adminEmail && (username.toLowerCase() === 'admin' || username.includes('@'))) {
      const supabase = createSupabaseAnonClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password,
      });

      if (!error && data.session?.access_token && data.user) {
        const { data: profile } = await supabaseAdmin
          .from('admin_profiles')
          .select('user_id,email')
          .eq('user_id', data.user.id)
          .single();

        if (profile) {
          return res.json({
            success: true,
            token: data.session.access_token,
            role: 'admin',
            email: profile.email,
          });
        }
      }
    }

    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .or(`code.eq.${username},name.eq.${username}`)
      .maybeSingle();

    if (error) throw error;
    if (store) {
      const isValidPassword = await bcrypt.compare(password, store.password_hash);
      if (isValidPassword) {
        const token = signStoreToken({ role: 'store', storeId: store.id, storeName: store.name });
        return res.json({
          success: true,
          token,
          role: 'store',
          storeName: store.name,
          storeId: store.id,
          lat: store.lat,
          lng: store.lng,
          radius_miles: store.radius_miles,
        });
      }
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    return sendError(res, error, 'Failed to login');
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    try {
      const { default: jwt } = await import('jsonwebtoken');
      const decoded = jwt.verify(token, requireEnv('APP_JWT_SECRET')) as any;
      if (decoded.role === 'store' && decoded.storeId) {
        const { data: store, error } = await supabaseAdmin
          .from('stores')
          .select('*')
          .eq('id', decoded.storeId)
          .single();

        if (error || !store) return res.status(401).json({ error: 'Invalid token' });
        return res.json({
          role: 'store',
          storeId: store.id,
          storeName: store.name,
          lat: store.lat,
          lng: store.lng,
          radius_miles: store.radius_miles,
        });
      }
    } catch {
      // Not a store token. Try Supabase Auth below.
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile } = await supabaseAdmin
      .from('admin_profiles')
      .select('email')
      .eq('user_id', data.user.id)
      .single();

    if (profile) {
      return res.json({
        role: 'admin',
        email: profile.email,
      });
    }

    return res.status(401).json({ error: 'Invalid token' });
  } catch (error) {
    return sendError(res, error, 'Failed to load session');
  }
});

export default router;
