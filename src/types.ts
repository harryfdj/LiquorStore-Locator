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
}

export interface Verification {
  id: number;
  sku: string;
  mainupc: string;
  name: string;
  system_stock: number;
  actual_stock: number;
  status: 'matched' | 'mismatched';
  created_at: string;
}
