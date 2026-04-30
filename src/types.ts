export interface Product {
  sku: string;
  name: string;
  size: string;
  pack: string;
  price: number;
  stock: number;
  location: string;
  image_url: string;
  category: string;
  mainupc: string;
  depname: string;
  alt_upcs?: string;
  cost?: number;
  existing_verification?: {
    status: 'matched' | 'mismatched';
    actual_stock: number;
  };
}

export interface Verification {
  id: string;
  sku: string;
  mainupc: string;
  name: string;
  system_stock: number;
  actual_stock: number;
  status: 'matched' | 'mismatched';
  created_at: string;
  image_url?: string;
  cost?: number;
  price?: number;
}

export interface WeeklyReport {
  id: string;
  total_scanned: number;
  total_matched: number;
  total_mismatched: number;
  total_value_cost: number;
  total_value_retail: number;
  created_at: string;
}

export interface StoreSummary {
  id: string;
  name: string;
  code: string;
  created_at: string;
  csv_mapping: Record<string, string>;
  lat: number | null;
  lng: number | null;
  radius_miles: number | null;
}

export interface AuthUser {
  role: 'admin' | 'store';
  token: string;
  email?: string;
  storeId?: string;
  storeName?: string;
  lat?: number | null;
  lng?: number | null;
  radius_miles?: number | null;
}

export type AppTab = 'inventory' | 'verify' | 'orders' | 'reports';

export interface SupplierOrderSummary {
  id: string;
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
  status: 'draft' | 'in_progress' | 'finalized';
  finalized_at: string | null;
  created_at: string;
  line_count: number;
  matched_count: number;
  issue_count: number;
  manual_review_count: number;
  total_ordered_bottles: number;
  total_received_bottles: number;
}

export interface SupplierOrderLine {
  id: string;
  order_id: string;
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
  product_location: string | null;
  inventory_stock_snapshot: number | null;
  inventory_pack_snapshot: string | null;
  received_bottles: number | null;
  final_rack_count: number | null;
  is_auto_matched: boolean;
  status: 'pending' | 'matched' | 'mismatched' | 'manual_review';
  issue_type: 'pending' | 'matched' | 'short_received' | 'extra_received' | 'rack_mismatch' | 'manual_review';
  notes: string;
  verified_at: string | null;
}

export interface SupplierOrderDetail {
  order: SupplierOrderSummary;
  lines: SupplierOrderLine[];
}
