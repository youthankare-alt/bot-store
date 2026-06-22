import { Context } from 'hono';
import { verifyTelegramWebhook } from '../utils/crypto';
import { sendTelegramMessage } from '../utils/telegram';
import type { TelegramUpdate } from '../types';

export const webhookHandler = async (c: Context) => {
  const env = c.env;

  // 1. Ultra-fast HMAC validation (Web Crypto API) - CPU: ~0.5ms
  const isValid = await verifyTelegramWebhook(c.req.raw, env.TELEGRAM_WEBHOOK_SECRET);
  if (!isValid) {
    return c.text('Unauthorized', 401);
  }

  // 2. Parse payload - CPU: ~1ms
  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
  } catch {
    return c.text('Bad Request', 400);
  }

  // 3. Delegate to background to avoid 10ms CPU limit & instant 200 OK
  if (update.message?.text) {
    c.executionCtx.waitUntil(processMessage(update.message, env));
  }

  return c.text('OK', 200);
};

async function processMessage(message: NonNullable<TelegramUpdate['message']>, env: any) {
  const chatId = message.chat.id;
  const text = message.text!;

  try {
    if (text === '/start') {
      const { results } = await env.DB.prepare(
        'SELECT id, name, price FROM products WHERE stock > 0 LIMIT 10'
      ).all();

      let responseText = '🛒 *Selamat Datang di Toko Kami*\n\n';
      if (results.length === 0) {
        responseText += 'Maaf, saat ini belum ada produk tersedia.';
      } else {
        results.forEach((p: any) => {
          responseText += `/buy ${p.id} - ${p.name} (Rp ${p.price.toLocaleString()})\n`;
        });
      }

      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText);
    } 
    else if (text.startsWith('/buy ')) {
      const productId = parseInt(text.split(' ')[1]);
      if (isNaN(productId)) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Format salah. Gunakan: /buy <id>');
        return;
      }
      await processPurchase(chatId, productId, env);
    }
  } catch (err) {
    console.error('Background processing error:', err);
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '⚠️ Terjadi kesalahan sistem. Silakan coba lagi nanti.');
  }
}

async function processPurchase(chatId: number, productId: number, env: any) {
  // ATOMIC UPDATE: Mencegah Race Condition / Overselling (TOCTOU)
  // Kita TIDAK melakukan SELECT dulu. Langsung UPDATE dengan syarat stock > 0.
  const updateResult = await env.DB.prepare(
    'UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0'
  ).bind(productId).run();

  // Cek meta.changes. Jika 0, berarti tidak ada baris yang terupdate (Stok habis / ID salah)
  if (updateResult.meta.changes === 0) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Maaf, stok habis atau produk tidak ditemukan.');
    return;
  }

  // Jika berhasil dikurangi, ambil data untuk notifikasi dan insert order
  const product = await env.DB.prepare(
    'SELECT name, price FROM products WHERE id = ?'
  ).bind(productId).first();

  await env.DB.prepare(
    'INSERT INTO orders (telegram_user_id, product_id, amount_paid, status) VALUES (?, ?, ?, ?)'
  ).bind(chatId, productId, product!.price, 'paid').run();

  await sendTelegramMessage(
    env.TELEGRAM_BOT_TOKEN, 
    chatId, 
    `✅ Transaksi Berhasil!\n\nAnda membeli *${product!.name}*\nTotal: Rp ${product!.price.toLocaleString()}`
  );
}
