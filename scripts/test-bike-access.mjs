import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url), c = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
c.window = c; vm.createContext(c);
for (const [, f] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(f, root), 'utf8'), c, { filename: f }); if (f === 'js/save.js') break;
}
const C = c.CM, W = 40, VW = W + 1, V = VW * 2;
const start = new Int32Array(V + 1), deg = new Int32Array(V), vx = new Float32Array(V), vy = new Float32Array(V), to = [], len = [];
for (let v = 0; v < V; v++) {
  vx[v] = v % VW; vy[v] = Math.floor(v / VW);
  if (v < VW) { if (v > 0) { to.push(v - 1); len.push(250); } if (v < W) { to.push(v + 1); len.push(250); } }
  deg[v] = to.length - start[v]; start[v + 1] = to.length;
}
const city = { W, H: 1, N: W, VW, V, vx, vy, pop: new Float32Array(W).fill(1), jobs: new Float32Array(W),
  walk: { start, deg, to, len }, cellAt: x => Math.floor(x), zoneOf: c => c, waterDistAt: () => 1 };
const model = Object.create(C.Model.prototype);
Object.assign(model, { city, Z: W, heap: new C.U.Heap(64), zoneCells: Array.from({ length: W }, (_, i) => [i]) });
const compiled = { stations: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 8, y: 0 }, { id: 'c', x: 16, y: 0 }, { id: 'unserved', x: 12, y: 0 }],
  serviced: [true, true, true, false], stationLines: [new Set(['red']), new Set(['red']), new Set(['blue']), new Set(['blue'])] };
let access = model.computeAccess(compiled); model.net = { C: compiled, N: compiled.stations.length, acc: access };
const entry = (z, s) => access.zl[z]?.find(e => e.s === s);
assert.equal(entry(3, 0).bikeShare, 1);
assert.equal(entry(3, 1).bikeShare, 1, 'A farther station on the same line is also available for cycling');
assert.equal(entry(3, 1).w, 1060 / 225 + 2);
assert.equal(entry(3, 1).cost, C.CFG.choice.walkW * entry(3, 1).w + 4);
assert.equal(entry(10, 2).bikeShare, 1, 'Cycling to another line remains available');
assert.ok(!entry(10, 3), 'An unserved station cannot provide access');
assert.equal(entry(3, 0).byLine, undefined, 'Access times do not depend on the chosen metro line');
assert.equal(entry(0, 0).bikeShare, 0, 'Walking wins for a nearby origin');
assert.equal(entry(1, 0).bikeShare, 0, 'A 310 m ride loses once the model applies the transfer penalty');
assert.equal(entry(1, 0).cost, C.CFG.choice.walkW * entry(1, 0).w);
const timedAccess = model.tripAccess({ x: 1.24, y: 0 }).find(e => e.s === 0);
assert.equal(timedAccess.mode, 'bike', 'The time tool compares elapsed time for the same 310 m approach');
assert.equal(timedAccess.minutes, 310 / 225 + 2);
assert.equal(entry(39, 0), undefined, 'Stations beyond the cycling limit stay unavailable');
city.pop.fill(0); city.jobs.fill(0); city.pop[3] = 7; city.jobs[3] = 11;
for (const k of [0, 1]) {
  const cov = model.stationCoverage(k);
  assert.equal(cov.bike.pop[2], 7); assert.equal(cov.bike.jobs[2], 11);
  assert.equal(cov.walk.pop[2], 0); assert.equal(cov.walk.jobs[2], 0, 'Residents and jobs are exclusive between modes at each station');
  assert.equal(cov.bike.pop[0], 0, 'The 810 m and 1060 m approaches take more than five elapsed minutes');
}
city.pop.fill(1);
city.jobs.fill(0);

// The geometrically closer station has a road detour; use shortest road distance.
for (let e = 0; e < to.length; e++) {
  const from = Array.from(start).findIndex((v, k) => k + 1 < start.length && v <= e && start[k + 1] > e);
  if ((from === 1 && to[e] === 2) || (from === 2 && to[e] === 1)) len[e] += 2000;
}
city.walk = { start, deg, to, len }; access = model.computeAccess(compiled);
assert.equal(entry(3, 0).bikeShare, 1, 'A road detour still permits cycling within the ride limit');
assert.equal(entry(3, 0).w, 2810 / 225 + 2, 'Cycling uses the road distance plus preparation time');
assert.equal(entry(3, 1).bikeShare, 1);
for (let e = 0; e < len.length; e++) len[e] = 250;
city.walk = { start, deg, to, len };
compiled.stations[1].x = 7; access = model.computeAccess(compiled);
assert.equal(entry(3, 0).bikeShare, 1); assert.equal(entry(3, 1).bikeShare, 1);
assert.equal(entry(3, 0).w, entry(3, 1).w, 'Equally distant stations are both cycling candidates');

compiled.stations.push({ id: 'new', x: 3, y: 0 }); compiled.serviced.push(true); compiled.stationLines.push(new Set(['red']));
access = model.computeAccess(compiled);
assert.equal(entry(3, 0).bikeShare, 1); assert.equal(entry(3, 1).bikeShare, 1, 'Adding a nearer station must not remove cycling to existing stations');
assert.equal(entry(3, 4).bikeShare, 0, 'The newly nearby station is reached on foot');
model.net = { C: compiled, acc: access };
city.pop.fill(0); city.pop[3] = 7;
assert.equal(model.stationCoverage(1).bike.pop[2], 7, 'Coverage agrees with the unrestricted cycling candidate');
assert.equal(model.stationCoverage(4).walk.pop[0], 7);
assert.equal(model.stationCoverage(4).bike.pop[2], 0);
assert.equal(C.CFG.bike.startMin, 2); assert.equal(C.CFG.bike.transferPenalty, 4);
assert.equal(C.CFG.bike.speedRatio, 3); assert.equal(C.CFG.TRAFFIC_MODEL, 9);
assert.equal(C.MAPS.sh.cfg.ZONE, 4);
console.log('PASS unrestricted same-line cycling, road distances, walking choice, limits, inactive stations, ties, new stations, exclusive coverage and unchanged 1km Shanghai zones');
