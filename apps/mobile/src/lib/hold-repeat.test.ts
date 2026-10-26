// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { holdStep, HOLD_DELAY_MS, HOLD_INTERVAL_MS } from './hold-repeat.ts';

test('step grows the longer the button is held', () => {
  assert.equal(holdStep(10, 0), 10);
  assert.equal(holdStep(10, 11), 10);
  assert.equal(holdStep(10, 12), 50);
  assert.equal(holdStep(10, 30), 100);
});

test('holding for 3 seconds moves the price by a few hundred DH', () => {
  let elapsed = HOLD_DELAY_MS;
  let total = holdStep(10, 0);
  let repeats = 1;
  while (elapsed + HOLD_INTERVAL_MS <= 3000) {
    elapsed += HOLD_INTERVAL_MS;
    total += holdStep(10, repeats++);
  }
  assert.ok(total > 500 && total < 2500, String(total));
});
