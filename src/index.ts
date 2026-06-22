import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { webhookHandler } from './handlers/webhook';
import { adminRoutes } from './routes/admin';
import { adminAuthMiddleware } from './middleware/auth';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: [
    'https://985b7632.bot-store-pg.pages.dev', // Domain default Cloudflare Pages
    'http://localhost:3000' // Untuk testing lokal nanti
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 1. Public Webhook (High Traffic, Ultra-Low Latency)
app.post('/webhook', webhookHandler);

// 2. Admin API (Protected by JWT)
app.use('/api/admin/*', adminAuthMiddleware);
app.route('/api/admin', adminRoutes);

app.get('/', (c) => c.text('Store Bot Edge is running.'));

export default app;
