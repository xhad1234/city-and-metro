import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = { console, performance, atob, btoa, TextEncoder, TextDecoder, matchMedia: () => ({ matches: false }) };
context.window = context;
vm.createContext(context);
const html = await readFile(new URL('index.html', root), 'utf8');
for (const [,file] of html.matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
  if (file === 'js/game.js') break;
}

const { CM } = context;
CM.useMap('sh');
const { City, CFG, LU, Model, U } = CM;
const rules = CFG.growth.stationPopulation;
assert.equal(CFG.growth.metroBoostMax, 0.02);
assert.equal(rules.targetShare, 0.15);
assert.equal(rules.fieldMax, 3);
assert.equal(rules.railWeight, 1);
assert.equal(rules.walkWeight, 0.3);

const compiled = {
  stations: [{}, {}, {}],
  stationLines: Array.from({ length: 3 }, () => new Set(['line'])),
  lines: [{ id: 'line' }],
  routes: [{ lineId: 'line', stIds: ['A', 'B', 'C'], stIdx: [0, 1, 2], legSec: [120, 120], legLenM: [1500, 1500], loop: false }],
};
const metro = Object.create(Model.prototype);
const net = metro.buildMetro(compiled, { transfers: [] });
const freq = new Float32Array([6, 6]);
const times = metro.developmentTravelTimes(net, freq, rules.reachMinutes);
const ride = 2 + CFG.metro.dwell / 60;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, actual + ' ≠ ' + expected);
near(times[1], 5 + ride);
near(times[2], 5 + 2 * ride); // One wait for two consecutive legs.
near(times[6], times[2]);
assert.strictEqual(metro.developmentTravelTimes(metro.buildMetro(compiled, { transfers: [] }), freq, 45), times);
const slower = metro.developmentTravelTimes(net, new Float32Array([3, 3]), 45);
assert.notStrictEqual(slower, times);
near(slower[2], times[2] + 5);
assert.equal(metro.developmentTravelTimes(net, freq, 7)[2], 0);
assert.ok(metro.developmentTravelTimes(net, new Float32Array(2), 45).every(t => t === 0));

CM.Eras.enabled = () => false;
U.hash2 = () => 0.5;
const year = 2030;
function parcelCity(residents, open = [1]) {
  const city = Object.create(City.prototype), N = residents.length;
  Object.assign(city, {
    N, W: N, H: 1, pop: Float64Array.from(residents), jobs: new Float64Array(N),
    lu: new Uint8Array(N).fill(LU.RES), plan: new Uint8Array(N), region: new Uint8Array(N),
    regions: open.map(() => ({ plan: 'res' })), regionOpen: open, landFrac: new Float64Array(N).fill(1000 / (3000 * 1.15)),
    taken: new Float64Array(N), street: new Uint8Array(N).fill(1), nearArt: new Uint8Array(N),
    bh: new Uint8Array(N), seed: 1, version: 0, applyPopulationDistribution: () => false, heightFor: () => 0,
  });
  return city;
}
const ctx = { year, monthIndex: U.ymIndex(year, 1), coverage: 0 };
const setTarget = pop => { CFG.growth.popCurve = [[year, pop], [year + 2, pop]]; };

const vacancy = parcelCity([200, 800]);
setTarget(2000);
const growth = vacancy.growMonth(ctx);
near(growth.dPop, 40);
near(vacancy.pop[0] - 200, 40 * 1040 / 1180);
near(vacancy.pop[1] - 800, 40 * 140 / 1180);

const cap = parcelCity([990, 1050]);
setTarget(100000);
cap.growMonth(ctx);
near(cap.pop[0], 1000);
near(cap.pop[1], 1050); // A pre-existing excess receives no additional residents.

const dynamic = parcelCity([200, 0, 0], [1, 0]);
dynamic.region[2] = 1;
setTarget(200);
const pull = { field: new Float32Array([2, 3, 3]), jobField: new Float32Array(3), M: 1, w: 1 };
const withBonus = dynamic.growMonth({ ...ctx, pull });
near(withBonus.dPop, 0.04 * 0.15 * 1000 * 0.35 * 5); // Closed land contributes zero.
const current = dynamic.totals().pop;
pull.field.fill(1);
const next = dynamic.growMonth({ ...ctx, monthIndex: ctx.monthIndex + 1, pull });
near(next.dPop, 0.04 * (200 + 0.15 * 1000 * 0.35 * 2 - current));
assert.equal(dynamic.pop[2], 0);

CM.useMap('gz');
assert.equal(CFG.growth.stationPopulation, undefined);
console.log('PASS Shanghai population allocation, live target recalculation, parcel caps and station travel cache');
