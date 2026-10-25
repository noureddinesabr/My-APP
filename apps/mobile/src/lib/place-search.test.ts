// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { searchPlaces, type Searchable } from './place-search.ts';

const places: Searchable[] = [
  { id: 'casablanca', kind: 'city', name: { ar: 'الدار البيضاء', fr: 'Casablanca', en: 'Casablanca' }, aliases: ['casa', 'dar el beida'] },
  { id: 'fes', kind: 'city', name: { ar: 'فاس', fr: 'Fès', en: 'Fez' } },
  { id: 'sale', kind: 'city', name: { ar: 'سلا', fr: 'Salé', en: 'Salé' } },
  { id: 'casa-maarif', kind: 'district', name: { ar: 'المعاريف', fr: 'Maârif', en: 'Maarif' } },
  { id: 'casa-ainsebaa', kind: 'industrial', name: { ar: 'المنطقة الصناعية عين السبع', fr: 'Zone industrielle Aïn Sebaâ', en: 'Ain Sebaa industrial zone' } },
  { id: 'tanger', kind: 'city', name: { ar: 'طنجة', fr: 'Tanger', en: 'Tangier' } },
];
const ids = (text: string) => searchPlaces(places, text).map((p) => p.id);

test('empty query gives nothing', () => {
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('   '), []);
});

test('prefix match, accent and case insensitive', () => {
  assert.deepEqual(ids('fes'), ['fes']);
  assert.deepEqual(ids('FEZ'), ['fes']);
  assert.deepEqual(ids('sale'), ['sale']);
  assert.deepEqual(ids('maarif'), ['casa-maarif']);
});

test('aliases and other languages', () => {
  assert.deepEqual(ids('casa'), ['casablanca']);
  assert.deepEqual(ids('tangier'), ['tanger']);
  assert.deepEqual(ids('طنجة'), ['tanger']);
  assert.deepEqual(ids('البيضاء'), ['casablanca']);
});

test('word starts inside a name', () => {
  assert.deepEqual(ids('sebaa'), ['casa-ainsebaa']);
  assert.deepEqual(ids('indus'), ['casa-ainsebaa']);
});

test('cities rank above other places with the same match', () => {
  const extra: Searchable[] = [
    { id: 'rabat-ocean', kind: 'district', name: { ar: 'المحيط', fr: 'Rabat Océan', en: 'Rabat Ocean' } },
    { id: 'rabat', kind: 'city', name: { ar: 'الرباط', fr: 'Rabat', en: 'Rabat' } },
  ];
  assert.deepEqual(searchPlaces(extra, 'rab').map((p) => p.id), ['rabat', 'rabat-ocean']);
});

test('limit', () => {
  const many: Searchable[] = ['Sidi A', 'Sidi B', 'Sidi C'].map((name, i) => ({
    id: String(i),
    kind: 'district',
    name: { ar: name, fr: name, en: name },
  }));
  assert.equal(searchPlaces(many, 'sidi', 2).length, 2);
});
