import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(8).max(128),
});

export const updateMappingSchema = z.object({
  mapping: z.record(z.string(), z.string()),
});

export const updateLocationSchema = z.object({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  radius_miles: z.number().positive().nullable().optional(),
});

export const updateProductSchema = z.object({
  location: z.string().max(120).optional(),
  image_url: z.string().max(2048).optional(),
  alt_upcs: z.union([z.string(), z.array(z.string())]).optional(),
});

export const verificationSchema = z.object({
  sku: z.string().trim().min(1),
  mainupc: z.string().trim().optional().default(''),
  name: z.string().trim().min(1),
  system_stock: z.coerce.number().int().min(0),
  actual_stock: z.coerce.number().int().min(0),
  status: z.enum(['matched', 'mismatched']),
});

export const importOrderHtmlSchema = z.object({
  html: z.string().min(100),
});

export const matchOrderLineSchema = z.object({
  product_sku: z.string().trim().min(1),
});

export const verifyOrderLineSchema = z.object({
  received_bottles: z.coerce.number().int().min(0),
  final_rack_count: z.coerce.number().int().min(0),
  notes: z.string().trim().max(1000).optional().default(''),
});
