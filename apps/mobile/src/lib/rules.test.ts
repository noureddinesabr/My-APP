// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canAskPrice, chatOpen, committedDriver, hidePhones, nextCancelLevel, pauseState } from './rules.ts';

const MIN = 60_000;
const now = 1_800_000_000_000;

test('gentle pauses: nothing for one cancel, 15 min for two, 1 h for three', () => {
  assert.equal(pauseState([], now).pausedUntil, null);
  assert.equal(pauseState([now - 5 * MIN], now).pausedUntil, null);
  const two = pauseState([now - 60 * MIN, now - 5 * MIN], now);
  assert.equal(two.minutes, 10);
  assert.equal(two.call, false);
  const three = pauseState([now - 90 * MIN, now - 60 * MIN, now - 5 * MIN], now);
  assert.equal(three.minutes, 55);
  assert.equal(three.call, true);
  // Older than a week: forgotten.
  assert.equal(pauseState([now - 8 * 24 * 60 * MIN, now - 5 * MIN], now).pausedUntil, null);
  // The rest is over.
  assert.equal(pauseState([now - 60 * MIN, now - 20 * MIN], now).pausedUntil, null);
  assert.equal(nextCancelLevel([], now), 1);
  assert.equal(nextCancelLevel([now - MIN], now), 2);
  assert.equal(nextCancelLevel([now - 2 * MIN, now - MIN], now), 3);
});

test('phone numbers are hidden in the chat', () => {
  assert.deepEqual(hidePhones('call me 06 12 34 56 78 ok'), { text: 'call me • • • ok', hidden: true });
  assert.deepEqual(hidePhones('+212612345678'), { text: '• • •', hidden: true });
  assert.deepEqual(hidePhones('floor 3, 2 boxes, 1500 DH'), { text: 'floor 3, 2 boxes, 1500 DH', hidden: false });
});

test('chats close 48 hours after the trip, cancelled chats are read-only', () => {
  assert.equal(chatOpen('toPickup', undefined, now), true);
  assert.equal(chatOpen('completed', now - 47 * 60 * MIN, now), true);
  assert.equal(chatOpen('completed', now - 49 * 60 * MIN, now), false);
  assert.equal(chatOpen('cancelled', now - MIN, now), false);
});

test('a price update only after taking the trip and before loading', () => {
  assert.equal(canAskPrice('scheduled', true, null), false);
  assert.equal(canAskPrice('scheduled', true, now), true);
  assert.equal(canAskPrice('toPickup', false, null), true);
  assert.equal(canAskPrice('atPickup', false, null), true);
  assert.equal(canAskPrice('inTransit', false, null), false);
});

test('committed driver badge', () => {
  assert.equal(committedDriver(3, 0), true);
  assert.equal(committedDriver(2, 0), false);
  assert.equal(committedDriver(10, 1), false);
});
