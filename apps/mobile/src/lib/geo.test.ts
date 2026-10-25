// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bounds, haversineKm, interpolate, MIN_TRIP_KM, nearest, normalize, roadKm, stepToward } from './geo.ts';

const casablanca = { lat: 33.5731, lng: -7.5898 };
const rabat = { lat: 34.0209, lng: -6.8416 };

test('haversine Casablanca–Rabat ≈ 87 km straight', () => {
  const km = haversineKm(casablanca, rabat);
  assert.ok(km > 80 && km < 95, String(km));
});

test('road km applies the road factor and a minimum', () => {
  assert.equal(roadKm(casablanca, casablanca), MIN_TRIP_KM);
  const km = roadKm(casablanca, rabat);
  assert.ok(km > 105 && km < 120, String(km));
});

test('interpolate and step toward a target', () => {
  assert.deepEqual(interpolate({ lat: 0, lng: 0 }, { lat: 2, lng: 4 }, 0.5), { lat: 1, lng: 2 });
  const step = stepToward(casablanca, rabat, 10);
  const moved = haversineKm(casablanca, step);
  assert.ok(Math.abs(moved - 10) < 0.5, String(moved));
  assert.deepEqual(stepToward(casablanca, rabat, 500), rabat);
});

test('nearest item', () => {
  const items = [
    { id: 'rabat', ...rabat },
    { id: 'casa', ...casablanca },
  ];
  assert.equal(nearest({ lat: 33.6, lng: -7.6 }, items)?.id, 'casa');
  assert.equal(nearest({ lat: 0, lng: 0 }, [])?.id, undefined);
});

test('bounds pads and keeps a minimum span', () => {
  const b = bounds([casablanca]);
  assert.ok(b.maxLat > b.minLat && b.maxLng > b.minLng);
  assert.ok(b.maxLat - b.minLat >= 0.05);
});

test('normalize strips accents and Arabic vowel marks', () => {
  assert.equal(normalize('Fès'), 'fes');
  assert.equal(normalize('  Aïn-Sebaâ '), 'ain sebaa');
  assert.equal(normalize('مَرَّاكُش'), 'مراكش');
});
