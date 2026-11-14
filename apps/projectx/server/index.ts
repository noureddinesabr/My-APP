import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { createServerAI } from './ai/provider';
import { searchOffers } from './marketplace/service';
import type { AssistantRequest } from '../src/ai/types';
import type { Booking } from '../src/models/booking';

/**
 * X API server.
 *   GET  /api/health     → which AI mode is active (real Claude or demo)
 *   POST /api/assistant  → one conversation turn (real AI only; the browser runs demo mode itself)
 *   POST /api/offers     → marketplace search (sample drivers for now)
 * In production (`npm start`) it also serves the built web app from dist/.
 */

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(here, '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

// Respect HTTPS_PROXY / HTTP_PROXY (company networks, cloud sandboxes) for outgoing requests.
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy) setGlobalDispatcher(new EnvHttpProxyAgent());

const ai = createServerAI(process.env);
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 20 * 1024 * 1024;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T);
      } catch (e) {
        fail(e);
      }
    });
    req.on('error', fail);
  });
}

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const dist = join(root, 'dist');
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = normalize(join(dist, url));
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  if (!existsSync(file)) return send(res, 404, { error: 'Build the app first: npm run build' });
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  try {
    if (path === '/api/health' && req.method === 'GET') {
      return send(res, 200, { ok: true, ai: ai ? 'claude-server' : 'demo', model: ai ? process.env.AI_MODEL || 'claude-opus-5-5' : null, marketplace: 'sample' });
    }
    if (path === '/api/assistant' && req.method === 'POST') {
      if (!ai) return send(res, 409, { error: 'demo_mode', message: 'No AI provider configured on the server (see .env.example).' });
      const body = await readJson<AssistantRequest>(req);
      if (!body?.booking || !Array.isArray(body.messages)) return send(res, 400, { error: 'bad_request' });
      const out = await ai.respond(body);
      return send(res, 200, out);
    }
    if (path === '/api/route' && req.method === 'GET') {
      // Road geometry from OSRM (OpenStreetMap routing), proxied so browsers don't hit CORS limits.
      const q = new URL(req.url ?? '', 'http://x').searchParams;
      const [a, b] = [q.get('from'), q.get('to')].map((v) => (v ?? '').split(',').map(Number));
      if (a.length !== 2 || b.length !== 2 || [...a, ...b].some((n) => !Number.isFinite(n))) return send(res, 400, { error: 'bad_request' });
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
      if (!r?.ok) return send(res, 502, { error: 'routing_unavailable' });
      return send(res, 200, await r.json());
    }
    if (path === '/api/offers' && req.method === 'POST') {
      const body = await readJson<{ booking: Booking; page?: number }>(req);
      if (!body?.booking) return send(res, 400, { error: 'bad_request' });
      return send(res, 200, searchOffers(body.booking, body.page ?? 0));
    }
    if (path.startsWith('/api/')) return send(res, 404, { error: 'not_found' });
    if (process.env.NODE_ENV === 'production') return serveStatic(req, res);
    return send(res, 404, { error: 'In development, open the web app on port 5173 (npm run dev).' });
  } catch (e) {
    // Typed SDK errors first; never leak keys or stack traces to the browser.
    if (e instanceof Anthropic.AuthenticationError) return send(res, 502, { error: 'ai_auth', message: 'The AI key was rejected. Check ANTHROPIC_API_KEY.' });
    if (e instanceof Anthropic.RateLimitError) return send(res, 503, { error: 'ai_rate_limited', message: 'The AI is busy. Try again in a moment.' });
    if (e instanceof Anthropic.APIError) return send(res, 502, { error: 'ai_error', message: `AI error ${e.status ?? ''}`.trim() });
    console.error('[x]', e);
    return send(res, 500, { error: 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`[x] API on http://localhost:${PORT} — AI: ${ai ? `Claude (${process.env.AI_MODEL || 'claude-opus-5-5'})` : 'DEMO mode (no ANTHROPIC_API_KEY)'}`);
});
