// Facility access policy, shared costs, and read-only Shanghai save regression.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const context = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
context.window = context; vm.createContext(context);
for (const [, file] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
  if (file === 'js/save.js') break;
}
const C = context.CM, W = 40, VW = W + 1, V = VW * 2;
const start = new Int32Array(V + 1), deg = new Int32Array(V), to = [], len = [];
for (let v = 0; v < V; v++) {
  if (v < VW) {
    if (v > 0) { to.push(v - 1); len.push(250); }
    if (v < W) { to.push(v + 1); len.push(250); }
  }
  deg[v] = to.length - start[v]; start[v + 1] = to.length;
}
const city = { W, H: 1, N: W, VW, V, vx: Float32Array.from({ length: V }, (_, v) => v % VW),
  vy: Float32Array.from({ length: V }, (_, v) => Math.floor(v / VW)), pop: new Float32Array(W).fill(1), jobs: new Float32Array(W),
  walk: { start, deg, to, len }, cellAt: (x, y) => x >= 0 && x < W && y >= 0 && y < 1 ? Math.floor(x) : -1,
  zoneOf: c => c, waterDistAt: () => 1 };
const types = ['park', 'library', 'uni', 'hosp', 'shop', 'scenic', 'cbd', 'stadium', 'venue', 'rail', 'air'];
const fixtures = types.map(t => ({ id: t, t, x: 3, y: 0, entrance: [3, 0] }));
fixtures.push({ id: 'near', t: 'park', x: 1.24, y: 0, entrance: [1.24, 0] },
  { id: 'edge', t: 'uni', x: 3, y: 0 },
  { id: 'limit', t: 'library', x: 13.5, y: 0, entrance: [13.5, 0] },
  { id: 'outside', t: 'park', x: 13.504, y: 0, entrance: [13.504, 0] });
const ringFac = new Map();
fixtures.forEach((f, i) => { const c = Math.floor(f.x); if (!ringFac.has(c)) ringFac.set(c, []); ringFac.get(c).push(i); });
const model = Object.create(C.Model.prototype);
Object.assign(model, { city, Z: W, heap: new C.U.Heap(64), zoneCells: Array.from({ length: W }, (_, c) => [c]),
  fn: { F: fixtures.length, list: fixtures, cells: fixtures.map(f => [Math.floor(f.x)]),
    inner: new Float32Array(fixtures.length).fill(60), reach: new Float32Array(fixtures.length),
    cellFac: new Map(), ringFac } });
const compiled = { stations: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 8, y: 0 }, { id: 'off', x: 3, y: 0 }],
  serviced: [true, true, false], stationLines: [new Set(['line']), new Set(['line']), new Set(['line'])] };
const at = (access, id, s = 0) => access.zl[W + fixtures.findIndex(f => f.id === id)]?.find(a => a.s === s);
let acc = model.computeAccess(compiled);
for (const t of ['park', 'library', 'uni']) {
  const a = at(acc, t); assert.equal(a.bikeShare, 1);
  assert.equal(a.w, 750 / 225 + 2 + 60 / 75);
  assert.equal(a.cost, C.CFG.choice.walkW * a.w + C.CFG.bike.transferPenalty);
  assert.ok(at(acc, t, 1), 'Farther stations on the same line remain candidates');
  assert.ok(!at(acc, t, 2), 'An unserved station is never an access candidate');
}
for (const t of types.filter(t => !['park', 'library', 'uni'].includes(t))) {
  const a = at(acc, t); assert.equal(a.bikeShare, undefined); assert.equal(a.w, (750 + 60) / 75);
}
assert.equal(at(acc, 'near').bikeShare, 0, 'The transfer penalty makes walking preferable at 310 m');
assert.equal(at(acc, 'edge').w, acc.zl[3].find(a => a.s === 0).w + 60 / 75,
  'A facility perimeter uses the same road approach and mode cost as its ordinary cell');
assert.ok(Math.abs(at(acc, 'edge').cost - acc.zl[3].find(a => a.s === 0).cost - C.CFG.choice.walkW * 60 / 75) < 1e-10);
assert.equal(at(acc, 'limit').w, 15 + 2 + 60 / 75, 'The 3375 m limit excludes preparation and indoor walking');
assert.equal(at(acc, 'outside'), undefined, 'A 3376 m ride exceeds the shared cap');
assert.equal(C.Fac.allowsBikeAccess({ t: 'park', ext: { gate: true } }), false, 'Portal access retains its special policy');

const penalty = C.CFG.bike.transferPenalty;
C.CFG.bike.transferPenalty = 100;
assert.equal(at(model.computeAccess(compiled), 'park').bikeShare, 0, 'Facility choices honor the configured transfer penalty');
C.CFG.bike.transferPenalty = penalty;
// A shorter straight line cannot bypass a long road detour.
for (let e = 0; e < to.length; e++) if ((to[e] === 2 && e >= start[1] && e < start[2]) || (to[e] === 1 && e >= start[2] && e < start[3])) len[e] += 3000;
city.walk = { start, deg, to, len }; acc = model.computeAccess(compiled);
assert.equal(at(acc, 'park'), undefined);
assert.ok(at(acc, 'park', 1), 'The reachable station on the other side remains available');
console.log('PASS selected facility types, shared limits/costs, indoor walking, perimeter access, inactive stations, penalties, portals and road detours');

if (process.env.CM_FACILITY_SAVE) {
  C.useMap('sh');
  const p = C.Save.parseEnvelope(await readFile(process.env.CM_FACILITY_SAVE, 'utf8')).payload;
  const actualCity = new C.City(); actualCity.generate(p.meta.seed, C.CFG.START.y, { deferGraphs: true });
  actualCity.restore(p.city, p.clock.y + (p.clock.m - 1) / 12);
  const actual = new C.Model(actualCity, { deferDemand: true }); actual.setYear(p.clock.y + (p.clock.m - 1) / 12); actual.buildZones();
  const full = C.Metro.compile(p.net, actualCity), policy = C.Fac.allowsBikeAccess;
  C.Fac.allowsBikeAccess = () => false;
  let baseline;
  try { baseline = actual.computeAccess(full); } finally { C.Fac.allowsBikeAccess = policy; }
  const current = actual.computeAccess(full);
  for (let z = 0; z < actual.Z; z++) assert.equal(JSON.stringify(current.zl[z]), JSON.stringify(baseline.zl[z]), 'Ordinary cell policy is unchanged');
  assert.deepEqual(current.cellWalk, baseline.cellWalk);
  assert.equal(JSON.stringify(current.transfers), JSON.stringify(baseline.transfers));
  const unaffected = [];
  actual.fn.list.forEach((f, k) => {
    if (policy(f)) return;
    const z = actual.Z + k;
    assert.equal(JSON.stringify(current.zl[z]), JSON.stringify(baseline.zl[z]), f.name);
    assert.equal(current.zCov[z], baseline.zCov[z], f.name);
    assert.equal(current.zWalk[z], baseline.zWalk[z], f.name);
    unaffected.push(f.name);
  });
  const fi = actual.facIndex('sh_yuanxiang'), node = actual.Z + fi;
  const entries = current.zl[node].map(a => ({ ...a, name: full.stations[a.s].name }));
  const bai = entries.find(a => a.name === '白银路');
  assert.ok(bai && bai.bikeShare === 1 && bai.walkable === false);
  assert.equal(current.zCov[node], 1); assert.equal(baseline.zCov[node], 0);
  const point = actual.fn.list[fi].entrance;
  actual.setNetwork(full, false, current);
  const ground = actual.tripAccess({ x: point[0], y: point[1] }).find(a => a.s === bai.s);
  assert.ok(Math.abs(bai.w - ground.minutes - actual.fn.inner[fi] / 75) < 1e-6);
  assert.equal(bai.cost, C.CFG.choice.walkW * bai.w + C.CFG.bike.transferPenalty);
  actual.syncSolve = true;
  const buf = {}, skim = actual.allocSkimStore(actual.net, buf), period = actual.ctxs.wd.per[0];
  for (const _ of actual.metroSkim(actual.net, period, 0, actual.params(), skim)) {}
  const malu = full.stations.findIndex(s => s.name === '马陆');
  const ranked = entries.map(a => ({ name: a.name, cost: a.cost + skim.gt[a.s * full.stations.length + malu] })).sort((a, b) => a.cost - b.cost);
  assert.equal(ranked[0].name, '白银路', 'The passenger cost model prefers Baiyin for the Malu direction with initialized service');
  const report = { save: process.env.CM_FACILITY_SAVE, clock: p.clock, facility: '远香湖公园',
    oldEntries: baseline.zl[node], entries, unaffectedFacilities: unaffected.length,
    toMaluChoice: ranked, serviceAssumption: 'Initialized service floors; no full-city congestion solve',
    ordinaryAccessUnchanged: true, transfersUnchanged: true, playerSaveUnchanged: true };
  if (process.env.CM_FACILITY_REPORT) await writeFile(process.env.CM_FACILITY_REPORT, JSON.stringify(report, null, 2));
  console.log('PASS Shanghai3700 actual park access and exact preservation of other facilities, ordinary cells and transfers');
  console.log(JSON.stringify({ bai, unaffectedFacilities: unaffected.length }));
}
