import assert from 'node:assert/strict';
import { test } from 'node:test';

// The pure part of src/i18n/direction.ts (the rest needs React Native).
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏ]/;
function textDirection(text: string, fallback: boolean) {
  for (const char of text) {
    if (RTL_CHAR.test(char)) return 'rtl';
    if (LTR_CHAR.test(char)) return 'ltr';
  }
  return fallback ? 'rtl' : 'ltr';
}

test('Arabic text reads right to left', () => {
  assert.equal(textDirection('السلام عليكم', false), 'rtl');
  assert.equal(textDirection('  123 مرحبا', false), 'rtl');
});

test('French and English read left to right, even in the Arabic app', () => {
  assert.equal(textDirection('Bonjour, je suis là', true), 'ltr');
  assert.equal(textDirection('Éléphant', true), 'ltr');
  assert.equal(textDirection('OK مرحبا', true), 'ltr');
});

test('no letters yet follows the app language', () => {
  assert.equal(textDirection('', true), 'rtl');
  assert.equal(textDirection('0612 34', false), 'ltr');
});
