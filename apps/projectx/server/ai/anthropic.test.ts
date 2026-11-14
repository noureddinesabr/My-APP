import { describe, expect, it } from 'vitest';
import { emptyBooking } from '../../src/models/booking';
import { AnthropicAI } from './anthropic';

/** The tool loop, with a fake API (no network, no key): Claude updates the booking, then replies. */
describe('AnthropicAI tool loop', () => {
  it('applies update_booking, suggest_replies, and returns the final text', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-used';
    const ai = new AnthropicAI('claude-opus-5-5', 'low');
    const calls: unknown[] = [];
    const responses = [
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 't1', name: 'update_booking', input: { reply_lang: 'fr', cargo: { category: 'appliance', items: [{ key: 'fridge', qty: 1 }] }, pickup: { id: 'ainsebaa', city: 'Casablanca', area: 'Aïn Sebaâ', lat: 33.607, lng: -7.533 }, unknown_field: 1 } },
          { type: 'tool_use', id: 't2', name: 'suggest_replies', input: { replies: ['Mohammedia', 'Rabat'] } },
        ],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Parfait. Où devons-nous le livrer ?' }] },
    ];
    (ai as unknown as { client: unknown }).client = { beta: { messages: { create: async (p: unknown) => (calls.push(structuredClone(p)), responses.shift()) } } };
    const out = await ai.respond({ mode: 'collect', messages: [{ id: 'u', role: 'user', text: 'Je veux transporter un frigo depuis Aïn Sebaâ', at: 0 }], booking: emptyBooking(), lang: null, now: '2026-11-14T10:00:00' });
    expect(out.reply).toBe('Parfait. Où devons-nous le livrer ?');
    expect(out.lang).toBe('fr');
    expect(out.booking.cargo.items).toEqual([{ key: 'fridge', qty: 1 }]);
    expect(out.booking.pickup?.area).toBe('Aïn Sebaâ');
    expect(out.quickReplies).toEqual(['Mohammedia', 'Rabat']);
    expect(out.ready).toBe(false);
    expect(calls).toHaveLength(2);
    const first = calls[0] as { model: string; fallbacks: string; betas: string[]; output_config: { effort: string }; messages: { role: string; content: { type: string; text?: string }[] }[] };
    expect(first.model).toBe('claude-opus-5-5');
    expect(first.fallbacks).toBe('default');
    expect(first.output_config.effort).toBe('low');
    expect(first.messages[0].content.some((c) => c.text?.includes('<booking_state>'))).toBe(true);
    const second = calls[1] as { messages: { role: string; content: { type: string; content?: string }[] }[] };
    expect(second.messages.at(-1)!.content[0].type).toBe('tool_result');
  });
});
