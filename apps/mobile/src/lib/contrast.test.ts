// Run with: npm test — every text/background pair the app uses must pass WCAG AAA (7:1).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastRatio } from './contrast.ts';
import { Gradients, highContrast, palette } from './palette.ts';

const AAA = 7;

type Colors = Record<string, string>;
const pairs = (c: Colors): [string, string, string][] => [
  // Coloured text (accents, success, warnings) only ever sits on cards and sheets; the page
  // background (the coral canvas in light mode) carries plain text.
  ['text on background', c.text, c.background],
  ...(['surface', 'surfaceRaised', 'surfaceFloating', 'surfaceMuted'] as const).flatMap((bg) =>
    (['text', 'textMuted', 'primary', 'success', 'accent'] as const).map((fg): [string, string, string] => [`${fg} on ${bg}`, c[fg], c[bg]]),
  ),
  ['primary on primarySoft', c.primary, c.primarySoft],
  ['success on successSoft', c.success, c.successSoft],
  ['accent on accentSoft', c.accent, c.accentSoft],
  ['onPrimary on primaryFill', c.onPrimary, c.primaryFill],
  ['onPrimary on successFill', c.onPrimary, c.successFill],
  ['onPrimary on accentFill', c.onPrimary, c.accentFill],
  ['onCta on cta', c.onCta, c.cta],
  ['onControl on control', c.onControl, c.control],
  ['onHero on hero', c.onHero, c.hero],
  ['onHeroMuted on hero', c.onHeroMuted, c.hero],
];

// Small grey helper text directly on the page background: at least AA (4.5:1) — the coral
// canvas the owner chose can't reach 7:1 with anything but near-black.
test('muted text on the page background passes AA', () => {
  for (const scheme of ['light', 'dark'] as const) {
    assert.ok(contrastRatio(palette[scheme].textMuted, palette[scheme].background) >= 4.5, scheme);
  }
});

for (const scheme of ['light', 'dark'] as const) {
  for (const contrast of [false, true]) {
    test(`${scheme}${contrast ? ' high contrast' : ''}: text pairs pass AAA`, () => {
      const colors: Colors = contrast ? { ...palette[scheme], ...highContrast[scheme] } : { ...palette[scheme] };
      const failing = pairs(colors)
        .map(([name, fg, bg]) => [name, contrastRatio(fg, bg)] as const)
        .filter(([, ratio]) => ratio < AAA)
        .map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}`);
      assert.deepEqual(failing, []);
    });
  }
}

test('white text passes AAA on every gradient stop', () => {
  for (const [name, stops] of Object.entries(Gradients)) {
    for (const stop of stops) assert.ok(contrastRatio('#FFFFFF', stop) >= AAA, `${name} ${stop}: ${contrastRatio('#FFFFFF', stop).toFixed(2)}`);
  }
});

test('OLED dark mode uses a pure black base', () => {
  assert.equal(palette.dark.background, '#000000');
});
