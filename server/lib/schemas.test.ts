import { describe, expect, it } from 'vitest';
import { createStoreSchema, updateProductSchema, verificationSchema } from './schemas';

describe('server validation schemas', () => {
  it('requires strong enough store passwords', () => {
    expect(() => createStoreSchema.parse({ name: 'Main Store', password: 'short' })).toThrow();
    expect(createStoreSchema.parse({ name: 'Main Store', password: 'long-enough' })).toMatchObject({
      name: 'Main Store',
      password: 'long-enough',
    });
  });

  it('accepts product edits without requiring every product field', () => {
    expect(updateProductSchema.parse({ location: 'A1', alt_upcs: '123,456' })).toEqual({
      location: 'A1',
      alt_upcs: '123,456',
    });
  });

  it('normalizes numeric verification payloads', () => {
    expect(verificationSchema.parse({
      sku: 'ABC',
      name: 'Sample',
      system_stock: '4',
      actual_stock: '3',
      status: 'mismatched',
    })).toMatchObject({
      sku: 'ABC',
      system_stock: 4,
      actual_stock: 3,
      status: 'mismatched',
    });
  });
});
