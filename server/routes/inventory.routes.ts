import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { adminDb } from '../dbManager';
import { searchImages, scoreImageMatch, downloadImage } from '../services/scraper';

const router = express.Router();
import { requireAuth } from '../middlewares/auth';
router.use(requireAuth);
const upload = multer({ dest: 'uploads/' });

// Get product by UPC or SKU for verification
router.get('/upc/:upc', (req, res) => {
  try {
    const upc = req.params.upc;
    const product = req.db!.prepare('SELECT * FROM products WHERE mainupc = ? OR sku = ? OR alt_upcs LIKE ?').get(upc, upc, '%' + upc + '%') as any;
    if (product) {
      const existing = req.db!.prepare('SELECT status, actual_stock FROM stock_verifications WHERE sku = ? AND report_id IS NULL').get(product.sku) as any;
      if (existing) {
        product.existing_verification = existing;
      }
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    console.error('Error fetching product by UPC:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get all products (with optional search)
router.get('/', (req, res) => {
  const search = req.query.q as string;
  const department = req.query.dept as string;
  let query = 'SELECT * FROM products WHERE 1=1';
  let params: any[] = [];

  if (search) {
    query += ' AND (name LIKE ? OR sku LIKE ? OR location LIKE ? OR mainupc LIKE ? OR alt_upcs LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (department) {
    query += ' AND depname = ?';
    params.push(department);
  }

  query += ' ORDER BY name ASC';

  try {
    const stmt = req.db!.prepare(query);
    const products = stmt.all(...params);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Update a product's location, image, or upcs
router.put('/:sku', async (req, res) => {
  const { sku } = req.params;
  const { location, alt_upcs } = req.body;
  let { image_url } = req.body;

  try {
    if (image_url && image_url.startsWith('http')) {
      try {
        const storeId = (req.user as any).storeId;
        image_url = await downloadImage(image_url, sku, storeId);
      } catch (downloadErr: any) {
        console.error(`Failed to download manually selected image for ${sku}:`, downloadErr.message);
      }
    }

    const stmt = req.db!.prepare(`
      UPDATE products 
      SET location = COALESCE(?, location), 
          image_url = COALESCE(?, image_url),
          alt_upcs = COALESCE(?, alt_upcs)
      WHERE sku = ?
    `);
    stmt.run(location, image_url, alt_upcs !== undefined ? alt_upcs : null, sku);
    res.json({ success: true, image_url });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Auto-fetch image for a specific product
router.post('/:sku/fetch-image', async (req, res) => {
  const { sku } = req.params;
  try {
    const product = req.db!.prepare('SELECT name, size FROM products WHERE sku = ?').get(sku) as any;

    if (!product) {
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
        const storeId = (req.user as any).storeId;
        finalImageUrl = await downloadImage(bestImage, sku, storeId);
      } catch (downloadErr: any) {
        console.error(`Failed to download image for ${sku}, falling back to external URL.`, downloadErr.message);
      }

      const stmt = req.db!.prepare('UPDATE products SET image_url = ? WHERE sku = ?');
      stmt.run(finalImageUrl, sku);
      return res.json({ success: true, image_url: finalImageUrl });
    } else {
      return res.json({ success: false, no_image: true });
    }
  } catch (error) {
    console.error(`Error fetching image for SKU ${sku}:`, error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Get image candidates for manual selection
router.get('/:sku/image-candidates', async (req, res) => {
  const { sku } = req.params;
  try {
    const stmt = req.db!.prepare('SELECT name FROM products WHERE sku = ?');
    const product = stmt.get(sku) as any;

    if (!product) {
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
    console.error(`Error fetching image candidates for SKU ${sku}:`, error);
    res.status(500).json({ error: 'Failed to fetch image candidates' });
  }
});


// Upload CSV and sync inventory
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const storeId = (req.user as any)?.storeId;
  let customMapping: any = {};
  if (storeId) {
    try {
      const storeRow = adminDb.prepare('SELECT csv_mapping FROM stores WHERE id = ?').get(storeId) as any;
      if (storeRow && storeRow.csv_mapping) {
        customMapping = JSON.parse(storeRow.csv_mapping);
      }
    } catch (e) {
      console.error('Error fetching custom mapping:', e);
    }
  }

  const results: any[] = [];

  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true, relax_quotes: true, relax_column_count: true }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      try {
        const insertOrUpdate = req.db!.prepare(`
          INSERT INTO products (sku, name, size, pack, price, stock, location, image_url, category, mainupc, depname, alt_upcs)
          VALUES (@sku, @name, @size, @pack, @price, @stock, COALESCE((SELECT location FROM products WHERE sku = @sku), ''), COALESCE((SELECT image_url FROM products WHERE sku = @sku), ''), @category, @mainupc, @depname, '')
          ON CONFLICT(sku) DO UPDATE SET
            name = excluded.name,
            size = excluded.size,
            pack = excluded.pack,
            price = excluded.price,
            stock = excluded.stock,
            category = excluded.category,
            mainupc = CASE WHEN products.mainupc = '' THEN excluded.mainupc ELSE products.mainupc END,
            alt_upcs = CASE 
              WHEN excluded.mainupc != '' AND excluded.mainupc != products.mainupc AND instr(products.alt_upcs, excluded.mainupc) = 0 THEN
                CASE WHEN products.alt_upcs = '' THEN excluded.mainupc ELSE products.alt_upcs || ',' || excluded.mainupc END
              ELSE products.alt_upcs
            END,
            depname = excluded.depname
        `);

        // Helper to pull value either from custom mapping key OR fallback
        const getValue = (item: any, mapKey: string, fallbacks: string[]) => {
          if (customMapping[mapKey] && item[customMapping[mapKey]] !== undefined) {
            return item[customMapping[mapKey]];
          }
          for (const fallback of fallbacks) {
            if (item[fallback] !== undefined) return item[fallback];
          }
          return undefined;
        };

        const transaction = req.db!.transaction((items) => {
          for (const item of items) {
            const sku = getValue(item, 'sku', ['sku', 'SKU']);
            const name = getValue(item, 'name', ['description', 'ITEMNAME']);

            if (!sku || !name) continue;

            const size = getValue(item, 'size', ['SizeName']) || '';
            const pack = getValue(item, 'pack', ['PackName']) || '';
            const priceVal = getValue(item, 'price', ['priceperunit', 'ItemPrice']);
            const stockVal = getValue(item, 'stock', ['totalqty', 'TOTALQTY_MULTI']);
            const category = getValue(item, 'category', ['catname', 'ItemTypeDesc']) || '';
            const mainupc = getValue(item, 'mainupc', ['mainupc']) || '';
            const depname = getValue(item, 'depname', ['depname']) || '';

            insertOrUpdate.run({
              sku: sku,
              name: name,
              size: size,
              pack: pack,
              price: parseFloat(priceVal) || 0,
              stock: parseInt(stockVal) || 0,
              category: category,
              mainupc: mainupc,
              depname: depname
            });
          }
        });

        transaction(results);
        fs.unlinkSync(req.file!.path);
        res.json({ success: true, count: results.length });
      } catch (error: any) {
        console.error('Database error during CSV import:', error);
        res.status(500).json({ error: error.message || 'Failed to process CSV data' });
      }
    })
    .on('error', (error: any) => {
      console.error('CSV Parse Error:', error);
      res.status(500).json({ error: error.message || 'Failed to parse CSV file' });
    });
});

export default router;
