import express from 'express';
import https from 'https';
import http from 'http';
import { requireAuth } from '../middlewares/auth';

const router = express.Router();
router.use(requireAuth);

const blockedHostPattern = /^(localhost|127\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|0\.0\.0\.0)/i;

// --- IMAGE PROXY (avoids CORS/hotlink blocking in browser) ---
router.get('/', (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) return res.status(400).send('Missing url param');

  try {
    const parsedUrl = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || blockedHostPattern.test(parsedUrl.hostname)) {
      return res.status(400).send('URL is not allowed');
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const proxyReq = transport.get(
      imageUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': parsedUrl.origin,
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        }
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
      if (!res.headersSent) {
        res.status(500).send('Proxy error');
      } else {
        res.end(); // close stream if headers already sent
      }
    });
  } catch (e) {
    res.status(400).send('Invalid URL');
  }
});

export default router;
