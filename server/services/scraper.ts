import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { config } from '../lib/config';
import { supabaseAdmin } from '../lib/supabase';

type ImageSearchProduct = {
  name: string;
  size?: string | null;
  depname?: string | null;
  category?: string | null;
};

type ImageSearchResult = {
  url: string;
  title: string;
  domain: string;
};

export const trustedImageDomains = [
  'totalwine',
  'reservebar',
  'drizly',
  'wine.com',
  'minibar',
  'instacart',
  'kroger',
  'walmart',
  'target',
  'bevmo',
  'binny',
  'empirewine',
  'applejack',
  'saratogawine',
  'specsonline',
  'abc.virginia.gov',
  'lcbo',
  'thewhiskyexchange',
  'masterofmalt',
];

export const blockedImageDomains = [
  'pinterest',
  'etsy',
  'aliexpress',
  'shutterstock',
  'istockphoto',
  'dreamstime',
  '123rf',
  'depositphotos',
  'vector',
  'illustration',
  'clipart',
  'alamy',
  'ebay',
];

const imageNoiseWords = new Set([
  'the',
  'and',
  'for',
  'with',
  'bottle',
  'single',
  'pack',
  'each',
  'case',
  'ml',
  'lt',
  'liter',
  'litre',
  'oz',
  'size',
]);

function compactSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value: string) {
  return compactSpaces(value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9. ]/g, ' '));
}

function productWords(productName: string) {
  return normalizeSearchText(productName)
    .split(/\s+/)
    .filter(word => word.length >= 2 && !imageNoiseWords.has(word));
}

function normalizeSize(size?: string | null) {
  if (!size) return '';
  const normalized = normalizeSearchText(size)
    .replace(/\b(ltr|liters|liter|litre|l)\b/g, 'l')
    .replace(/\bmilliliters|milliliter\b/g, 'ml');
  const match = normalized.match(/\b\d+(?:\.\d+)?\s*(?:ml|l|oz)\b/);
  return match ? match[0].replace(/\s+/g, '') : normalized;
}

function productType(product: ImageSearchProduct) {
  const text = normalizeSearchText(`${product.depname || ''} ${product.category || ''} ${product.name}`);
  if (text.includes('wine') || text.includes('champagne') || text.includes('prosecco')) return 'wine';
  if (text.includes('beer') || text.includes('ale') || text.includes('lager') || text.includes('seltzer')) return 'beer';
  if (text.includes('vodka')) return 'vodka';
  if (text.includes('whiskey') || text.includes('whisky') || text.includes('bourbon') || text.includes('scotch')) return 'whiskey';
  if (text.includes('tequila') || text.includes('mezcal')) return 'tequila';
  if (text.includes('rum')) return 'rum';
  if (text.includes('gin')) return 'gin';
  if (text.includes('liqueur') || text.includes('cordial')) return 'liqueur';
  return 'liquor';
}

function includesAnyDomain(value: string, domains: string[]) {
  const lower = value.toLowerCase();
  return domains.some(domain => lower.includes(domain));
}

export function buildImageSearchQueries(product: ImageSearchProduct) {
  const name = compactSpaces(product.name);
  const size = normalizeSize(product.size);
  const kind = productType(product);
  const nameWithSize = compactSpaces(`${name} ${size}`);
  const trustedSites = ['totalwine.com', 'reservebar.com', 'wine.com', 'instacart.com'];

  const queries = [
    ...trustedSites.map(site => `site:${site} ${nameWithSize} ${kind} bottle`),
    `${nameWithSize} ${kind} bottle`,
    `${nameWithSize} bottle`,
    `${name} ${kind} bottle`,
    `${name} product bottle`,
  ];

  return Array.from(new Set(queries.map(compactSpaces).filter(Boolean)));
}

export function isBlockedImageResult(result: ImageSearchResult) {
  return includesAnyDomain(`${result.url} ${result.domain}`, blockedImageDomains);
}

export function scoreProductImageMatch(product: ImageSearchProduct, result: ImageSearchResult) {
  const titleLower = normalizeSearchText(result.title);
  const urlLower = normalizeSearchText(result.url);
  const domainLower = result.domain.toLowerCase();
  const haystack = `${titleLower} ${urlLower} ${domainLower}`;
  const words = productWords(product.name);
  const size = normalizeSize(product.size);
  const kind = productType(product);

  if (words.length === 0 || isBlockedImageResult(result)) return 0;

  let score = 0;
  const matchedWords = words.filter(word => haystack.includes(word));

  score += matchedWords.length * 4;
  score += Math.round((matchedWords.length / words.length) * 10);

  if (titleLower.includes(normalizeSearchText(product.name))) score += 8;
  if (size && haystack.replace(/\s+/g, '').includes(size)) score += 6;
  if (haystack.includes(kind)) score += 3;
  if (haystack.includes('bottle')) score += 2;
  if (includesAnyDomain(`${result.url} ${result.domain}`, trustedImageDomains)) score += 10;

  const unrelatedHints = ['shirt', 'poster', 'sign', 'sticker', 'empty bottle', 'glassware', 'recipe'];
  if (unrelatedHints.some(hint => haystack.includes(hint))) score -= 8;

  return Math.max(0, score);
}

export function imageMatchConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 28) return 'high';
  if (score >= 18) return 'medium';
  return 'low';
}

// Fetch a URL and return the HTML body
export const fetchPage = (url: string): Promise<string> => {
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

// Search Bing Images
export const searchImages = async (query: string): Promise<ImageSearchResult[]> => {
  const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const html = await fetchPage(searchUrl);

  const mRegex = /<a[^>]*class="iusc"[^>]*m="([^"]+)"/gi;
  const matches = [...html.matchAll(mRegex)];

  return matches.map(m => {
    try {
      const data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      return {
        url: data.murl || '',
        title: data.t || '',
        domain: data.md || '',
      };
    } catch { return null; }
  }).filter((r): r is { url: string; title: string; domain: string } => !!r && !!r.url);
};

// Score how well a Bing result matches the product name (like a human scanning image results).
export const scoreImageMatch = (productName: string, result: { title: string; domain: string; url: string }): number => {
  const titleLower = result.title.toLowerCase();
  const urlLower = result.url.toLowerCase();
  const nameWords = productWords(productName);

  if (nameWords.length === 0) return 0;

  let score = 0;

  for (const word of nameWords) {
    if (titleLower.includes(word)) score += 3;
  }

  for (const word of nameWords) {
    if (urlLower.includes(word)) score += 1;
  }

  const goodDomains = ['totalwine', 'drizly', 'wine.com', 'minibar', 'instacart', 'kroger', 'walmart', 'target', 'bevmo', 'binny', 'empirewine', 'liquor', 'spirits', 'applejack', 'saratogawine'];
  if (goodDomains.some(d => result.domain.toLowerCase().includes(d))) score += 3;

  return score;
};

// Download an external image and save it locally
export const downloadImage = (url: string, sku: string, storeId: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const transport = parsedUrl.protocol === 'https:' ? https : http;
      
      const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif|avif)(?:\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      const filename = `${sku.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
      
      const imagesDir = path.join(process.cwd(), 'public', `product-images-${storeId}`);
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      const filepath = path.join(imagesDir, filename);
      const fileStream = fs.createWriteStream(filepath);
      
      const req = transport.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': parsedUrl.origin,
        },
        rejectUnauthorized: false
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fileStream.close();
          fs.unlinkSync(filepath);
          if (res.headers.location.startsWith('http')) {
            return downloadImage(res.headers.location, sku, storeId).then(resolve).catch(reject);
          }
          return reject(new Error('Invalid redirect'));
        }
        
        if (res.statusCode !== 200) {
          fileStream.close();
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
          return reject(new Error(`Status: ${res.statusCode}`));
        }
        
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(`/product-images-${storeId}/${filename}`);
        });
      });
      
      req.on('error', (err) => {
        fileStream.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        reject(err);
      });
    } catch(err) {
      reject(err);
    }
  });
};

export const downloadImageToStorage = async (url: string, sku: string, storeId: string): Promise<string> => {
  const parsedUrl = new URL(url);
  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw new Error('Unsupported image protocol');
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: parsedUrl.origin,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Remote URL did not return an image (${contentType})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 5 * 1024 * 1024) {
    throw new Error('Image is larger than the 5MB storage limit');
  }

  const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const safeSku = sku.replace(/[^a-z0-9_-]/gi, '_');
  const objectPath = `${storeId}/${safeSku}-${Date.now()}.${extension}`;

  const { error } = await supabaseAdmin.storage
    .from(config.PRODUCT_IMAGE_BUCKET)
    .upload(objectPath, bytes, {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabaseAdmin.storage
    .from(config.PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(objectPath);

  return data.publicUrl;
};
