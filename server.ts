import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import gis from 'g-i-s';

// Helper function to wrap g-i-s in a Promise
const searchGoogleImages = (query: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    gis(query, (error: any, results: any[]) => {
      if (error) {
        reject(error);
      } else {
        // Clean up URLs (g-i-s sometimes leaves unicode escapes)
        const cleanedResults = results.map(r => ({
          ...r,
          url: r.url.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')
        }));
        resolve(cleanedResults);
      }
    });
  });
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

      const sizeStr = product.size ? ` ${product.size}` : '';
      const query = `${product.name}${sizeStr} bottle`.trim();

      let images: any[] = [];
      try {
        const results = await searchGoogleImages(query);
        if (results && results.length > 0) {
          images = results;
        }
      } catch (e: any) {
        console.log(`Search failed for query "${query}": ${e.message}`);
      }

      if (images && images.length > 0) {
        const badDomains = ['pinterest', 'etsy', 'aliexpress', 'shutterstock', 'istockphoto', 'dreamstime', '123rf', 'depositphotos', 'vector', 'illustration', 'clipart', 'alamy'];
        
        // Filter out bad domains
        let validImages = images.filter(img => {
          const lowerUrl = img.url.toLowerCase();
          return !badDomains.some(domain => lowerUrl.includes(domain));
        });

        // If filtering removed everything, fallback to original images
        if (validImages.length === 0) {
          validImages = images;
        }

        // Pick the best image (first one after filtering)
        const imageUrl = validImages[0].url;
        
        // Update the database
        const stmt = db.prepare('UPDATE products SET image_url = ? WHERE sku = ?');
        stmt.run(imageUrl, sku);
        
        return res.json({ success: true, image_url: imageUrl });
      } else {
        return res.status(404).json({ error: 'No image found' });
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
        const results = await searchGoogleImages(query);
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
