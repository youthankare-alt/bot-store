import { Hono } from 'hono';
import { signJWT } from '../utils/crypto';
import type { Bindings } from '../types';

const admin = new Hono<{ Bindings: Bindings }>();

admin.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  
  if (username === 'admin' && password === c.env.ADMIN_PASSWORD) {
    const token = await signJWT({ role: 'admin', sub: username }, c.env.ADMIN_JWT_SECRET);
    return c.json({ token });
  }
  return c.json({ error: 'Invalid credentials' }, 401);
});

admin.get('/products', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all();
  return c.json({ data: results });
});

admin.post('/products', async (c) => {
  const { name, price, stock } = await c.req.json();
  
  if (!name || typeof price !== 'number' || typeof stock !== 'number') {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  await c.env.DB.prepare(
    'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)'
  ).bind(name, price, stock).run();
  
  return c.json({ success: true }, 201);
});

admin.get('/orders', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT o.*, p.name as product_name 
    FROM orders o 
    JOIN products p ON o.product_id = p.id 
    ORDER BY o.id DESC LIMIT 50
  `).all();
  return c.json({ data: results });
});

export { admin as adminRoutes };
