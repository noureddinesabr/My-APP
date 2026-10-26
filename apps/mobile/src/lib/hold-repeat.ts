/**
 * Press-and-hold repeat for − / + buttons: a pause after the first change, then
 * steady repeats that grow bigger the longer the button is held.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export const HOLD_DELAY_MS = 400;
export const HOLD_INTERVAL_MS = 80;

/** Size of the change on the `repeats`-th repeat (0 = the first press). */
export function holdStep(step: number, repeats: number) {
  if (repeats >= 30) return step * 10;
  if (repeats >= 12) return step * 5;
  return step;
}
