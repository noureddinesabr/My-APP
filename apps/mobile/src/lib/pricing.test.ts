// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  commissionSplit,
  estimateDistanceKm,
  estimateDurationMinutes,
  estimatePrice,
  IN_CITY_KM,
  suggestVehicle,
  suitableVehicles,
} from './pricing.ts';

const casablanca = { lat: 33.5731, lng: -7.5898 };
const rabat = { lat: 34.0209, lng: -6.8416 };
const marrakech = { lat: 31.6295, lng: -7.9811 };

test('suggests the smallest vehicle that fits the weight', () => {
  assert.equal(suggestVehicle(0.3), 'triporteur');
  assert.equal(suggestVehicle(1), 'pickup');
  assert.equal(suggestVehicle(3.5), 'truck35');
  assert.equal(suggestVehicle(5), 'truck7');
  assert.equal(suggestVehicle(30), 'semi');
  assert.equal(suggestVehicle(100), 'semi');
  assert.equal(suggestVehicle(2, true), 'refrigerated');
});

test('suitable vehicles all carry the weight', () => {
  assert.deepEqual(suitableVehicles(25), ['semi', 'flatbed']);
  assert.equal(suitableVehicles(0.3).length, 9);
});

test('distance: same city uses the in-city default', () => {
  assert.equal(estimateDistanceKm(casablanca, casablanca, true), IN_CITY_KM);
});

test('distance: intercity estimates are close to real road distances', () => {
  const toRabat = estimateDistanceKm(casablanca, rabat, false); // real road ≈ 90 km
  const toMarrakech = estimateDistanceKm(casablanca, marrakech, false); // real road ≈ 240 km
  assert.ok(toRabat > 80 && toRabat < 120, `Casa-Rabat ${toRabat}`);
  assert.ok(toMarrakech > 200 && toMarrakech < 290, `Casa-Marrakech ${toMarrakech}`);
});

test('duration includes loading time', () => {
  assert.equal(estimateDurationMinutes(60), 80);
});

test('price: range around suggested, helpers added, rounded to 10 MAD', () => {
  const noHelpers = estimatePrice('truck35', 12, 0);
  assert.equal(noHelpers.suggested, 360);
  assert.equal(noHelpers.low, 320);
  assert.equal(noHelpers.high, 400);
  const withHelpers = estimatePrice('truck35', 12, 2);
  assert.equal(withHelpers.helpersFee, 160);
  assert.equal(withHelpers.suggested, 520);
  for (const value of Object.values(withHelpers)) assert.equal(value % 10, 0);
});

test('commission: 10% by default, driver keeps the rest', () => {
  assert.deepEqual(commissionSplit(720), { commission: 72, driverKeeps: 648 });
  assert.deepEqual(commissionSplit(1255, 0.08), { commission: 100, driverKeeps: 1155 });
});
