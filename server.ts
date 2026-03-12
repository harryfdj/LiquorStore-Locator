import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// Fetch a URL and return the HTML body
const fetchPage = (url: string): Promise<string> => {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
};

// Search Bing Images — returns results with correctly matched URLs, titles, and domains.
// Bing embeds structured JSON in the page HTML, so image URLs always match the title.
const searchImages = async (query: string): Promise<{ url: string; title: string; domain: string }[]> => {
  const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const html = await fetchPage(searchUrl);

  // Bing stores image data in m="" attributes of <a class="iusc"> tags
  const mRegex = /<a[^>]*class="iusc"[^>]*m="([^"]+)"/gi;
  const matches = [...html.matchAll(mRegex)];

  return matches.map(m => {
    try {
      const data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      return {
        url: data.murl || '',   // full-resolution image URL
        title: data.t || '',    // image title / alt text
        domain: data.md || '',  // source domain
      };
    } catch { return null; }
  }).filter((r): r is { url: string; title: string; domain: string } => !!r && !!r.url);
};

// Score how well a Bing result matches the product name (like a human scanning image results).
const scoreImageMatch = (productName: string, result: { title: string; domain: string; url: string }): number => {
  const nameLower = productName.toLowerCase();
  const titleLower = result.title.toLowerCase();
  const urlLower = result.url.toLowerCase();

  const noise = new Set(['the', 'and', 'for', 'with', 'bottle', 'single', 'pack', 'each', 'case', 'ml', 'lt', 'oz']);
  const nameWords = nameLower
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !noise.has(w));

  if (nameWords.length === 0) return 0;

  let score = 0;

  // +3 per product-name word found in the image title (primary signal)
  for (const word of nameWords) {
    if (titleLower.includes(word)) score += 3;
  }

  // +1 per word found in the image URL (secondary signal - Bing URLs are reliable)
  for (const word of nameWords) {
    if (urlLower.includes(word)) score += 1;
  }

  // Bonus for liquor retailer domains (clean product photos)
  const goodDomains = ['totalwine', 'drizly', 'wine.com', 'minibar', 'instacart', 'kroger', 'walmart', 'target', 'bevmo', 'binny', 'empirewine', 'liquor', 'spirits', 'applejack', 'saratogawine'];
  if (goodDomains.some(d => result.domain.toLowerCase().includes(d))) score += 3;

  return score;
};

// Initialize SQLite Database
const db = new Database('inventory.db');

// Create products table
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    sku TEXT PRIMARY KEY,
    name TEXT,
    size TEXT,
    pack TEXT,
    price REAL,
    stock INTEGER,
    location TEXT,
    image_url TEXT,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS stock_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT,
    mainupc TEXT,
    name TEXT,
    system_stock INTEGER,
    actual_stock INTEGER,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add category column if it doesn't exist (for existing DBs)
try {
  db.exec(`ALTER TABLE products ADD COLUMN category TEXT DEFAULT ''`);
} catch (e) {
  // Column already exists, ignore
}

// Add mainupc column if it doesn't exist
try {
  db.exec(`ALTER TABLE products ADD COLUMN mainupc TEXT DEFAULT ''`);
} catch (e) {
  // Column already exists, ignore
}

// Add depname column if it doesn't exist
try {
  db.exec(`ALTER TABLE products ADD COLUMN depname TEXT DEFAULT ''`);
} catch (e) {
  // Column already exists, ignore
}

const upload = multer({ dest: 'uploads/' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- IMAGE PROXY (avoids CORS/hotlink blocking in browser) ---
  app.get('/api/image-proxy', (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send('Missing url param');

    try {
      const parsedUrl = new URL(imageUrl);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const proxyReq = transport.get(
        imageUrl,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': parsedUrl.origin,
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        },
        (imgRes) => {
          // Follow redirects
          if (imgRes.statusCode && imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
            return res.redirect(`/api/image-proxy?url=${encodeURIComponent(imgRes.headers.location)}`);
          }
          if (imgRes.statusCode !== 200) {
            return res.status(imgRes.statusCode || 500).send('Failed to fetch image');
          }
          const contentType = imgRes.headers['content-type'] || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          imgRes.pipe(res);
        }
      );

      proxyReq.on('error', (err) => {
        console.error('Image proxy error:', err.message);
        res.status(500).send('Proxy error');
      });
    } catch (e) {
      res.status(400).send('Invalid URL');
    }
  });

  // --- API ROUTES ---

  // Get product by UPC or SKU for verification
  app.get('/api/products/upc/:upc', (req, res) => {
    try {
      const upc = req.params.upc;
      const product = db.prepare('SELECT * FROM products WHERE mainupc = ? OR sku = ?').get(upc, upc);
      if (product) {
        res.json(product);
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
    } catch (error) {
      console.error('Error fetching product by UPC:', error);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  });

  // Save a stock verification
  app.post('/api/verifications', (req, res) => {
    const { sku, mainupc, name, system_stock, actual_stock, status } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO stock_verifications (sku, mainupc, name, system_stock, actual_stock, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(sku, mainupc, name, system_stock, actual_stock, status);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving verification:', error);
      res.status(500).json({ error: 'Failed to save verification' });
    }
  });

  // Get all stock verifications
  app.get('/api/verifications', (req, res) => {
    try {
      const verifications = db.prepare('SELECT * FROM stock_verifications ORDER BY created_at DESC').all();
      res.json(verifications);
    } catch (error) {
      console.error('Error fetching verifications:', error);
      res.status(500).json({ error: 'Failed to fetch verifications' });
    }
  });

  // Clear all stock verifications
  app.delete('/api/verifications', (req, res) => {
    try {
      db.exec('DELETE FROM stock_verifications');
      res.json({ success: true, message: 'Verifications cleared' });
    } catch (error) {
      console.error('Error clearing verifications:', error);
      res.status(500).json({ error: 'Failed to clear verifications' });
    }
  });

  // Get all products (with optional search)
  app.get('/api/products', (req, res) => {
    const search = req.query.q as string;
    const department = req.query.dept as string;
    let query = 'SELECT * FROM products WHERE 1=1';
    let params: any[] = [];

    if (search) {
      query += ' AND (name LIKE ? OR sku LIKE ? OR location LIKE ? OR mainupc LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (department) {
      query += ' AND depname = ?';
      params.push(department);
    }

    query += ' ORDER BY name ASC';

    try {
      const stmt = db.prepare(query);
      const products = stmt.all(...params);
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Update a product's location or image
  app.put('/api/products/:sku', (req, res) => {
    const { sku } = req.params;
    const { location, image_url } = req.body;

    try {
      const stmt = db.prepare(`
        UPDATE products 
        SET location = COALESCE(?, location), 
            image_url = COALESCE(?, image_url)
        WHERE sku = ?
      `);
      stmt.run(location, image_url, sku);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  // Auto-fetch image for a specific product
  app.post('/api/products/:sku/fetch-image', async (req, res) => {
    const { sku } = req.params;
    try {
      const product = db.prepare('SELECT name, size FROM products WHERE sku = ?').get(sku) as any;
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const badDomains = ['pinterest', 'etsy', 'aliexpress', 'shutterstock', 'istockphoto', 'dreamstime', '123rf', 'depositphotos', 'vector', 'illustration', 'clipart', 'alamy'];

      const sizeStr = product.size ? ` ${product.size}` : '';
      // Try multiple queries in order to improve hit rate
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
            // Filter out bad domains
            let valid = results.filter((img: any) => {
              const lowerUrl = img.url.toLowerCase();
              return !badDomains.some(domain => lowerUrl.includes(domain));
            });
            if (valid.length === 0) valid = results;

            // Score each result by how well its title matches the product name
            const scored = valid.map((img: any) => ({
              ...img,
              score: scoreImageMatch(product.name, img),
            }));

            // Sort descending by score; pick the best one
            scored.sort((a: any, b: any) => b.score - a.score);
            bestImage = scored[0].url;
            break; // found one, stop trying other queries
          }
        } catch (e: any) {
          console.log(`Search failed for query "${query}": ${e.message}`);
        }
        // Small delay between retries to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }

      if (bestImage) {
        const stmt = db.prepare('UPDATE products SET image_url = ? WHERE sku = ?');
        stmt.run(bestImage, sku);
        return res.json({ success: true, image_url: bestImage });
      } else {
        // Return 200 so the frontend doesn't log a flood of errors;
        // the batch loop checks res.ok AND data.image_url
        return res.json({ success: false, no_image: true });
      }
    } catch (error) {
      console.error(`Error fetching image for SKU ${sku}:`, error);
      res.status(500).json({ error: 'Failed to fetch image' });
    }
  });

  // Get image candidates for manual selection
  app.get('/api/products/:sku/image-candidates', async (req, res) => {
    const { sku } = req.params;
    try {
      const stmt = db.prepare('SELECT name FROM products WHERE sku = ?');
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
        // Return unique candidates
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

  // Clear all data (reset database)
  app.delete('/api/products', (req, res) => {
    try {
      db.exec('DELETE FROM products');
      res.json({ success: true, message: 'Database cleared' });
    } catch (error) {
      console.error('Error clearing database:', error);
      res.status(500).json({ error: 'Failed to clear database' });
    }
  });

  // Upload CSV and sync inventory
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results: any[] = [];
    
    fs.createReadStream(req.file.path)
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true, relax_quotes: true, relax_column_count: true }))
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          const insertOrUpdate = db.prepare(`
            INSERT INTO products (sku, name, size, pack, price, stock, location, image_url, category, mainupc, depname)
            VALUES (@sku, @name, @size, @pack, @price, @stock, COALESCE((SELECT location FROM products WHERE sku = @sku), ''), COALESCE((SELECT image_url FROM products WHERE sku = @sku), ''), @category, @mainupc, @depname)
            ON CONFLICT(sku) DO UPDATE SET
              name = excluded.name,
              size = excluded.size,
              pack = excluded.pack,
              price = excluded.price,
              stock = excluded.stock,
              category = excluded.category,
              mainupc = excluded.mainupc,
              depname = excluded.depname
          `);

          const transaction = db.transaction((items) => {
            for (const item of items) {
              // Map CSV columns to our DB schema
              // Old CSV Columns: SKU, ITEMNAME, SizeName, PackName, ItemPrice, TOTALQTY_MULTI, ItemTypeDesc, SALEPRICE
              // New CSV Columns: sku, mainupc, totalqty, currentcost, priceperunit, description, depname, catname
              const sku = item.sku || item.SKU;
              const name = item.description || item.ITEMNAME;
              
              if (!sku || !name) continue;

              insertOrUpdate.run({
                sku: sku,
                name: name,
                size: item.SizeName || '',
                pack: item.PackName || '',
                price: parseFloat(item.priceperunit || item.ItemPrice) || 0,
                stock: parseInt(item.totalqty || item.TOTALQTY_MULTI) || 0,
                category: item.catname || item.ItemTypeDesc || '',
                mainupc: item.mainupc || '',
                depname: item.depname || ''
              });
            }
          });

          transaction(results);
          
          // Clean up the uploaded file
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

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
