import type { StoreRow } from '../lib/supabase';

declare global {
  namespace Express {
    interface Request {
      user?: {
        role: 'admin' | 'store';
        tokenType: 'supabase' | 'store';
        userId?: string;
        email?: string;
        storeId?: string;
        storeName?: string;
        store?: StoreRow;
      };
    }
  }
}

export {};
