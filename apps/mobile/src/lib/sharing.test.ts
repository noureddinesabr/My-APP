// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bookingRef, overflow, remaining, sharedDiscount, sharedSettlement, suggestedReturnPrice } from './sharing.ts';

const truck = { tons: 1.5, volumeM3: 12, seats: 1 };

test('capacity is weight, volume and seats, checked separately', () => {
  const reserved = { tons: 1, volumeM3: 4, seats: 1 };
  assert.deepEqual(remaining(truck, reserved), { tons: 0.5, volumeM3: 8, seats: 0 });
  assert.deepEqual(overflow(truck, reserved, { tons: 0.4, volumeM3: 3, seats: 0 }), []);
  assert.deepEqual(overflow(truck, reserved, { tons: 0.6, volumeM3: 3, seats: 0 }), ['tons']);
  assert.deepEqual(overflow(truck, reserved, { tons: 0.2, volumeM3: 9, seats: 1 }), ['volumeM3', 'seats']);
});

test('the shared discount follows the policy and its cap', () => {
  // 25% of 200 = 50, cap 20% of 500 = 100 → 50 (the Doc 3 example).
  assert.equal(sharedDiscount(500, 200), 50);
  // 25% of 800 = 200, capped at 20% of 500 = 100.
  assert.equal(sharedDiscount(500, 800), 100);
  assert.equal(sharedDiscount(500, 0), 0);
});

test('shared settlement keeps each booking apart and never charges commission twice', () => {
  const s = sharedSettlement(500, 200, 0.1);
  assert.equal(s.revisedOriginal, 450);
  assert.equal(s.driverGross, 650);
  // Doc 4 §5: 45 + 20 = 65, driver 585.
  assert.equal(s.commissionOriginal, 45);
  assert.equal(s.commissionJoiner, 20);
  assert.equal(s.commission, 65);
  assert.equal(s.driverKeeps, 585);
  // The driver never earns less than the original price.
  assert.ok(s.driverGross >= 500);
});

test('return price suggestion and booking reference', () => {
  assert.equal(suggestedReturnPrice(2400), 1680);
  assert.equal(bookingRef('b_abc123', new Date(2026, 10, 4).getTime()), 'XB-261104-C123');
});
