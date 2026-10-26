// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  arrived,
  autoStatus,
  canCancel,
  deliveryCode,
  dueReminder,
  isLateCancel,
  lateMinutes,
  levelFor,
  reliability,
  remaining,
  simulatedStart,
  simulateStep,
  simulationTarget,
  targetFor,
  timelineFor,
} from './trip.ts';

const pickup = { lat: 33.585, lng: -7.632 };
const dropoff = { lat: 33.997, lng: -6.851 };
const near = (p: { lat: number; lng: number }, metres: number) => ({ lat: p.lat + metres / 111_000, lng: p.lng });
const MIN = 60_000;
const HOUR = 60 * MIN;

test('GPS moves the trip forward automatically', () => {
  assert.equal(autoStatus('toPickup', near(pickup, 500), pickup, dropoff), null);
  assert.equal(autoStatus('toPickup', near(pickup, 100), pickup, dropoff), 'atPickup');
  assert.equal(autoStatus('atPickup', near(pickup, 200), pickup, dropoff), null);
  assert.equal(autoStatus('atPickup', near(pickup, 400), pickup, dropoff), 'inTransit');
  assert.equal(autoStatus('loading', near(pickup, 400), pickup, dropoff), 'inTransit');
  assert.equal(autoStatus('inTransit', near(dropoff, 120), pickup, dropoff), 'atDropoff');
  assert.equal(autoStatus('atDropoff', dropoff, pickup, dropoff), null);
  assert.equal(autoStatus('scheduled', pickup, pickup, dropoff), null);
});

test('timeline includes the booking step only for scheduled jobs', () => {
  assert.equal(timelineFor(true)[0], 'scheduled');
  assert.equal(timelineFor(false)[0], 'toPickup');
});

test('targets and simulation', () => {
  assert.deepEqual(targetFor('toPickup', pickup, dropoff), pickup);
  assert.deepEqual(targetFor('inTransit', pickup, dropoff), dropoff);
  assert.equal(targetFor('atPickup', pickup, dropoff), null);
  assert.equal(simulationTarget('atPickup', pickup, dropoff, 1000, 5000), null);
  assert.deepEqual(simulationTarget('atPickup', pickup, dropoff, 1000, 12_000), dropoff);
  assert.equal(simulationTarget('scheduled', pickup, dropoff, undefined, 0), null);
});

test('simulation reaches the target in about the leg time, never overshooting', () => {
  let position = simulatedStart(pickup, { lat: 0, lng: 0 });
  const legKm = remaining(position, pickup).km;
  let ticks = 0;
  while (!arrived(position, pickup) && ticks < 100) {
    position = simulateStep(position, pickup, legKm);
    ticks++;
  }
  assert.ok(ticks >= 8 && ticks <= 30, String(ticks));
});

test('cancelling rules', () => {
  assert.ok(canCancel('scheduled'));
  assert.ok(canCancel('atPickup'));
  assert.ok(!canCancel('inTransit'));
  const t = 10 * HOUR;
  assert.ok(isLateCancel(t, t - HOUR));
  assert.ok(!isLateCancel(t, t - 3 * HOUR));
  assert.ok(!isLateCancel(null, 0));
});

test('late arrival counts after 10 minutes of grace', () => {
  assert.equal(lateMinutes(0, 9 * MIN), 0);
  assert.equal(lateMinutes(0, 25 * MIN), 25);
  assert.equal(lateMinutes(null, 99 * MIN), 0);
});

test('reminders: only the latest due one shows, earlier ones are marked sent', () => {
  const t = 100 * HOUR;
  assert.deepEqual(dueReminder(t, t - 30 * HOUR, [], 'driver', false), { show: null, markSent: [] });
  assert.equal(dueReminder(t, t - 20 * HOUR, [], 'driver', false).show, 'day');
  const late = dueReminder(t, t - 30 * MIN, [], 'driver', false);
  assert.equal(late.show, 'leave');
  assert.deepEqual(late.markSent, ['driver:day', 'driver:twoHours', 'driver:leave']);
  assert.equal(dueReminder(t, t - 30 * MIN, ['client:day'], 'client', false).show, 'twoHours');
  assert.equal(dueReminder(t, t + 15 * MIN, [], 'client', false).show, 'late');
  assert.equal(dueReminder(t, t + 15 * MIN, ['driver:day', 'driver:twoHours'], 'driver', true).show, null);
});

test('levels and reliability come from real numbers', () => {
  assert.equal(levelFor(0, 5), 'new');
  assert.equal(levelFor(10, 4.2), 'bronze');
  assert.equal(levelFor(25, 4.6), 'silver');
  assert.equal(levelFor(60, 4.8), 'gold');
  assert.equal(levelFor(200, 4.9), 'platinum');
  assert.equal(levelFor(200, 4.4), 'bronze');
  assert.equal(reliability({ accepted: 0, cancelled: 0, lateCancels: 0, late: 0, onTime: 0 }), 100);
  assert.equal(reliability({ accepted: 10, cancelled: 1, lateCancels: 0, late: 2, onTime: 7 }), 80);
});

test('delivery code is 4 digits', () => {
  assert.equal(deliveryCode(() => 0.0042), '0042');
  assert.match(deliveryCode(), /^\d{4}$/);
});
