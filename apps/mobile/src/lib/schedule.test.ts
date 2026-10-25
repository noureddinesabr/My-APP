// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bookableDays,
  defaultSchedule,
  ensureBookable,
  fromLocalString,
  periodOf,
  slotsForDay,
  toLocalString,
} from './schedule.ts';

const at = (value: string) => fromLocalString(value);

test('local string round-trips', () => {
  assert.equal(toLocalString(at('2026-10-27T09:30')), '2026-10-27T09:30');
});

test('days start today and cross month ends', () => {
  const days = bookableDays(at('2026-10-30T10:00'), 4).map((d) => toLocalString(d).slice(0, 10));
  assert.deepEqual(days, ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
});

test('slots run 07:00 to 21:00 every 30 minutes', () => {
  const slots = slotsForDay(at('2026-10-28T00:00'), at('2026-10-27T10:00'));
  assert.equal(slots.length, 29);
  assert.equal(slots[0].value, '2026-10-28T07:00');
  assert.equal(slots.at(-1)?.value, '2026-10-28T21:00');
  assert.ok(slots.every((slot) => slot.available));
});

test('slots less than one hour away are unavailable', () => {
  const slots = slotsForDay(at('2026-10-27T00:00'), at('2026-10-27T10:10'));
  const firstAvailable = slots.find((slot) => slot.available);
  assert.equal(firstAvailable?.value, '2026-10-27T11:30');
  assert.ok(!slots.find((slot) => slot.value === '2026-10-27T11:00')?.available);
});

test('default is the next slot today, or tomorrow 09:00 in the evening', () => {
  assert.equal(defaultSchedule(at('2026-10-27T10:10')), '2026-10-27T11:30');
  assert.equal(defaultSchedule(at('2026-10-27T20:30')), '2026-10-28T09:00');
});

test('a past or too-soon saved time moves to the default', () => {
  const now = at('2026-10-27T10:10');
  assert.equal(ensureBookable('2026-10-29T15:00', now), '2026-10-29T15:00');
  assert.equal(ensureBookable('2026-10-26T15:00', now), '2026-10-27T11:30');
  assert.equal(ensureBookable(undefined, now), '2026-10-27T11:30');
  assert.equal(ensureBookable('garbage', now), '2026-10-27T11:30');
});

test('periods of the day', () => {
  assert.equal(periodOf(7), 'morning');
  assert.equal(periodOf(12), 'afternoon');
  assert.equal(periodOf(17), 'evening');
});
