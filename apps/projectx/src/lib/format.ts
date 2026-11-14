import type { UiLang } from '../models/booking';

/** "2026-11-15 13:00" → "Sun 15 Nov · 13:00" in the interface language (other values unchanged). */
export function slot(v: string, ui: UiLang) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(v);
  if (!m) return v;
  const d = new Date(`${m[1]}T12:00:00`);
  return `${d.toLocaleDateString(ui === 'en' ? 'en-GB' : ui === 'fr' ? 'fr-FR' : 'ar-MA', { weekday: 'short', day: 'numeric', month: 'short' })} · ${m[2]}`;
}
