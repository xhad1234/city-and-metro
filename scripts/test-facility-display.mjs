// Real Shanghai geometry, scenery, terminal demand, and underground station rules.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const context = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }) };
context.window = context; vm.createContext(context);
const load = async file => vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
for (const [, file] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  await load(file); if (file === 'js/save.js') break;
}
for (const name of ['render', 'sites', 'scenery']) await load('js/' + name + '.js');
const C = context.CM;
C.useMap('sh');
const city = new C.City(); city.generate(19900101, 2025);
const { Fac, DATA, Metro } = C, list = Fac.list(city), facility = id => list.find(f => f.id === id);
for (const [id, layout] of Object.entries(C.SH_FACILITY_LAYOUT)) {
  if (layout.outlineOnly) assert.ok(facility(id), id + ' matches an actual facility');
}
const R = Object.create(C.Renderer.prototype);
R.game = { city, mapId: 'sh', clock: { y: 2025, m: 1 }, year: () => 2025 };
R.th = { halo: '#fff' };
const models = R.facModels(city, 2025), hubs = R.hubModels(city, 2025);
assert.ok(!models.some(m => m.fac === 'sh_bund' || m.fac === 'sh_disney'));
assert.ok(models.every(m => m.lm.kind === 'measuredFacility' || facility(m.fac)?.model),
  'Existing Shanghai facilities must not spawn displaced generic scenery');
for (const id of ['sh_disney', 'sh_bund']) {
  const k = DATA.landmarks.findIndex(l => l.id === id);
  assert.ok(city.landmarkOn[k] && DATA.landmarks[k].measuredSite, 'Hide the old schematic overlay while retaining facility data');
}
for (const id of ['sh_disney', 'sh_bundv']) {
  const f = facility(id);
  assert.ok(f.layout.outlineOnly && f.layout.area[0][0].length > 4, 'Use surveyed boundaries instead of rectangular stamps');
  assert.ok(!models.some(m => m.fac === id));
}
for (const id of ['pvg_t1', 'pvg_t2', 'pvg_s1', 'pvg_s2', 'pvg_t3']) {
  assert.ok(hubs.some(h => h.id.startsWith('apt_' + id)), 'Pudong keeps its terminal / construction geometry');
}
assert.ok(models.some(m => m.fac === 'sh_hongqiao_hub_shop' && m.lm.kind === 'measuredFacility'));

// Reuse precisely the quantized bottom-map vertices, not the facility radius.
const park = facility('sh_yuanxiang'), native = C.Geo.parks.find(p => p.name === park.name);
const footprint = Fac.footprint(park, 2025);
assert.deepEqual(Array.from(footprint[0][0].flat()), Array.from(native.rings[0].p));
assert.ok(footprint[0][0].length > 4);
const mall = facility('sh_hongqiao_hub_shop');
assert.equal(Fac.footprint(mall, 2025), mall.layout.area, 'Measured multipart site has no bounding-box replacement');
const withHole = { layout: { area: [[[[0, 0], [10, 0], [10, 10], [0, 10]], [[2, 2], [4, 2], [4, 4], [2, 4]]], [[[20, 0], [21, 0], [21, 1], [20, 1]]]] }, name: 'Synthetic multipart site' };
assert.equal(Fac.contains(withHole, 1, 1), true);
assert.equal(Fac.contains(withHole, 3, 3), false, 'A courtyard hole is not part of the facility');
assert.equal(Fac.contains(withHole, 15, 0.5), false, 'Space between polygons is not a facility');
assert.equal(Fac.contains(withHole, 20.5, 0.5), true);
assert.equal(Fac.footprint({ name: 'Unknown', lmK: -1, x: 1, y: 1, r: 20 }, 2025).length, 0);
const t1 = facility('sh_hqair_t1'), t2 = facility('sh_hqair');
const terminal = DATA.airportLayout.terminals.find(t => t.id === 'hq_t1');
assert.equal(Fac.footprint(t1, 2025)[0][0], terminal.outlines[0]);
assert.deepEqual([t1.x, t1.y], [terminal.x, terminal.y]);
assert.ok(Fac.active(t1, 2025, city));
assert.ok(!Fac.active(t2, 2010 + 1 / 12, city));
assert.ok(Fac.active(t2, 2010 + 2 / 12, city));
for (const [year, total] of [[2010 + 2 / 12, 84000], [2015, 103000], [2024, 127000], [2025, 133000], [2040, 180000]]) {
  assert.ok(Math.abs(Fac.pax(t1, year) + Fac.pax(t2, year) - total) < 1e-6, 'Two terminals conserve airport demand');
  assert.ok(Math.abs(Fac.pax(t1, year) / total - 0.15) < 1e-9);
}
assert.equal(Fac.pax(t1, 2005), 48000);

// Exercise the actual outline renderer in flat and isometric projections.
for (const iso of [false, true]) {
  const commands = [], path = [], strokes = [];
  R.P = (x, y, h) => { assert.equal(h, 0); return iso ? { x: (x - y) * 20, y: (x + y) * 10 } : { x: x * 20, y: y * 20 }; };
  const ctx = { save() {}, restore() {}, setLineDash() {}, beginPath() { path.length = 0; },
    moveTo(x, y) { commands.push(['M', x, y]); path.push(['M', x, y]); },
    lineTo(x, y) { commands.push(['L', x, y]); path.push(['L', x, y]); }, closePath() { path.push(['Z']); },
    stroke() { strokes.push(path.map(p => [...p])); }, fill() {}, arc() {} };
  R.drawFacilityOutline(ctx, { selection: null, stack: [{ kind: 'facility', id: mall.id }] });
  const projected = mall.layout.area.flatMap(polygon => polygon.flatMap(ring => ring.map(([x, y], i) => {
    const p = R.P(x, y, 0); return [i ? 'L' : 'M', p.x, p.y];
  })));
  assert.equal(JSON.stringify(commands), JSON.stringify(projected));
  assert.equal(strokes[0].filter(p => p[0] === 'Z').length, mall.layout.area.flat().length);
  const count = commands.length;
  R.drawFacilityOutline(ctx, { selection: null, stack: [] });
  assert.equal(commands.length, count);
}

// A facility cannot veto underground construction; surface protection remains.
for (const id of ['sh_pearl', 'sh_disney', 'sh_hqair_t1', 'sh_hqair', 'sh_pvg_terminal']) {
  const f = facility(id), lm = f.lmK >= 0 ? DATA.landmarks[f.lmK] : f;
  assert.equal(Metro.checkSite(city, lm.x, lm.y, 'underground').ok, true, id);
}
const pearl = DATA.landmarks.find(l => l.id === 'sh_pearl');
for (const type of ['surface', 'elevated']) assert.equal(Metro.checkSite(city, pearl.x, pearl.y, type).ok, false);
console.log('PASS Shanghai duplicate scenery, exact multipart / native outlines in both views, T1 demand conservation and underground placement');
