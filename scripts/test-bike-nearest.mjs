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
  walk: { start, deg, to, len }, cellAt: x => Math.floor(x), zoneOf: c => c };
const model = Object.create(C.Model.prototype);
Object.assign(model, { city, Z: W, heap: new C.U.Heap(64), zoneCells: Array.from({ length: W }, (_, i) => [i]) });
const compiled = { stations: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 8, y: 0 }, { id: 'c', x: 16, y: 0 }, { id: 'unserved', x: 12, y: 0 }],
  serviced: [true, true, true, false], stationLines: [new Set(['red']), new Set(['red']), new Set(['blue']), new Set(['blue'])] };
let access = model.computeAccess(compiled); model.net = { C: compiled, acc: access };
const entry = (z, s) => access.zl[z]?.find(e => e.s === s);
assert.equal(entry(3, 0).bikeShare, 1);
assert.equal(entry(3, 1).bikeShare, 0, 'A farther same-line station remains available only on foot');
assert.equal(entry(3, 1).w, 1060 / 75);
assert.ok(!access.bikeCells[1].has(3));
assert.ok(access.bikeCells[2].has(10), 'A different line may have its own farther nearest station');
assert.ok(!access.bikeCells[3].has(10), 'An unserved nearer station must not steal riders');
assert.ok(entry(10, 2).byLine.blue > 0);
assert.equal(entry(10, 2).byLine.red, undefined);
city.pop.fill(0); city.pop[3] = 7;
assert.equal(model.stationCoverage(0).bike.pop[2], 7);
assert.equal(model.stationCoverage(1).bike.pop[2], 0);
assert.equal(model.stationCoverage(1).walk.pop[2], 7, 'Walking/cycling coverage follows the same candidate restrictions');
city.pop.fill(1);

// The geometrically closer station has a road detour; use shortest road distance.
for (let e = 0; e < to.length; e++) {
  const from = Array.from(start).findIndex((v, k) => k + 1 < start.length && v <= e && start[k + 1] > e);
  if ((from === 1 && to[e] === 2) || (from === 2 && to[e] === 1)) len[e] += 2000;
}
city.walk = { start, deg, to, len }; access = model.computeAccess(compiled);
assert.ok(access.bikeCells[1].has(3), 'Road distance can favor the geometrically farther station');
assert.ok(!access.bikeCells[0].has(3));
for (let e = 0; e < len.length; e++) len[e] = 250;
city.walk = { start, deg, to, len };
compiled.stations[1].x = 7; access = model.computeAccess(compiled);
assert.ok(access.bikeCells[0].has(3)); assert.ok(!access.bikeCells[1].has(3), 'Equal distances use stable station order');

compiled.stations.push({ id: 'new', x: 3, y: 0 }); compiled.serviced.push(true); compiled.stationLines.push(new Set(['red']));
access = model.computeAccess(compiled);
assert.ok(!access.bikeCells[0].has(3)); assert.ok(!access.bikeCells[1].has(3));
assert.equal(access.zl[3].find(e => e.s === 4).bikeShare, 0, 'A newly nearer station is best reached on foot; do not cycle past it');
console.log('PASS road-nearest station per line, preserved walking, multiple lines, unserved stations, ties, coverage and cached-network updates');

// An interchange must not borrow another line's nearest-station bicycle access.
const interchange = { w: 6, walkW: 18, byLine: { red: 6 } }, lines = ['red', 'blue'];
assert.equal(C.Model.accessTime(interchange, 0, lines), 6);
assert.equal(C.Model.accessTime(interchange, 1, lines), 18);
assert.equal(C.Model.accessTime({ w: 4 }, 1, lines), 4, 'Walk-only facilities retain their access time');
assert.equal(C.CFG.bike.transferMin, 5); assert.equal(C.CFG.bike.speedRatio, 3); assert.equal(C.CFG.TRAFFIC_MODEL, 7);
console.log('PASS line-specific interchange access, walk-only facilities and unchanged bicycle speed/penalty');
