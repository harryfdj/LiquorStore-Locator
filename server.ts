import express from 'express';
import { createServer as createViteServer } from 'vite';

import inventoryRoutes from './server/routes/inventory.routes';
import reportsRoutes from './server/routes/reports.routes';
import verificationsRoutes from './server/routes/verifications.routes';
import proxyRoutes from './server/routes/proxy.routes';
import authRoutes from './server/routes/auth.routes';
import adminRoutes from './server/routes/admin.routes';
import ordersRoutes from './server/routes/orders.routes';
import { config } from './server/lib/config';

async function startServer() {
  const app = express();
  const PORT = config.PORT;

  app.use(express.static('public'));
  app.use(express.json({ limit: '1mb' }));

  // Mount API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/image-proxy', proxyRoutes);
  app.use('/api/products', inventoryRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/verifications', verificationsRoutes);

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

