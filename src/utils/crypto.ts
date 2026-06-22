export async function verifyTelegramWebhook(req: Request, secret: string): Promise<boolean> {
  const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!headerSecret || !secret) return false;

  const encoder = new TextEncoder();
  const a = encoder.encode(headerSecret);
  const b = encoder.encode(secret);

  if (a.byteLength !== b.byteLength) return false;

  // Constant-time comparison to prevent Timing Attacks
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function signJWT(payload: object, secret: string): Promise<string> {
  const { SignJWT } = await import('jose');
  const secretKey = new TextEncoder().encode(secret);
  
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secretKey);
}
