import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../routes/auth.routes';
import { getStoreDb } from '../dbManager';
import Database from 'better-sqlite3';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      db?: Database.Database;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    
    // Auto attach database if store login
    if (decoded.role === 'store' && decoded.storeId) {
      req.db = getStoreDb(decoded.storeId);
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};
