import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../lib/config';
import { supabaseAdmin } from '../lib/supabase';

type StoreTokenPayload = {
  role: 'store';
  storeId: string;
  storeName: string;
};

export const signStoreToken = (payload: StoreTokenPayload) => {
  return jwt.sign(payload, requireEnv('APP_JWT_SECRET'), { expiresIn: '12h' });
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, requireEnv('APP_JWT_SECRET')) as StoreTokenPayload;
    if (decoded.role === 'store' && decoded.storeId) {
      const { data: store, error } = await supabaseAdmin
        .from('stores')
        .select('*')
        .eq('id', decoded.storeId)
        .single();

      if (error || !store) return res.status(401).json({ error: 'Store not found' });

      req.user = {
        role: 'store',
        tokenType: 'store',
        storeId: decoded.storeId,
        storeName: decoded.storeName,
        store,
      };
      return next();
    }
  } catch {
    // Not an app store token; fall through to Supabase Auth verification.
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('admin_profiles')
    .select('user_id,email')
    .eq('user_id', data.user.id)
    .single();

  if (profileError || !profile) return res.status(403).json({ error: 'Admin profile required' });

  req.user = {
    role: 'admin',
    tokenType: 'supabase',
    userId: data.user.id,
    email: profile.email,
  };
  return next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};
