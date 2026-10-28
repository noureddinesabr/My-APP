// Run with: npm test — no text in the app may end in "…" or be cut to a fixed number of lines.
// Long text wraps, shrinks, or moves to the next page instead (docs/UX_PRINCIPLES.md).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const SRC = join(import.meta.dirname, '..');

// One-word labels in fixed-size spots (wheel rows, map pin tags) may stay on one line.
const ONE_LINE_OK = ['components/wheel-picker.tsx', 'components/map/freight-map.tsx'];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith('.tsx') ? [join(dir, entry.name)] : [],
  );
}

test('no text is cut to a number of lines', () => {
  const cut = files(SRC)
    .filter((file) => !ONE_LINE_OK.some((ok) => file.endsWith(ok)))
    .filter((file) => /numberOfLines=/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(SRC.length + 1));
  assert.deepEqual(cut, []);
});

test('no translation ends in "…"', () => {
  for (const language of ['en', 'fr', 'ar']) {
    const text = readFileSync(join(SRC, 'i18n/locales', `${language}.ts`), 'utf8');
    const trailing = text.split('\n').filter((line) => /(…|\.\.\.)['"],?\s*$/.test(line));
    assert.deepEqual(trailing, [], language);
  }
});
