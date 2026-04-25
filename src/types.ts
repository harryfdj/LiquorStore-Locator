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
