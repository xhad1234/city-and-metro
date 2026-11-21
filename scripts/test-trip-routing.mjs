// Compare displayed itineraries with the passenger assignment's actual shortest-path trees.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
const C = context.CM, W = 48, VW = W + 1, V = 2 * VW, start = new Int32Array(V + 1), deg = new Int32Array(V);
const vx = Float32Array.from({ length: V }, (_, v) => v % VW), vy = Float32Array.from({ length: V }, (_, v) => Math.floor(v / VW));
const to = [], len = [];
for (let v = 0; v < V; v++) {
  if (v < VW) { if (v) { to.push(v - 1); len.push(250); } if (v < W) { to.push(v + 1); len.push(250); } }
  deg[v] = to.length - start[v]; start[v + 1] = to.length;
}
const city = { W, H: 1, N: W, VW, V, vx, vy, walk: { start, deg, to, len },
  pop: new Float32Array(W).fill(1), jobs: new Float32Array(W),
  cellAt: x => x >= 0 && x < W ? Math.floor(x) : -1, zoneOf: c => c, waterDistAt: () => 1 };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-4, msg + ': ' + a + ' vs ' + b);
function fixture(xs, specs, keepTransfers = false) {
  const model = Object.create(C.Model.prototype);
  Object.assign(model, { city, Z: W, year: 2025, syncSolve: true, heap: new C.U.Heap(64),
    zoneCells: Array.from({ length: W }, (_, i) => [i]) });
  const stations = xs.map((x, i) => ({ id: 's' + i, name: 'Station ' + i, x, y: 0, type: 'underground', size: 'M' }));
  const routes = specs.map((spec, id) => {
    const lineId = spec.line ?? 'l' + id, stIdx = spec.stops;
    return { id, lineId, label: lineId, line: { id: lineId }, baseKey: 'fixture', svc: spec.svc,
      loop: !!spec.loop, stIdx, stIds: stIdx.map(i => stations[i].id), lvPen: stIdx.map(() => 0),
      legSec: spec.minutes.map(m => m * 60 - C.CFG.metro.dwell),
      legLenM: spec.minutes.map(() => 1000), pts: stIdx.map(i => [stations[i].x, 0]),
      hs: stIdx.map(() => 0), stopPt: stIdx.map((_, k) => k) };
  });
  const compiled = { stations, routes, sIndex: new Map(stations.map((s, i) => [s.id, i])),
    lines: [...new Map(routes.map(r => [r.lineId, r.line])).values()],
    stationRoutes: stations.map((_, i) => routes.filter(r => r.stIdx.includes(i)).map(r => r.id)),
    stationLines: stations.map((_, i) => new Set(routes.filter(r => r.stIdx.includes(i)).map(r => r.lineId))) };
  compiled.serviced = compiled.stationRoutes.map(r => r.length > 0);
  const access = model.computeAccess(compiled);
  if (!keepTransfers) access.transfers = [];
  model.net = model.buildMetro(compiled, access);
  model.ctxs = { wd: { per: C.CFG.periods.map(() => ({ freq: new Float32Array(routes.length).fill(12),
    freqDir: new Float32Array(2 * routes.length).fill(12), crowd: new Float32Array(model.net.nE).fill(1),
    stDelay: new Float32Array(stations.length) })) } };
  model.selected = i => ({ ...stations[i], station: stations[i].id });
  return model;
}
function compare(model, from, to) {
  const before = JSON.stringify(model.ctxs.wd.per), result = model.tripTime(from, to), net = model.net;
  assert.equal(result.status, 'ready');
  assert.equal(JSON.stringify(model.ctxs.wd.per), before, 'A query cannot change live passenger state');
  const origins = model.tripAccess(from), destinations = model.tripAccess(to);
  model.ctxs.wd.per.forEach((period, p) => {
    const store = model.allocSkimStore(net, {});
    for (const _ of model.metroSkim(net, period, p, model.params(), store)) {}
    let best = 1e30, a, b;
    for (const origin of origins) for (const destination of destinations) {
      if (origin.s === destination.s) continue;
      const cost = origin.cost + destination.cost + store.gt[origin.s * net.N + destination.s];
      if (cost < best) { best = cost; a = origin; b = destination; }
    }
    const trip = result.periods[p];
    if (best >= 1e30) { assert.equal(trip, null); return; }
    close(trip.cost, best, 'The chosen station pair has the same passenger cost');
    close(trip.total, a.minutes + b.minutes + store.tm[a.s * net.N + b.s], 'Displayed time excludes generalized penalties');
    const expected = [];
    for (let n = net.exits[b.s]; n !== a.s;) {
      const edge = store.pred[a.s * net.nNodes + n];
      if (net.eType[edge] === 2) expected.push(edge);
      n = net.eFrom[edge];
    }
    expected.reverse();
    const actual = Array.from(trip.sections).filter(s => s.kind === 'ride').flatMap(s => Array.from({ length: s.stops }, (_, k) => {
      const n = net.C.routes[s.r].legSec.length, leg = (s.first + (s.dir ? -k : k) + n) % n;
      return net.rideEdge[s.r][2 * leg + s.dir];
    }));
    assert.deepEqual(actual, expected, 'Ride the exact edges used by passenger assignment');
    close(trip.total, trip.sections.reduce((sum, s) => sum + s.minutes, 0), 'Section times add up');
    close(trip.metres, trip.sections.reduce((sum, s) => sum + s.metres, 0), 'Section distances add up');
  });
  return result.periods[0];
}
const direct = fixture([0, 24], [{ stops: [0, 1], minutes: [10] }]);
const short = compare(direct, { x: 1.24, y: 0 }, direct.selected(1));
assert.equal(short.sections[0].mode, 'walk'); close(short.sections[0].minutes, 310 / 75, 'A short approach stays on foot');
const long = compare(direct, { x: 2.4, y: 0 }, direct.selected(1));
assert.equal(long.sections[0].mode, 'bike'); close(long.sections[0].minutes, 600 / 225 + 2, 'Cycling includes preparation');

const interchange = fixture([0, 12, 24], [
  { stops: [0, 2], minutes: [12] }, { stops: [0, 1], minutes: [3.5] }, { stops: [1, 2], minutes: [3.5] },
]);
const fewerTransfers = compare(interchange, interchange.selected(0), interchange.selected(2));
assert.deepEqual(Array.from(fewerTransfers.sections).filter(s => s.kind === 'ride').map(s => s.r), [0], 'A faster itinerary can lose on transfer cost');
for (const period of interchange.ctxs.wd.per) for (const edge of interchange.net.rideEdge[0]) period.crowd[edge] = 3.5;
const lessCrowded = compare(interchange, interchange.selected(0), interchange.selected(2));
assert.deepEqual(Array.from(lessCrowded.sections).filter(s => s.kind === 'ride').map(s => s.r), [1, 2]);
for (const period of interchange.ctxs.wd.per) period.stDelay[1] = 30;
assert.deepEqual(Array.from(compare(interchange, interchange.selected(0), interchange.selected(2)).sections).filter(s => s.kind === 'ride').map(s => s.r), [0]);

const pair = fixture([2.4, 1.24, 24], [{ stops: [0, 2], minutes: [5] }, { stops: [1, 2], minutes: [7] }]);
const chosenPair = compare(pair, { x: 0, y: 0 }, pair.selected(2));
assert.equal(chosenPair.sections[0].s, 1, 'Cycling penalties also affect the boarding station');
assert.equal(chosenPair.sections[0].mode, 'walk');

const shared = fixture([0, 24], [{ stops: [0, 1], minutes: [10], line: 'same' }, { stops: [0, 1], minutes: [10], line: 'same', svc: 'short' }]);
close(compare(shared, shared.selected(0), shared.selected(1)).sections.find(s => s.kind === 'wait').minutes, 1.25, 'Shared services combine their frequency');
const ring = fixture([0, 12, 24], [{ stops: [0, 1, 2], minutes: [3, 4, 5], loop: true }]);
for (const period of ring.ctxs.wd.per) { period.freq[0] = 6; period.freqDir[0] = 0; }
const reverseRing = compare(ring, ring.selected(0), ring.selected(1));
assert.equal(reverseRing.sections.find(s => s.kind === 'ride').dir, 1);
close(reverseRing.sections.find(s => s.kind === 'wait').minutes, 2.5, 'One-direction ring service');
for (const period of ring.ctxs.wd.per) { period.freq.fill(0); period.freqDir.fill(0); }
assert.equal(compare(ring, ring.selected(0), ring.selected(1)), null);

const outdoors = fixture([0, 0.4, 24, 24.4, 12, 36], [
  { stops: [0, 4], minutes: [100] }, { stops: [1, 2], minutes: [7] }, { stops: [3, 5], minutes: [100] },
], true);
const outsideTrip = compare(outdoors, outdoors.selected(0), outdoors.selected(3));
assert.equal(outsideTrip.sections.filter(s => s.kind === 'ride').length, 1);
assert.ok(outsideTrip.sections[0].metres >= 100 && outsideTrip.sections.at(-1).metres >= 100);
assert.ok(outsideTrip.sections[0].paths.length && outsideTrip.sections.at(-1).paths.length, 'Draw walking before first boarding and after final alighting');
console.log('PASS passenger-identical access, station pairs, exact ride edges, crowding, delays, transfer penalties, shared service, ring shutdown and physical time totals');
