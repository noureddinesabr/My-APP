// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arrived, canCancel, nextStatus, remaining, simulatedStart, simulateStep, targetFor } from './trip.ts';

const pickup = { lat: 33.585, lng: -7.632 };
const dropoff = { lat: 33.997, lng: -6.851 };

test('target follows the trip status', () => {
  assert.deepEqual(targetFor('toPickup', pickup, dropoff), pickup);
  assert.deepEqual(targetFor('inTransit', pickup, dropoff), dropoff);
  assert.equal(targetFor('loading', pickup, dropoff), null);
});

test('remaining distance and minutes', () => {
  const r = remaining(pickup, dropoff);
  assert.ok(r.km > 100 && r.km < 125, String(r.km));
  assert.ok(r.minutes > 80 && r.minutes < 110, String(r.minutes));
  assert.equal(remaining(pickup, pickup).minutes, 1);
});

test('simulation reaches the target in about the leg time, never overshooting', () => {
  let position = simulatedStart(pickup, { lat: 0, lng: 0 });
  const legKm = remaining(position, pickup).km;
  let ticks = 0;
  while (!arrived(position, pickup) && ticks < 100) {
    position = simulateStep(position, pickup, legKm);
    ticks++;
  }
  assert.ok(ticks >= 10 && ticks <= 30, String(ticks));
  assert.deepEqual(position, pickup);
});

test('status order and cancelling', () => {
  assert.equal(nextStatus('toPickup'), 'atPickup');
  assert.equal(nextStatus('atDropoff'), 'delivered');
  assert.equal(nextStatus('delivered'), null);
  assert.equal(nextStatus('cancelled'), null);
  assert.ok(canCancel('atPickup'));
  assert.ok(!canCancel('loading'));
});
