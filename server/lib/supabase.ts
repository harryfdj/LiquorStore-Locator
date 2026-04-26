import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './config';

export type StoreRow = {
  id: string;
  name: string;
  code: string;
  password_hash: string;
  csv_mapping: Record<string, string>;
  lat: number | null;
  lng: number | null;
  radius_miles: number | null;
  created_at: string;
  updated_at?: string;
};

export type ProductRow = {
  id?: string;
  store_id: string;
  sku: string;
  name: string;
  size: string;
  pack: string;
  price: number;
  cost: number;
  stock: number;
  location: string;
  image_url: string;
  category: string;
  mainupc: string;
  depname: string;
  alt_upcs: string[];
  created_at?: string;
  updated_at?: string;
};

export type VerificationRow = {
  id: string;
  store_id: string;
  report_id: string | null;
  sku: string;
  mainupc: string;
  name: string;
  system_stock: number;
  actual_stock: number;
  status: 'matched' | 'mismatched';
  created_at: string;
  updated_at?: string;
};

export type ReportRow = {
  id: string;
  store_id: string;
  total_scanned: number;
  total_matched: number;
  total_mismatched: number;
  total_value_cost: number;
  total_value_retail: number;
  created_at: string;
};

export type SupplierOrderRow = {
  id: string;
  store_id: string;
  document_no: string;
  order_no: string;
  shipping_method: string;
  shipment_date: string | null;
  order_date: string | null;
  document_date: string | null;
  location_code: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  total: number;
  raw_html?: string;
  status: 'draft' | 'in_progress' | 'finalized';
  finalized_at: string | null;
  created_at: string;
  updated_at?: string;
};

export type SupplierOrderLineRow = {
  id: string;
  order_id: string;
  store_id: string;
  line_index: number;
  upc: string;
  item_no: string;
  title: string;
  shipment_date: string | null;
  price: number;
  discount: string;
  ordered_qty: number;
  uom: string;
  pack_size: number | null;
  ordered_bottles: number | null;
  outstanding_qty: number;
  line_total: number;
  product_sku: string | null;
  product_name: string | null;
  product_upc: string | null;
  inventory_stock_snapshot: number | null;
  inventory_pack_snapshot: string | null;
  received_bottles: number | null;
  final_rack_count: number | null;
  status: 'pending' | 'matched' | 'mismatched' | 'manual_review';
  issue_type: 'pending' | 'matched' | 'short_received' | 'extra_received' | 'rack_mismatch' | 'manual_review';
  notes: string;
  verified_at: string | null;
  created_at: string;
  updated_at?: string;
};

export const supabaseAdmin = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export function createSupabaseAnonClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function mapStore(row: StoreRow) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    created_at: row.created_at,
    csv_mapping: row.csv_mapping || {},
    lat: row.lat,
    lng: row.lng,
    radius_miles: row.radius_miles,
  };
}

export function mapProduct(row: ProductRow) {
  return {
    ...row,
    alt_upcs: row.alt_upcs?.join(',') || '',
    price: Number(row.price || 0),
    cost: Number(row.cost || 0),
    stock: Number(row.stock || 0),
  };
}

export function parseAltUpcs(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}
