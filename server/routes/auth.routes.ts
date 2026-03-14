import express from 'express';
import jwt from 'jsonwebtoken';
import { adminDb } from '../dbManager';

const router = express.Router();
export const JWT_SECRET = 'hilltop_super_secret_dev_key';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'AL@hilltop') {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, token, role: 'admin' });
  }

  try {
    const store = adminDb.prepare('SELECT * FROM stores WHERE name = ? AND password = ?').get(username, password) as any;
    if (store) {
      const token = jwt.sign({ role: 'store', storeId: store.id, storeName: store.name }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ 
        success: true, 
        token, 
        role: 'store', 
        storeName: store.name, 
        storeId: store.id,
        lat: store.lat,
        lng: store.lng,
        radius_miles: store.radius_miles
      });
    }
  } catch(e) { /* Error in sqlite logic if store missing */ }

  return res.status(401).json({ error: 'Invalid credentials' });
});

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role === 'admin') {
      return res.json({ role: 'admin' });
    }
    const store = adminDb.prepare('SELECT * FROM stores WHERE id = ?').get(decoded.storeId) as any;
    if (store) {
      return res.json({
        role: 'store',
        storeId: store.id,
        storeName: store.name,
        lat: store.lat,
        lng: store.lng,
        radius_miles: store.radius_miles
      });
    }
  } catch(e) {}
  
  return res.status(401).json({ error: 'Invalid token' });
});

export default router;
