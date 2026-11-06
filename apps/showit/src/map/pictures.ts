import type { LatLng } from '../lib/geo';

/**
 * Browser version. Pages like the claude.ai preview can't load map tiles, so this shows still
 * pictures of the same OpenStreetMap style (made by scripts/render-map.js): Casablanca up close,
 * and the Casablanca–Rabat region. Places outside them show no pin here (phones use the live map).
 */
const BOUNDS = require('../../assets/map/bounds.json') as Record<'casa' | 'region', { west: number; east: number; north: number; south: number }>;
export const PICTURES = [
  { id: 'casa' as const, source: require('../../assets/map/casa.webp'), b: BOUNDS.casa },
  { id: 'region' as const, source: require('../../assets/map/region.webp'), b: BOUNDS.region },
];
export const SIZE = 2048;

export const mercX = (lng: number) => (lng + 180) / 360;
export const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

export type Pic = (typeof PICTURES)[number];
export const toPx = (pic: Pic, p: LatLng) => ({
  x: ((mercX(p.lng) - mercX(pic.b.west)) / (mercX(pic.b.east) - mercX(pic.b.west))) * SIZE,
  y: ((mercY(p.lat) - mercY(pic.b.north)) / (mercY(pic.b.south) - mercY(pic.b.north))) * SIZE,
});
export const inside = (pic: Pic, p: LatLng) => p.lng > pic.b.west && p.lng < pic.b.east && p.lat > pic.b.south && p.lat < pic.b.north;


/** The point at a pixel of a picture (the reverse of `toPx`). */
export const fromPx = (pic: Pic, x: number, y: number): LatLng => {
  const mx = mercX(pic.b.west) + (x / SIZE) * (mercX(pic.b.east) - mercX(pic.b.west));
  const my = mercY(pic.b.north) + (y / SIZE) * (mercY(pic.b.south) - mercY(pic.b.north));
  const k = (0.5 - my) * 4 * Math.PI;
  const e = Math.exp(k);
  return { lng: mx * 360 - 180, lat: (Math.asin((e - 1) / (e + 1)) * 180) / Math.PI };
};
