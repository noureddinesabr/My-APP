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

const big: Searchable[] = [
  { id: 'casablanca', kind: 'city', name: { ar: 'الدار البيضاء', fr: 'Casablanca', en: 'Casablanca' }, lat: 33.57, lng: -7.59 },
  { id: 'maarif', kind: 'district', name: { ar: 'المعاريف', fr: 'Maârif', en: 'Maarif' }, lat: 33.585, lng: -7.632 },
  { id: 'sidimaarouf', kind: 'district', name: { ar: 'سيدي معروف', fr: 'Sidi Maârouf', en: 'Sidi Maarouf' }, lat: 33.53, lng: -7.645 },
  { id: 'zerktouni', kind: 'street', name: { ar: 'شارع الزرقطوني', fr: 'Boulevard Zerktouni', en: 'Zerktouni Boulevard' }, lat: 33.587, lng: -7.629 },
  { id: 'ainsebaa', kind: 'industrial', name: { ar: 'المنطقة الصناعية عين السبع', fr: 'Zone industrielle Aïn Sebaâ', en: 'Ain Sebaa industrial zone' }, lat: 33.6, lng: -7.52 },
  { id: 'rabat-agdal', kind: 'district', name: { ar: 'أكدال', fr: 'Agdal', en: 'Agdal' }, lat: 33.997, lng: -6.851 },
  { id: 'marrakech-agdal', kind: 'district', name: { ar: 'أكدال مراكش', fr: 'Agdal Marrakech', en: 'Agdal Marrakech' }, lat: 31.6, lng: -7.99 },
];
const find = (text: string, near?: { lat: number; lng: number }) => searchPlaces(big, text, 20, near).map((p) => p.id);

test('one or two typos still find the place', () => {
  assert.equal(find('zerktoni')[0], 'zerktouni');
  assert.equal(find('casablnca')[0], 'casablanca');
  assert.equal(find('sidi marouf')[0], 'sidimaarouf');
});

test('Moroccan spelling variants', () => {
  assert.equal(find('mearif')[0], 'maarif');
  assert.equal(find('ain sebaa')[0], 'ainsebaa');
  assert.equal(find('ayn sebaa')[0], 'ainsebaa');
});

test('Arabic with or without the article', () => {
  assert.equal(find('معاريف')[0], 'maarif');
  assert.equal(find('الزرقطوني')[0], 'zerktouni');
  assert.equal(find('زرقطوني')[0], 'zerktouni');
});

test('words in any order, last word half-typed', () => {
  assert.equal(find('zerktouni boul')[0], 'zerktouni');
  assert.equal(find('sebaa zone indu')[0], 'ainsebaa');
});

test('every syllable already gives suggestions', () => {
  assert.ok(find('ma').includes('maarif'));
  assert.ok(find('ze').includes('zerktouni'));
});

test('nearby places rank first', () => {
  const marrakech = { lat: 31.63, lng: -7.99 };
  const rabat = { lat: 34.02, lng: -6.84 };
  assert.equal(find('agdal', marrakech)[0], 'marrakech-agdal');
  assert.equal(find('agdal', rabat)[0], 'rabat-agdal');
});
