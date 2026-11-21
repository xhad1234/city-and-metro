// Isolated bridge topology and tool-coordinate regressions. Player saves are read-only.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
context.window = context; vm.createContext(context);
const load = async file => vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
for (const [, file] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  await load(file); if (file === 'js/save.js') break;
}
const C = context.CM; C.useMap('sh');
for (const file of ['js/render.js', 'js/tools.js']) await load(file);

function bridgeFixture({ flags = 1, bridgeYear = 2025, bankYear = 2020, water = 1, rail = 0, missingBank = false, walkOnly = false } = {}) {
  const city = new C.City(); Object.assign(city, { W: 8, H: 8, N: 64, VW: 9, V: 81, BW: 32, BH: 32 });
  city.eOff = [0, 72, 144, 208];
  for (const key of ['eArt', 'eCls', 'eBlock', 'eWalkRoad', 'eRail']) city[key] = new Uint8Array(272);
  city.eName = new Uint16Array(272); city.eRailDet = new Float32Array(272);
  city.vx = Float32Array.from({ length: 81 }, (_, v) => v % 9);
  city.vy = Float32Array.from({ length: 81 }, (_, v) => Math.floor(v / 9));
  city.street = new Uint8Array(64); city.bmask = new Uint8Array(1024);
  city.updateRail = () => false; city.computeRailBlock = () => {}; city.railGeom = () => ({ surfHits() {} });
  const paths = [[2, 4, 3.9, 3.9], [3.9, 3.9, 4.1, 4.1], [4.1, 4.1, 6, 4]];
  city.roadGroups = paths.map((p, i) => ({ name: '天祝路', cls: walkOnly ? 1 : 2, walkOnly, flags: i === 1 ? flags : 0,
    year: i === 1 ? bridgeYear : bankYear, ways: [Float32Array.from(p)], bbox: C.Geo.bbox(p) }));
  if (missingBank) city.roadGroups.pop();
  city.roadWays = city.roadGroups.map((g, i) => ({ g: i, p: g.ways[0], bbox: g.bbox }));
  city.roadWayBk = C.Geo.buckets(city.roadWays, 4, 8, 8);
  city.roadsBuilt = new Uint8Array(city.roadGroups.length);
  const crossing = city.edgeBetween(3, 4, 4, 4), otherBank = city.edgeBetween(4, 4, 5, 4);
  city.eBlock[crossing] = city.eBlock[otherBank] = water;
  city.eRail[crossing] = rail;
  const unrelated = city.edgeBetween(4, 3, 4, 4); city.eBlock[unrelated] = 1; city.eArt[unrelated] = 1;
  const walk = year => {
    city.applyRoads(year); city.updateStreets();
    const it = city.buildGraphsGen(); it.next(); it.next(); it.return();
  };
  const has = (a, b) => city.walk.to.slice(city.walk.start[a], city.walk.start[a + 1]).includes(b);
  return { city, walk, has, crossing, unrelated };
}

{
  const f = bridgeFixture(); f.walk(2020); assert.equal(f.has(39, 40), false, 'Unopened bridge stays closed');
  f.walk(2025); assert.equal(f.has(39, 40), true, 'Collapsed short bridge connects its west bank');
  assert.equal(f.has(40, 41), true, 'Collapsed short bridge connects its east bank');
  assert.equal(f.has(31, 40), false, 'An unrelated unbridged river crossing stays blocked');
  const bits = Array.from(f.city.eWalkRoad); f.walk(2026); assert.deepEqual(Array.from(f.city.eWalkRoad), bits);
}
for (const options of [{ flags: 0 }, { missingBank: true }, { water: 2 }, { rail: 2 }, { flags: 5 }]) {
  const f = bridgeFixture(options); f.walk(2025); assert.equal(f.has(39, 40), false, JSON.stringify(options));
}
{
  const f = bridgeFixture({ bankYear: 2026 }); f.walk(2025); assert.equal(f.has(39, 40), false);
  f.walk(2026); assert.equal(f.has(39, 40), true, 'Opening the approaches activates the cached bridge link');
}
{
  const f = bridgeFixture({ walkOnly: true }); f.walk(2025);
  assert.equal(f.has(39, 40), true, 'A pedestrian-only short bridge also retains its crossing');
  assert.equal(f.city.eArt[f.crossing], 0, 'A footbridge does not create vehicle access');
}
console.log('PASS collapsed bridge, both banks, opening years, repeat rebuild, unbridged water, reclamation and rail barriers');

const bridgeLinks = C.City.prototype.shortWalkBridgeLinks;
C.City.prototype.shortWalkBridgeLinks = () => [];
const city = new C.City(); city.generate(19900101, 2020);
let payload = null;
if (process.env.CM_WALK_SAVE) {
  payload = C.Save.parseEnvelope(await readFile(process.env.CM_WALK_SAVE, 'utf8')).payload;
  city.restore(payload.city, payload.clock.y + (payload.clock.m - 1) / 12);
}
const park = C.Fac.list(city).find(f => f.id === 'sh_yuanxiang');
const stations = payload ? Object.values(payload.net.stations).filter(s => ['白银路', '嘉定新城', '马陆'].includes(s.name)) : [
  { id: 'bayin', name: '白银路', x: 167.53102729463313, y: 239.66469115043182 },
  { id: 'jiading', name: '嘉定新城', x: 170.7478747182474, y: 245.92983028417507 },
  { id: 'malu', name: '马陆', x: 179.0262888065495, y: 251.16537713978366 },
];
const from = { x: park.entrance[0], y: park.entrance[1] };
const station = stations.find(s => s.name === '白银路');
const edge = city.edgeBetween(172, 239, 171, 240);
assert.equal(city.eBlock[edge], 1);
const connects = () => city.walk.to.slice(city.walk.start[239 * city.VW + 172], city.walk.start[239 * city.VW + 172 + 1]).includes(240 * city.VW + 171);
assert.equal(connects(), false);
const accessFor = () => {
  const model = new C.Model(city, { deferDemand: true }), compiled = { stations, serviced: stations.map(() => true) };
  const acc = model.computeAccess(compiled); model.net = { C: compiled, N: stations.length, acc };
  return { model, compiled, acc, approaches: model.tripAccess(from).map(a => ({ ...a, name: stations[a.s].name })) };
};
const baseline = accessFor(), originalWalk = city.walk, car = city.car;
C.City.prototype.shortWalkBridgeLinks = bridgeLinks;
const bridgeStarted = performance.now(); city.buildGraphs();
const bridgeMs = performance.now() - bridgeStarted, repaired = accessFor();
assert.ok(city.eWalkRoad[edge] & 2, 'The real Tianzhu bridge grants crossing permission');
assert.equal(connects(), true);
assert.equal(city.car, car, 'The pedestrian bridge repair leaves the car graph unchanged');
assert.notEqual(city.walk, originalWalk, 'Rebuilding replaces the walking graph and invalidates access-tree identity');
const before = baseline.approaches.find(a => a.name === '白银路'), after = repaired.approaches.find(a => a.name === '白银路');
assert.ok(after.metres < before.metres - 200, 'The real park-to-Baiyin route avoids the short-bridge detour');
const refreshedAccess = baseline.model.computeAccess(baseline.compiled);
assert.notEqual(refreshedAccess.trees[before.s], baseline.acc.trees[before.s], 'Existing station trees are invalidated by the rebuilt walk graph');
baseline.model.net.acc = refreshedAccess;
assert.ok(Math.abs(baseline.model.tripAccess(from).find(a => a.s === before.s).metres - after.metres) < 1e-8);

// Exercise the actual click and hover handlers in both map projections, including
// an elevated station: snapping must use its world coordinate, not its screen height.
const game = { city, clock: { y: 2023 }, net: { stations: Object.fromEntries(stations.map(s => [s.id, s])) }, jumping: false };
C.game = game;
const tools = Object.create(C.Tools.prototype);
const renderer = Object.create(C.Renderer.prototype);
Object.assign(renderer, { ox: -9000, oy: -12000, z: 60, hs: 5, cv: { style: {} } });
tools.R = renderer; tools.ui = { renderToolOpts() {}, refreshTripTime() {}, setTooltip() {} };
tools.buildType = 'underground'; tools.stationSize = 'M';
renderer.pickStation = (sx, sy) => {
  const p = renderer.P(station.x, station.y, 3);
  return Math.hypot(sx - p.x, sy - p.y) < 8 ? station.id : null;
};
const checked = [];
for (const M of [[1, 0, 0, 1], [0.866, -0.866, 0.5, 0.5]]) {
  renderer.M = M; renderer.det = M[0] * M[3] - M[1] * M[2];
  const start = renderer.P(from.x, from.y, 0), end = renderer.P(station.x, station.y, 3);
  tools.tool = 'measure'; tools.meas = { pts: [], done: false };
  tools.updateHover(start.x, start.y, false);
  tools.onClick(start.x, start.y, false); tools.onClick(end.x, end.y, false);
  const measured = Array.from(tools.meas.pts, p => Array.from(p));
  tools.tool = 'tripTime'; tools.tripTime = { points: [] };
  tools.onClick(start.x, start.y, false); tools.onClick(end.x, end.y, false);
  const points = tools.tripTime.points;
  assert.deepEqual(measured, Array.from(points, p => [p.x, p.y]));
  assert.equal(points[1].station, station.id);
  assert.ok(Math.abs(points[0].x - from.x) < 1e-10 && Math.abs(points[0].y - from.y) < 1e-10);
  const info = tools.measureInfo(measured), expected = C.U.dist(from.x, from.y, station.x, station.y) * C.CFG.CELL_M;
  assert.ok(Math.abs(info.lenM - expected) < 1e-8);
  checked.push({ points, straightM: info.lenM });
}
const short = tools.measureInfo([[from.x, from.y], [from.x + 3, from.y]]);
assert.equal(short.lenM, 750, 'A sub-kilometre measurement is not scaled to kilometres by routing units');
assert.equal(C.CFG.CELL_M, 250); assert.equal(C.CFG.walk.maxAccessM, 1125);
const full = payload && C.Metro.compile(payload.net, city);
let trip = null, facilityAccess = null;
if (full) {
  const model = new C.Model(city, { deferDemand: true });
  model.setYear(payload.clock.y + (payload.clock.m - 1) / 12); model.buildZones(); model.setNetwork(full);
  const fi = model.facIndex(park.id), entries = model.net.acc.zl[model.Z + fi];
  facilityAccess = { covered: model.net.acc.zCov[model.Z + fi],
    entries: entries && Array.from(entries, a => ({ ...a, name: full.stations[a.s].name })) };
  if (C.Fac.allowsBikeAccess(park) && after.metres <= C.CFG.walk.mPerMin * C.CFG.bike.speedRatio * C.CFG.bike.maxRideMin) {
    const bike = entries?.find(a => full.stations[a.s].id === station.id);
    assert.ok(bike && bike.bikeShare === 1, 'The park can cycle to Baiyin beyond the walking limit');
  } else if (after.metres > C.CFG.walk.maxAccessM) {
    assert.ok(!entries?.some(a => full.stations[a.s].id === station.id), 'Facility walking access excludes a station beyond the limit even when the time tool can cycle there');
  }
  const end = stations.find(s => s.name === '马陆');
  trip = model.tripTime(from, { x: end.x, y: end.y, station: end.id });
  assert.equal(trip.status, 'ready');
  assert.ok(trip.periods.every(p => full.stations[p.sections[0].s].name === '白银路'));
  trip = trip.periods.map(p => ({ total: p.total, station: full.stations[p.sections[0].s].name, mode: p.sections[0].mode }));
}
const report = { save: process.env.CM_WALK_SAVE || null, from, to: station, straightM: checked[0].straightM,
  baseline: baseline.approaches, repaired: repaired.approaches, endpointChecks: checked, trip, facilityAccess,
  bridgeMs,
  periodAssumption: 'Initialized service floors; no full-city congestion solve; player save unchanged' };
if (process.env.CM_WALK_REPORT) await writeFile(process.env.CM_WALK_REPORT, JSON.stringify(report, null, 2));
if (process.env.CM_WALK_NETWORK) {
  const bounds = [164.5, 234.5, 178.5, 248.5];
  const edges = walk => {
    const result = [];
    for (let j = 234; j <= 249; j++) for (let i = 164; i <= 179; i++) {
      const a = j * city.VW + i;
      for (let e = walk.start[a]; e < walk.start[a + 1]; e++) {
        const b = walk.to[e]; if (a < b) result.push([city.vx[a], city.vy[a], city.vx[b], city.vy[b]]);
      }
    }
    return result;
  };
  const paths = result => Array.from(result.approaches, a => {
    const tree = result.acc.trees[a.s], path = [[from.x, from.y]];
    for (let v = a.corner; v >= 0;) {
      const index = tree.accessVerts.indexOf(v); path.push([city.vx[v], city.vy[v]]); v = tree.accessPred[index];
    }
    path.push([stations[a.s].x, stations[a.s].y]); return { ...a, path };
  });
  await writeFile(process.env.CM_WALK_NETWORK, JSON.stringify({ bounds, from, stations, straightM: report.straightM,
    before: { edges: edges(originalWalk), paths: paths(baseline) }, after: { edges: edges(city.walk), paths: paths(repaired) } }));
}
console.log('PASS real Tianzhu bridge, unchanged car graph, route cache rebuild, shared measure/trip endpoints in 2D and 2.5D');
console.log(JSON.stringify({ straightM: report.straightM, beforeM: before.metres, afterM: after.metres, bridgeMs, trip, facilityAccess }));
