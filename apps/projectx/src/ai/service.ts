import { prepareHost, host } from '../lib/hostCapabilities';
import { DemoProvider } from './providers/demo/brain';
import { ClaudePageProvider, ServerProvider } from './providers/remote';
import type { AIProvider, AISource, AssistantRequest, AssistantResponse } from './types';

/**
 * Picks the AI provider once at start:
 *   1. the X server, if it reports a configured AI key   → real Claude
 *   2. the claude.ai page's Claude access, if available  → real Claude
 *   3. otherwise the built-in demo brain (clearly labelled "Demo mode")
 * If a real provider fails for one message, the demo brain answers that message and the UI says so.
 */

const demo = new DemoProvider();
let chosen: AIProvider | null = null;
let detecting: Promise<AISource> | null = null;

export function detectAI(): Promise<AISource> {
  if (detecting) return detecting;
  detecting = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch('/api/health', { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok && r.headers.get('content-type')?.includes('json')) {
        const h = (await r.json()) as { ai?: string };
        if (h.ai === 'claude-server') {
          chosen = new ServerProvider();
          return chosen.source;
        }
      }
    } catch {
      // no server (static preview) — fine
    }
    await prepareHost();
    chosen = host.sample ? new ClaudePageProvider() : demo;
    return chosen.source;
  })();
  return detecting;
}

export async function askAssistant(req: AssistantRequest): Promise<AssistantResponse & { fellBack?: boolean }> {
  await detectAI();
  const p = chosen ?? demo;
  if (p === demo) return demo.respond(req);
  try {
    return await p.respond(req);
  } catch (e) {
    console.warn('[x] AI provider failed, demo answered instead:', e);
    return { ...(await demo.respond(req)), fellBack: true };
  }
}
