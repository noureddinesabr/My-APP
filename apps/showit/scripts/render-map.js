// Renders the still map pictures used by the browser preview (pages there may not load map tiles).
// Usage: node scripts/render-map.js  (needs Playwright and network; writes assets/map/*.png at 2x + bounds.json, then convert to .webp)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const VIEWS = [
  { id: 'casa', center: [-7.59, 33.575], zoom: 13 },
  { id: 'region', center: [-7.2, 33.8], zoom: 9.5 },
];
const SIZE = 2048;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 2 })).newPage();
  await p.setContent('<html><body style="margin:0"><div id="m" style="width:2048px;height:2048px"></div></body></html>');
  await p.addStyleTag({ url: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css' });
  await p.addScriptTag({ url: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js' });
  // Arabic names drawn with joined letters, right to left.
  await p.evaluate(() => maplibregl.setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js', false));
  const out = {};
  for (const v of VIEWS) {
    const bounds = await p.evaluate((v) => new Promise((res) => {
      document.getElementById('m').innerHTML = '';
      const map = new maplibregl.Map({ container: 'm', style: 'https://tiles.openfreemap.org/styles/liberty', center: v.center, zoom: v.zoom, attributionControl: false, interactive: false, preserveDrawingBuffer: true });
      // Round 9: street, neighbourhood and city names stay; only shop icons and house numbers are hidden.
      map.on('load', () => map.getStyle().layers.filter((l) => l.type === 'symbol' && ['poi', 'housenumber'].includes(l['source-layer'])).forEach((l) => map.setLayoutProperty(l.id, 'visibility', 'none')));
      map.once('idle', () => { const bb = map.getBounds(); res({ west: bb.getWest(), east: bb.getEast(), north: bb.getNorth(), south: bb.getSouth() }); });
    }), v);
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(__dirname, '../assets/map', v.id + '.png') });
    out[v.id] = bounds;
  }
  fs.writeFileSync(path.join(__dirname, '../assets/map/bounds.json'), JSON.stringify(out, null, 2) + '\n');
  await b.close();
})();
