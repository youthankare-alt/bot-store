import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { webhookHandler } from './handlers/webhook';
import { adminRoutes } from './routes/admin';
import { adminAuthMiddleware } from './middleware/auth';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

// ✅ CORS FINAL: Izinkan SEMUA origin sementara untuk debugging
// Nanti bisa dipersempit setelah semuanya jalan
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// ✅ CONDITIONAL MIDDLEWARE: /login TIDAK perlu token
app.use('/api/admin/*', async (c, next) => {
  const path = c.req.path;
  
  // Lewati auth untuk route login
  if (path === '/api/admin/login' || path.endsWith('/api/admin/login')) {
    return next();
  }
  
  // Route lain wajib pakai token
  return adminAuthMiddleware(c, next);
});

// Routes
app.post('/webhook', webhookHandler);
app.route('/api/admin', adminRoutes);

app.get('/', (c) => c.json({ 
  status: 'ok', 
  message: 'Store Bot Edge is running',
  timestamp: new Date().toISOString()
}));

export default app;
