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
      return res.json({ success: true, token, role: 'store', storeName: store.name, storeId: store.id });
    }
  } catch(e) { /* Error in sqlite logic if store missing */ }

  return res.status(401).json({ error: 'Invalid credentials' });
});

export default router;
