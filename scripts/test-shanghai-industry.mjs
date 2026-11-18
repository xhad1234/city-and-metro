import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url), c = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
c.window = c; vm.createContext(c);
for (const [, f] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(f, root), 'utf8'), c, { filename: f }); if (f === 'js/save.js') break;
}
const C = c.CM, M = C.Metro;
C.useMap('sh');
const parks = C.Fac.list().filter(f => f.t === 'industry');
assert.equal(parks.length, 30);
assert.equal(new Set(parks.map(f => f.id)).size, parks.length);
for (const id of ['sh_minhang_dev', 'sh_xinzhuang_ind', 'sh_pujiang_tech', 'sh_jinqiao_north', 'sh_jinqiao_south', 'sh_waigaoqiao', 'sh_songjiang_ind_east', 'sh_songjiang_ind_west', 'sh_anting_auto', 'sh_chemical_ind', 'sh_changxing_marine']) assert.ok(parks.some(f => f.id === id));
for (const f of parks) { assert.ok(f.polygons.length); assert.equal(f.p.hw, 1); assert.equal(f.noModel, true); }
const city = new C.City(); city.generate(19900101, 2021);
const pop = city.pop.slice(), jobs = city.jobs.slice(), sh = new C.Model(city, { deferDemand: true });
sh.setYear(2021); sh.buildZones();
const fn = sh.fn;
assert.equal(fn.list.filter(f => f.t === 'industry').length, 30);
let total = 0;
for (let k = 0; k < fn.F; k++) if (fn.list[k].t === 'industry') {
  assert.ok(fn.cells[k].length > 0, fn.list[k].name);
  assert.ok(fn.industryJobs[k] > 0, fn.list[k].name);
  let sum = 0;
  for (const cell of fn.cells[k]) { assert.equal(fn.industryOwner[cell], k); sum += city.jobs[cell]; }
  assert.ok(Math.abs(sum - fn.industryJobs[k]) < 1e-6); total += sum;
}
for (const entries of fn.zoneIndustry) if (entries) assert.ok(entries.reduce((s, e) => s + e.share, 0) <= 1 + 1e-12, 'Overlapping park jobs must only be attributed once');
assert.deepEqual(city.pop, pop); assert.deepEqual(city.jobs, jobs);
assert.ok(total <= jobs.reduce((a, b) => a + b, 0));
console.log('PASS all 30 Shanghai areas, unique job ownership, positive employment and unchanged population/jobs');

// A real small city: adding an employment aggregation cannot change OD demand,
// mode choice, fares or station ridership. It only attributes existing commute flows.
C.useMap('tutorial');
const g = C.Game.create({ mode: 'free', tutorial: true, seed: 20000101 });
let network;
for (let y = 5; y < g.city.H - 5 && !network; y++) for (let x = 5; x < g.city.W - 22 && !network; x++) {
  if ([0, 4, 8, 12, 16].some(dx => !M.checkSite(g.city, x + dx, y, 'underground').ok)) continue;
  const net = M.empty(), line = M.newLine(net), ids = [0, 4, 8, 12, 16].map(dx => M.addStation(net, x + dx, y, {}, g.city));
  for (let k = 1; k < ids.length; k++) M.addSegment(net, line, ids[k - 1], ids[k], [], 'underground');
  network = M.compile(net, g.city);
}
assert.ok(network);
const base = new C.Model(g.city); base.syncSolve = true; base.setNetwork(network); base.solveNow(2);
let best = -1; for (let i = 0; i < g.city.N; i++) if (best < 0 || g.city.jobs[i] > g.city.jobs[best]) best = i;
const at = [best % g.city.W + 0.5, Math.floor(best / g.city.W) + 0.5];
const f = { id: 'test_industry', n: '守恒工业园', t: 'industry', at, fixedSite: true, noModel: true,
  polygons: [[[0, 0], [g.city.W, 0], [g.city.W, g.city.H], [0, g.city.H]]] };
C.DATA.facilities = C.DATA.facilities.concat([f]);
const aggregate = new C.Model(g.city); aggregate.syncSolve = true; aggregate.setNetwork(network); aggregate.solveNow(2);
for (let p = 0; p < 6; p++) assert.equal(aggregate.od.tot[p], base.od.tot[p]);
for (const key of ['trips', 'metro', 'fare', 'commTrips', 'mHW', 'tHW']) assert.equal(aggregate.daily[key], base.daily[key], key);
assert.deepEqual(aggregate.stDaily.inn, base.stDaily.inn); assert.deepEqual(aggregate.stDaily.out, base.stDaily.out);
const stat = aggregate.facStats(f.id, 'wd');
assert.ok(stat.inn > 0 && stat.out > 0); assert.ok(stat.innM >= 0 && stat.innM <= stat.inn);
assert.ok(Math.abs(stat.purp.hw - stat.inn) < 0.1);
for (const key of ['sc', 'sh', 'md', 'lz', 'hb']) assert.equal(stat.purp[key], 0);
console.log('PASS actual commute attribution and exact conservation of OD, trips, metro ridership and fares');
