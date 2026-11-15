// Run with: npm test — every text/background pair the app uses must pass WCAG AAA (7:1).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastRatio } from './contrast.ts';
import { Gradients, highContrast, palette } from './palette.ts';

const AAA = 7;

type Colors = Record<string, string>;
const pairs = (c: Colors): [string, string, string][] => [
  ...(['background', 'surface', 'surfaceRaised', 'surfaceFloating', 'surfaceMuted'] as const).flatMap((bg) =>
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

test('text on every gradient stop passes AAA (dark text on the bright lime / coral / green)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const ink = { primary: palette[scheme].onPrimary, hero: palette[scheme].onHero, accent: palette[scheme].onPrimary, success: palette[scheme].onPrimary };
    for (const [name, stops] of Object.entries(Gradients)) {
      for (const stop of stops) assert.ok(contrastRatio(ink[name as keyof typeof ink], stop) >= AAA, `${scheme} ${name} ${stop}: ${contrastRatio(ink[name as keyof typeof ink], stop).toFixed(2)}`);
    }
  }
});

test('dark mode uses the charcoal base', () => {
  assert.equal(palette.dark.background, '#1C1C1E');
});
