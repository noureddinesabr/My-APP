import type { AssistantRequest, AssistantResponse } from '../../src/ai/types';
import { AnthropicAI } from './anthropic';

/** Server-side AI abstraction: add a provider here and select it with AI_PROVIDER, no app rebuild needed. */
export interface ServerAI {
  readonly name: string;
  respond(req: AssistantRequest): Promise<AssistantResponse>;
  /** Reads cargo photos (data URLs) → JSON {items:[...]} (see src/ai/vision.ts). */
  scan(images: string[]): Promise<unknown>;
}

export function createServerAI(env: NodeJS.ProcessEnv): ServerAI | null {
  const provider = (env.AI_PROVIDER ?? 'anthropic').toLowerCase();
  if (provider === 'demo') return null;
  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) return null;
    const effort = (['low', 'medium', 'high'].includes(env.AI_EFFORT ?? '') ? env.AI_EFFORT : 'low') as 'low' | 'medium' | 'high';
    return new AnthropicAI(env.AI_MODEL || 'claude-opus-5-5', effort);
  }
  console.warn(`[x] Unknown AI_PROVIDER "${provider}" — running in demo mode.`);
  return null;
}
