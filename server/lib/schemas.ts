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
