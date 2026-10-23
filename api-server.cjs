// API Chat AI untuk Kalkulator Super (kalkulator.who-knows.my.id)
// Pengganti fungsi serverless Vercel api/chat.js — Node stdlib saja.
// POST /api/chat {message} -> 200 {reply} | {error}
// Model: deepseek-v4.1-flash via Bariska (terpilih lewat benchmark 23 Okt 2026:
// benar + tercepat 3,2 dtk vs qwen3.8-flash 5,1 dtk & MiniMax-M3 5,1 dtk).
'use strict';
const http = require('http');
const fs = require('fs');

const PORT = 8892;
const HOST = '127.0.0.1';
const KEY_FILE = '/root/.config/bot-bell/.bariska_key';
const MODEL = 'deepseek-v4.1-flash';
const UPSTREAM = 'https://api.bariska.cloud/v1/chat/completions';
const SYSTEM_PROMPT =
  'Kamu adalah asisten matematika dan koding pada kalkulator cerdas. Berikan jawaban yang tepat, ringkas, dan jelas dalam bahasa Indonesia.';
const UPSTREAM_TIMEOUT_MS = 20000;
const MAX_BODY = 16 * 1024;
const MAX_MESSAGE = 4000;
const RATE_LIMIT = 15; // req per jendela per IP
const RATE_WINDOW_MS = 60 * 1000;

function loadKey() {
  try {
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > MAX_BODY) reject(new Error('too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('ok');
    }
    if (url.pathname !== '/api/chat') return sendJson(res, 404, { error: 'not found' });
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method Not Allowed' });

    const ip = clientIp(req);
    if (rateLimited(ip)) {
      return sendJson(res, 429, { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });
    }

    const apiKey = loadKey();
    if (!apiKey) return sendJson(res, 500, { error: 'Kunci API AI belum terpasang di server.' });

    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Body bukan JSON yang valid.' });
    }
    const message = String(parsed && parsed.message ? parsed.message : '').trim();
    if (!message) return sendJson(res, 400, { error: 'Pesan tidak boleh kosong' });
    if (message.length > MAX_MESSAGE) return sendJson(res, 400, { error: 'Pesan terlalu panjang.' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(UPSTREAM, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: message },
          ],
          max_tokens: 800,
          temperature: 0.5,
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') return sendJson(res, 504, { error: 'Waktu tunggu AI habis. Coba lagi.' });
      return sendJson(res, 502, { error: 'Gagal menghubungi server AI.' });
    }
    clearTimeout(timer);

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return sendJson(res, 502, { error: 'Server AI mengembalikan respons yang tidak valid.' });
    }
    if (!response.ok) {
      const errMsg = (data && data.error && data.error.message) || (data && data.message) || 'tidak diketahui';
      console.log(`[kalkulator-api] upstream ${response.status} dari ${ip}: ${String(errMsg).slice(0, 120)}`);
      return sendJson(res, response.status, { error: `Error API (${response.status}): ${String(errMsg).slice(0, 200)}` });
    }
    const reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    if (!reply.trim()) return sendJson(res, 502, { error: 'AI tidak memberikan balasan.' });
    return sendJson(res, 200, { reply: reply.trim() });
  } catch (e) {
    console.error('[kalkulator-api] error:', e);
    return sendJson(res, 500, { error: 'Kesalahan internal server.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[kalkulator-api] listening on http://${HOST}:${PORT} (model ${MODEL}, key ${loadKey() ? 'terbaca' : 'BELUM ADA'})`);
});
