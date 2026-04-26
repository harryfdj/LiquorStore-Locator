import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import fs from 'fs';
import os from 'os';
import { requireAuth } from '../middlewares/auth';
import { requireStoreId, sendError } from '../lib/http';
import { mapProduct, parseAltUpcs, ProductRow, supabaseAdmin } from '../lib/supabase';
import { updateProductSchema } from '../lib/schemas';
import { downloadImageToStorage, searchImages, scoreImageMatch } from '../services/scraper';

const router = express.Router();
router.use(requireAuth);
const upload = multer({ dest: os.tmpdir() });
const PRODUCT_PAGE_SIZE = 1000;

function normalizeCode(value: string) {
  return value.trim();
}

function codeVariants(value: string) {
  const variants = new Set<string>();
  const addVariant = (code: string) => {
    if (!code) return;
    variants.add(code);
    if (code.length > 8) variants.add(code.slice(0, -1));
  };

  addVariant(value);
  if (value.length === 11) addVariant(`0${value}`);
  if (value.startsWith('0')) addVariant(value.slice(1));

  return variants;
}

function partialMatchCodes(product: ProductRow) {
  return [product.mainupc, ...(product.alt_upcs || [])]
    .filter(Boolean)
    .filter(code => code.length >= 6);
}

async function productsForStore(storeId: string, department = '') {
  const products: ProductRow[] = [];
  let from = 0;

  while (true) {
    let query = supabaseAdmin
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('name', { ascending: true })
      .range(from, from + PRODUCT_PAGE_SIZE - 1);

    if (department) query = query.eq('depname', department);

    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as ProductRow[];
    products.push(...page);

    if (page.length < PRODUCT_PAGE_SIZE) break;
    from += PRODUCT_PAGE_SIZE;
  }

  return products;
}

function withExistingVerification(product: ProductRow, verifications: Map<string, any>) {
  const mapped: ReturnType<typeof mapProduct> & { existing_verification?: any } = mapProduct(product);
  const existing = verifications.get(product.sku);
  if (existing) mapped.existing_verification = existing;
  return mapped;
}

async function activeVerificationsBySku(storeId: string, skus: string[]) {
  if (skus.length === 0) return new Map<string, any>();
  const { data, error } = await supabaseAdmin
    .from('stock_verifications')
    .select('sku,status,actual_stock')
    .eq('store_id', storeId)
    .is('report_id', null)
    .in('sku', skus);

  if (error) throw error;
  return new Map((data || []).map(row => [row.sku, { status: row.status, actual_stock: row.actual_stock }]));
}

// Get product by UPC or SKU for verification
router.get('/upc/:upc', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const upc = normalizeCode(req.params.upc);
    const variants = codeVariants(upc);

    const products = await productsForStore(storeId);
    const exact = products.find(product => {
      const codes = [product.sku, product.mainupc, ...(product.alt_upcs || [])].filter(Boolean);
      return codes.some(code => variants.has(code));
    });

    if (exact) {
      const existing = await activeVerificationsBySku(storeId, [exact.sku]);
      return res.json({ type: 'exact', product: withExistingVerification(exact, existing) });
    }

    if (upc.length >= 6) {
      const candidates = products
        .filter(product => {
          const codes = partialMatchCodes(product);
          return codes.some(code => code.includes(upc) || upc.includes(code));
        })
        .slice(0, 10);

      if (candidates.length === 1) {
        const existing = await activeVerificationsBySku(storeId, [candidates[0].sku]);
        return res.json({ type: 'exact', product: withExistingVerification(candidates[0], existing) });
      }

      if (candidates.length > 1) {
        const existing = await activeVerificationsBySku(storeId, candidates.map(candidate => candidate.sku));
        return res.json({ type: 'multiple', products: candidates.map(candidate => withExistingVerification(candidate, existing)) });
      }
    }

    return res.status(404).json({ error: 'Product not found' });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch product');
  }
});

// Get all products (with optional search)
router.get('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const search = String(req.query.q || '').trim();
    const department = String(req.query.dept || '').trim();

    const products = (await productsForStore(storeId, department))
      .filter(product => {
        if (!search) return true;
        const searchVariants = search.length >= 6 ? codeVariants(search) : null;
        const codes = [product.sku, product.mainupc, ...(product.alt_upcs || [])].filter(Boolean);
        if (searchVariants && codes.some(code => searchVariants.has(code))) return true;

        const haystack = [
          product.name,
          product.sku,
          product.location,
          product.mainupc,
          ...(product.alt_upcs || []),
        ].join(' ').toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .map(mapProduct);

    return res.json(products);
  } catch (error) {
    return sendError(res, error, 'Failed to fetch products');
  }
});

// Update a product's location, image, or upcs
router.put('/:sku', async (req, res) => {
  const { sku } = req.params;

  try {
    const storeId = requireStoreId(req);
    const body = updateProductSchema.parse(req.body);
    let image_url = body.image_url;

    if (image_url && image_url.startsWith('http')) {
      try {
        image_url = await downloadImageToStorage(image_url, sku, storeId);
      } catch (downloadErr: any) {
        console.error(`Failed to download manually selected image for ${sku}:`, downloadErr.message);
      }
    }

    const update: Record<string, unknown> = {};
    if (body.location !== undefined) update.location = body.location;
    if (image_url !== undefined) update.image_url = image_url;
    if (body.alt_upcs !== undefined) update.alt_upcs = parseAltUpcs(body.alt_upcs);

    const { error } = await supabaseAdmin
      .from('products')
      .update(update)
      .eq('store_id', storeId)
      .eq('sku', sku);

    if (error) throw error;
    return res.json({ success: true, image_url });
  } catch (error) {
    return sendError(res, error, 'Failed to update product');
  }
});

// Auto-fetch image for a specific product
router.post('/:sku/fetch-image', async (req, res) => {
  const { sku } = req.params;
  try {
    const storeId = requireStoreId(req);
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('sku', sku)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const badDomains = ['pinterest', 'etsy', 'aliexpress', 'shutterstock', 'istockphoto', 'dreamstime', '123rf', 'depositphotos', 'vector', 'illustration', 'clipart', 'alamy'];

    const sizeStr = product.size ? ` ${product.size}` : '';
    const queries = [
      `${product.name}${sizeStr} bottle`.trim(),
      `${product.name} bottle liquor`.trim(),
      `${product.name}`.trim(),
    ];

    let bestImage: string | null = null;

    for (const query of queries) {
      try {
        const results = await searchImages(query);
        if (results && results.length > 0) {
          let valid = results.filter((img: any) => {
            const lowerUrl = img.url.toLowerCase();
            return !badDomains.some(domain => lowerUrl.includes(domain));
          });
          if (valid.length === 0) valid = results;

          const scored = valid.map((img: any) => ({
            ...img,
            score: scoreImageMatch(product.name, img),
          }));

          scored.sort((a: any, b: any) => b.score - a.score);
          bestImage = scored[0].url;
          break;
        }
      } catch (e: any) {
        console.log(`Search failed for query "${query}": ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    if (bestImage) {
      let finalImageUrl = bestImage;
      try {
        finalImageUrl = await downloadImageToStorage(bestImage, sku, storeId);
      } catch (downloadErr: any) {
        console.error(`Failed to download image for ${sku}, falling back to external URL.`, downloadErr.message);
      }

      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({ image_url: finalImageUrl })
        .eq('store_id', storeId)
        .eq('sku', sku);

      if (updateError) throw updateError;
      return res.json({ success: true, image_url: finalImageUrl });
    } else {
      return res.json({ success: false, no_image: true });
    }
  } catch (error) {
    return sendError(res, error, 'Failed to fetch image');
  }
});

// Get image candidates for manual selection
router.get('/:sku/image-candidates', async (req, res) => {
  const { sku } = req.params;
  try {
    const storeId = requireStoreId(req);
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('name')
      .eq('store_id', storeId)
      .eq('sku', sku)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const query = `${product.name} bottle`.trim();
    let allImages: any[] = [];
    try {
      const results = await searchImages(query);
      if (results && results.length > 0) {
        allImages = results;
      }
    } catch (e: any) {
      console.log(`Search failed for query "${query}": ${e.message}`);
    }

    if (allImages && allImages.length > 0) {
      const uniqueUrls = new Set();
      const candidates = [];
      for (const img of allImages) {
        if (!uniqueUrls.has(img.url)) {
          uniqueUrls.add(img.url);
          candidates.push(img.url);
        }
      }
      return res.json({ success: true, candidates });
    } else {
      return res.json({ success: true, candidates: [] });
    }
  } catch (error) {
    return sendError(res, error, 'Failed to fetch image candidates');
  }
});


// Upload CSV and sync inventory
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const storeId = requireStoreId(req);
  const customMapping = req.user?.store?.csv_mapping || {};

  const results: any[] = [];

  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true, relax_quotes: true, relax_column_count: true }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      (async () => {
      try {
        const getValue = (item: any, mapKey: string, fallbacks: string[]) => {
          if (customMapping[mapKey] && item[customMapping[mapKey]] !== undefined) {
            return item[customMapping[mapKey]];
          }
          for (const fallback of fallbacks) {
            if (item[fallback] !== undefined) return item[fallback];
          }
          return undefined;
        };

        const existingRows = await productsForStore(storeId);
        const existingBySku = new Map(existingRows.map(row => [row.sku, row]));

        const rows: ProductRow[] = [];
        let skipped = 0;

        for (const item of results) {
            const sku = getValue(item, 'sku', ['sku', 'SKU']);
            const name = getValue(item, 'name', ['description', 'ITEMNAME']);

            if (!sku || !name) {
              skipped += 1;
              continue;
            }

            const size = getValue(item, 'size', ['SizeName']) || '';
            const pack = getValue(item, 'pack', ['PackName']) || '';
            const priceVal = getValue(item, 'price', ['priceperunit', 'ItemPrice']);
            const costVal = getValue(item, 'cost', ['cost', 'Cost', 'UnitCost', 'itemcost', 'ItemCost']);
            const stockVal = getValue(item, 'stock', ['totalqty', 'TOTALQTY_MULTI']);
            const category = getValue(item, 'category', ['catname', 'ItemTypeDesc']) || '';
            const mainupc = getValue(item, 'mainupc', ['mainupc']) || '';
            const depname = getValue(item, 'depname', ['depname']) || '';
            const existing = existingBySku.get(String(sku));
            const altUpcs = existing?.alt_upcs || [];
            const nextMainUpc = existing?.mainupc || String(mainupc || '');
            if (mainupc && existing?.mainupc && existing.mainupc !== mainupc && !altUpcs.includes(String(mainupc))) {
              altUpcs.push(String(mainupc));
            }

            rows.push({
              store_id: storeId,
              sku: String(sku),
              name: String(name),
              size: String(size),
              pack: String(pack),
              price: parseFloat(priceVal) || 0,
              cost: parseFloat(costVal) || 0,
              stock: parseInt(stockVal) || 0,
              location: existing?.location || '',
              image_url: existing?.image_url || '',
              category: String(category),
              mainupc: nextMainUpc,
              depname: String(depname),
              alt_upcs: altUpcs,
            });
          }

        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabaseAdmin
            .from('products')
            .upsert(rows.slice(i, i + 500), { onConflict: 'store_id,sku' });
          if (error) throw error;
        }

        fs.unlinkSync(req.file!.path);
        return res.json({ success: true, count: rows.length, skipped });
      } catch (error: any) {
        console.error('Database error during CSV import:', error);
        return res.status(500).json({ error: error.message || 'Failed to process CSV data' });
      }
      })();
    })
    .on('error', (error: any) => {
      console.error('CSV Parse Error:', error);
      res.status(500).json({ error: error.message || 'Failed to parse CSV file' });
    });
});

export default router;
