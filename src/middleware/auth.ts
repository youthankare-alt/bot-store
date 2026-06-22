import { Context, Next } from 'hono';
import { jwtVerify } from 'jose';

export const adminAuthMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing token' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const secret = new TextEncoder().encode(c.env.ADMIN_JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret);
    c.set('adminUser', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 403);
  }
};
