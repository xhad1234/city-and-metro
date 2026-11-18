import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = {
  console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }),
};
context.window = context;
vm.createContext(context);
const html = await readFile(new URL('index.html', root), 'utf8');
for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
  if (file === 'js/save.js') break;
}
const CM = context.CM;
CM.useMap('sh');
const { City, CFG, DATA, Eras, Fac, Traits } = CM;
const sh = CM.MAPS.sh;
assert.deepEqual(Array.from(Traits.validate(sh)), []);
assert.equal(new Set(sh.geo.admin.filter(a => a[0] === 6).map(a => sh.geo.names[a[1]]).filter(n => /区$/.test(n))).size, 16);
assert.equal(CFG.growth.histEnd, 2026);
assert.equal(Eras.current(2021).name, '后疫情时代');
assert.equal(Eras.current(2027).name, '喜迎奥运');
assert.equal(Eras.current(2040.92).name, '喜迎奥运');
assert.equal(Eras.current(2041).name, '模拟未来');
assert.ok(Eras.demand(2022 + 3 / 12).rate[0] < Eras.demand(2022 + 5 / 12).rate[0]);
assert.ok(Eras.demand(2040 + 7 / 12).hub > Eras.demand(2040 + 8 / 12).hub);
assert.ok(Eras.finance(2031).grant > 1);
assert.equal(Eras.finance(2042).grant, 1);

const city = new City();
const started = performance.now();
city.generate(19900101, 2020);
console.log('Shanghai terrain and road graph generated in', Math.round(performance.now() - started), 'ms');
const { lon0, lat0, kx, ky } = sh.geo.proj;
const point = (lat, lon) => [(lon - lon0) * kx, (lat0 - lat) * ky];
const mask = y => city.lockMaskFor(Uint8Array.from(city.regions, r => r.open != null && r.open <= y ? 1 : 0));
const beforeNear = mask(2014), afterNear = mask(2015), beforeFar = mask(2019), afterFar = mask(2020);
const check = (name, lat, lon, id, before, after) => {
  const p = point(lat, lon), c = city.cellAt(...p);
  assert.ok(c >= 0 && city.landFrac[c] >= 0.5, name + ' must be on land');
  assert.equal(city.regionAt(...p).id, id, name + ' region');
  assert.equal(before[c], 1, name + ' must be locked before opening');
  assert.equal(after[c], 0, name + ' must allow building after opening');
};
check('吴泾', 31.04055, 121.45085, 'wujing', beforeNear, afterNear);
check('嘉定新城', 31.3637, 121.2549, 'jiading_new', beforeNear, afterNear);
check('浦东机场', 31.1519, 121.8015, 'pvg', beforeNear, afterNear);
check('松江', 31.0073, 121.2304, 'songjiang', beforeFar, afterFar);
check('青浦', 31.1514, 121.1159, 'qingpu', beforeFar, afterFar);
check('奉贤', 30.9247, 121.4712, 'fengxian', beforeFar, afterFar);
check('金山', 30.7224, 121.3332, 'jinshan', beforeFar, afterFar);
check('临港', 30.9165, 121.9060, 'lingang', beforeFar, afterFar);
check('崇明岛', 31.6234, 121.3960, 'chongming', beforeFar, afterFar);
check('长兴岛', 31.3931, 121.7179, 'changxing', beforeFar, afterFar);
check('横沙岛', 31.3423, 121.8441, 'hengsha', beforeFar, afterFar);
check('昆山花桥', 31.301946, 121.100839, 'huaqiao', beforeFar, afterFar);
const outsideHuaqiao = city.cellAt(...point(31.30, 121.025));
assert.equal(afterFar[outsideHuaqiao], 1, 'Kunshan outside Huaqiao stays outside the buildable map');
assert.equal(city.pop[outsideHuaqiao], 0);
const out = city.cellAt(...point(31.51, 121.25));
assert.equal(afterFar[out], 1, 'Jiangsu remains outside the buildable area');
assert.equal(city.pop[out], 0, 'Land outside Shanghai contributes no city population');
assert.ok(city.waterDistAt(...point(31.44, 121.74)) < 0, 'Yangtze channels remain water');

const listed = Fac.list(city);
const facility = id => listed.find(f => f.id === id);
assert.equal(listed.some(f => f.t === 'uni' && f.name.includes('大学城')), false);
assert.equal(facility('sh_qibao_center').t, 'shop');
assert.equal(listed.filter(f => f.t === 'uni' && /松江/.test(f.name)).length, 6);
assert.equal(listed.some(f => f.gen), false, 'Shanghai uses named sites throughout the municipality');
const named = DATA.facilities.filter(f => f.fixedSite);
for (const s of named) {
  const f = facility(s.id), c = city.cellAt(f.x, f.y);
  if (s.ext) {
    const p = Fac.portal(f);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x < city.W && p.y < city.H, s.id + ' interface within grid');
    assert.equal(p.ex, s.extEdge[0]); assert.equal(p.ey, s.extEdge[1]);
    assert.equal(f.ext.gate, false, 'Regional railway interfaces are not border-control gates');
    assert.ok(Fac.extNear(f, { x: p.x, y: p.y }) >= 0);
    assert.equal(Fac.extLink(f, { compiled: { stations: [], serviced: [] } }), null);
    const st = { id: 'interface-test', x: p.x, y: p.y, portal: f.id };
    assert.ok(Fac.extLink(f, { compiled: { stations: [st], serviced: [1], stationLines: [new Set(['line'])] } }).portal);
    continue;
  }
  assert.ok(c >= 0 && city.landFrac[c] >= 0.5 && !afterFar[c], s.id + ' must be inside real, buildable Shanghai land');
  assert.ok(s.note, s.id + ' must explain the location');
}
for (const [id, t, region] of [
  ['jiading_baolong', 'shop', 'jiading_new'], ['songjiang_inc', 'shop', 'songjiang'],
  ['qingpu_wanda', 'shop', 'qingpu'], ['nanqiao_bailian', 'shop', 'fengxian'],
  ['lingang_gangcheng', 'shop', 'lingang'], ['songjiang_uni', 'uni', 'songjiang'],
  ['zhangjiang_uni', 'uni', 'jinqiao'], ['minhang_uni', 'uni', 'minhang_new'],
  ['zizhu', 'industry', 'minhang_new'], ['sheshan', 'scenic', 'songjiang'],
  ['chedun_film', 'scenic', 'songjiang'],
  ['chongming_air', 'air', 'chongming'],
]) {
  const f = facility('sh_' + id);
  assert.equal(f.t, t);
  const actual = city.regionAt(f.x, f.y).id;
  assert.ok(actual === region || (region === 'minhang_new' && actual === 'wujing'), id + ': ' + actual);
}
const filmPark = facility('sh_chedun_film');
const filmPoint = point(31.01204455, 121.30837442);
assert.ok(Math.hypot(filmPark.x - filmPoint[0], filmPark.y - filmPoint[1]) < 0.02, 'Film park uses WGS-84 without double coordinate conversion');
assert.equal(filmPark.open, 1999);
assert.equal(Fac.active(filmPark, 1998.99, city), false);
const filmRegion = city.region[city.cellAt(filmPark.x, filmPark.y)];
assert.equal(city.regions[filmRegion].open, 2020, 'Film park follows the Songjiang district unlock');
const filmRegionOpen = city.regionOpen[filmRegion]; city.regionOpen[filmRegion] = 0;
assert.equal(Fac.active(filmPark, 2021, city), false); city.regionOpen[filmRegion] = filmRegionOpen;
assert.equal(Fac.active(filmPark, 2020, city), true);
assert.ok(Fac.share(filmPark, 2021) > 0); assert.equal(filmPark.p.lz, 1); assert.ok(filmPark.we > 1);
assert.ok(Fac.siteCells(filmPark, city).length > 0);
for (const id of ['sh_pvg_terminal', 'sh_songjiang_station', 'sh_east_station', 'sh_baoshan_station',
  'sh_oly_stadium', 'sh_oly_aquatics', 'sh_oly_arena', 'sh_oly_village']) {
  const f = facility(id), c = city.cellAt(f.x, f.y);
  assert.ok(c >= 0 && city.landFrac[c] >= 0.5 && !afterFar[c], id + ' must be on buildable Shanghai land');
  if (id.startsWith('sh_oly_')) assert.ok(city.regionAt(f.x, f.y).id.startsWith('wujing'), id + ' must be in Wujing');
}
assert.equal(facility('sh_pvgair').close, 2015);
assert.equal(facility('sh_pvg_terminal').open, 2015);
assert.equal(facility('sh_east_station').open, 2027.5);
assert.ok(!Fac.active(facility('sh_chongming_air'), 2034.99, city));
assert.ok(Fac.active(facility('sh_chongming_air'), 2035, city));
assert.equal(Fac.pax(facility('sh_chongming_air'), 2035), 170_000);
assert.equal(Fac.pax(facility('sh_chongming_air'), 2040), Fac.pax(facility('sh_hqair'), 2040));
assert.equal(Fac.pax(facility('sh_pvg_terminal'), 2025), 200_000);
assert.equal(Fac.pax(facility('sh_hqair'), 2025), 133_000);
assert.equal(Fac.pax(facility('sh_hqstation'), 2024), 400_000);
assert.ok(Fac.pax(facility('sh_hqstation'), 2026) > Fac.pax(facility('sh_station'), 2026));
assert.ok(Fac.pax(facility('sh_west'), 2026) < Fac.pax(facility('sh_south'), 2026) / 5);
assert.ok(Fac.pax(facility('sh_pvg_terminal'), 2022) < Fac.pax(facility('sh_pvg_terminal'), 2023));
for (const rw of DATA.runways.filter(r => r.from === 2035)) for (let t = 0; t <= 1; t += 0.125) {
  const [x, y] = rw.a.map((v, i) => v + (rw.b[i] - v) * t);
  assert.ok(city.landFrac[city.cellAt(x, y)] >= 0.5 && city.regionAt(x, y).id === 'chongming');
}
assert.equal(DATA.runways.filter(r => r.from === 2035).length, 2);
assert.ok(DATA.events.some(e => e.y === 2035 && e.tag === '模拟' && e.title === '崇明国际机场启用'));
assert.ok(Fac.share(facility('sh_oly_stadium'), 2040 + 7 / 12) > Fac.share(facility('sh_oly_stadium'), 2039) * 5);
assert.equal(CM.U.interp(CFG.growth.popCurve, 2040), 35_000_000);
console.log('PASS Shanghai administrative coverage, release dates, Olympic state and hub dates');

const modern = DATA.histTasks.filter(t => t.appear[0] >= 2021);
assert.equal(new Set(DATA.histTasks.map(t => t.id)).size, DATA.histTasks.length);
assert.ok(modern.some(t => t.appear[0] === 2021));
assert.ok(modern.some(t => t.deadline[0] === 2045));
for (const task of modern) {
  assert.ok(CM.U.ymIndex(...task.appear) < CM.U.ymIndex(...task.deadline), task.title);
  if (task.fac) assert.ok(facility(task.fac).open <= task.appear[0] + (task.appear[1] - 1) / 12);
  for (const a of task.anchors || []) {
    const c = city.cellAt(a.x, a.y);
    assert.ok(c >= 0 && city.landFrac[c] >= 0.5 && !afterFar[c], task.id + ' / ' + a.name);
  }
}
console.log('PASS 2021–2045 task dates, facility timing and map anchors');
const development = DATA.events.find(e => e.title === '开发崇明：生态岛交通建设');
assert.equal(development.y, 2025); assert.equal(development.m, 1);
assert.equal(DATA.histTasks.filter(t => t.id.startsWith('sh-chongming-') && t.appear[0] === 2025).length, 2);
for (const id of ['chongming', 'changxing', 'huaqiao']) {
  const k = city.regions.findIndex(r => r.id === id);
  assert.equal(Eras.regionFactors(city, 2024).pop[k], 1);
  assert.equal(Eras.regionFactors(city, 2025).pop[k], 1.25);
  assert.ok(Math.abs(Eras.regionFactors(city, 2025).jobs[k] - 1.35) < 1e-6);
  assert.equal(Eras.regionFactors(city, 2037).pop[k], 1);
}
assert.equal(DATA.facilities.filter(f => f.extEdge && f.t === 'rail').length, 6);
console.log('PASS 2025 development effects and connectable regional railway interfaces');

// Census controls apply throughout complete towns, independently of the old
// rectangular map extent; upgrade once and preserve totals and metro land.
const census = DATA.population, grid = CM.U.unpackTyped(census.townGrid);
assert.equal(census.groups.reduce((a, r) => a + r[2], 0), 25_056_111);
assert.equal(census.groups.filter(r => r[0] !== '昆山市').reduce((a, r) => a + r[2], 0), 24_870_895);
assert.equal(new Set(census.groups.map(r => r[0])).size, 17);
assert.equal(census.groups.find(r => r[1] === '花桥镇')[2], 185_216);
const townTotals = () => {
  const sums = new Float64Array(census.groups.length);
  for (let c = 0; c < city.N; c++) if (grid[c]) sums[grid[c] - 1] += city.pop[c];
  return sums;
};
const total = city.totals(), sums = townTotals();
for (let k = 0; k < sums.length; k++) {
  const target = total.pop * census.groups[k][2] / census.total;
  assert.ok(Math.abs(sums[k] - target) < 0.05, census.groups[k][1] + ' census share');
}
assert.ok(Math.abs(total.pop - 24_870_900) < 2);
assert.equal(city.populationRevision, census.revision);
const state = city.serialize();
assert.equal(state.populationRevision, census.revision);
assert.equal(city.applyPopulationDistribution(2021), false);
assert.deepEqual(city.totals(), total);
const qibao = census.groups.findIndex(r => r[1] === '七宝镇');
const xujing = census.groups.findIndex(r => r[1] === '徐泾镇');
assert.equal(census.groups[qibao][2], 266465);
assert.equal(census.groups[xujing][2], 198376);
const urbanCell = city.cellAt(...point(31.15648, 121.34593));
const fraction = city.groundUrbanMix(urbanCell);
city.street[urbanCell] = 1 - city.street[urbanCell];
assert.equal(city.groundUrbanMix(urbanCell), fraction, 'Colour must not depend on saved street flag');
city.street[urbanCell] = 1 - city.street[urbanCell];
const oldPop = city.pop.slice(), oldJobs = city.jobs.slice(), oldTaken = city.taken.slice();
city.populationRevision = 0;
city.applyPopulationDistribution(2021);
assert.ok(Math.abs(city.totals().pop - total.pop) < 1);
assert.ok(Math.abs(city.totals().jobs - total.jobs) < 1);
assert.deepEqual(city.taken, oldTaken);
for (let c = 0; c < city.N; c++) {
  if (city.lu[c] === CM.LU.WATER || city.lu[c] === CM.LU.PARK || city.lu[c] === CM.LU.AIRPORT)
    assert.equal(city.pop[c], 0, 'No residents on water, parks or airport runways');
}
console.log('PASS town population shares, one-time save calibration and ground-colour consistency');

const stadia = DATA.landmarks.filter(l => l.id.startsWith('sh_oly_'));
city.activateLandmarks(2038);
for (const l of stadia) assert.equal(city.landmarkOn[DATA.landmarks.indexOf(l)], 1);
const width = 24;
const vertexWidth = width + 1;
const counts = new Int32Array(vertexWidth * 2);
const start = new Int32Array(counts.length + 1), vx = new Float32Array(counts.length), vy = new Float32Array(counts.length);
const to = [], len = [];
for (let v = 0; v < counts.length; v++) {
  vx[v] = v % vertexWidth;
  vy[v] = Math.floor(v / vertexWidth);
  if (v < vertexWidth) {
    if (v > 0) { to.push(v - 1); len.push(CFG.CELL_M); }
    if (v < width) { to.push(v + 1); len.push(CFG.CELL_M); }
  }
  counts[v] = to.length - start[v];
  start[v + 1] = to.length;
}
const block = { W: width, H: 1, N: width, VW: vertexWidth, V: counts.length, vx, vy,
  pop: new Float32Array(width).fill(1), jobs: new Float32Array(width),
  walk: { start, to, len, deg: counts }, cellAt: x => Math.floor(x), zoneOf: c => c };
const model = Object.create(CM.Model.prototype);
Object.assign(model, { city: block, Z: width, heap: new CM.U.Heap(64), zoneCells: Array.from({ length: width }, (_, c) => [c]) });
const compiled = { stations: [{ x: 0, y: 0 }, { x: 3, y: 0 }], serviced: [true, false] };
const access = model.computeAccess(compiled);
const m = c => c * CFG.CELL_M + CFG.walk.cellExtraM;
assert.equal(access.zl[1][0].w, m(1) / 75);
assert.equal(access.zl[1][0].bikeShare, 0);
assert.equal(access.zl[2][0].bikeShare, 0, 'Five-minute bicycle handling makes walking preferable at 560 m');
assert.equal(access.zl[2][0].w, m(2) / 75);
assert.equal(access.zl[3][0].bikeShare, 1, 'Cycling remains preferable at 810 m');
assert.equal(access.zl[4][0].w, m(4) / 225 + 5);
assert.equal(access.zl[8][0].w, m(8) / 225 + 5);
assert.equal(access.zl[8][0].bikeShare, 1);
assert.equal(access.zl[8].length, 1, 'An unserved station cannot get bicycle riders');
assert.equal(access.zCov[8], 1);
assert.equal(access.zWalkCov[8], 0);
assert.equal(access.cellWalk[8], Infinity);
assert.equal(access.zl[14], null, 'Limit bicycle trips to 15 minutes of riding');
assert.equal(access.transfers.length, 0);
assert.equal(model.computeAccess(compiled).zl[8][0].w, access.zl[8][0].w, 'Cached access tree must give the same result');
console.log('PASS bicycle access time, service eligibility, ride limit and walk-only reporting');

// Coverage counts residents and jobs, with every cell assigned to exactly one access mode.
model.net = { C: compiled, acc: access };
block.jobs = Float32Array.from({ length: width }, (_, c) => c + 10);
const coverage = model.stationCoverage(0);
assert.deepEqual(Array.from(coverage.walk.limits), [5, 10, 15]);
assert.deepEqual(Array.from(coverage.bike.limits), [5, 10, 15], 'Both modes use the same total-access-time bands');
assert.deepEqual(Array.from(coverage.walk.pop), [2, 3, 3]);
assert.deepEqual(Array.from(coverage.bike.pop), [0, 2, 6], 'The five-minute bicycle band includes the handling penalty');
assert.deepEqual(Array.from(coverage.walk.jobs), [21, 33, 33]);
assert.deepEqual(Array.from(coverage.bike.jobs), [0, 27, 93]);
assert.ok(model.stationCoverage(1).bike.pop[2] > 0, 'An unserved station can preview potential cycling coverage');
const cachedCoverage = model.stationCoverage(0);
model.net.acc = model.computeAccess(compiled);
assert.deepEqual(model.stationCoverage(0), cachedCoverage, 'Cached and freshly requested trees agree');
for (let c = 0; c < width; c++) {
  block.pop.fill(0); block.jobs.fill(0); block.pop[c] = 7; block.jobs[c] = 11;
  const r = model.stationCoverage(0), entry = access.zl[c]?.[0], reachable = !!entry && entry.w <= 15;
  assert.equal(r.walk.pop[2] + r.bike.pop[2], reachable ? 7 : 0, 'A resident must not be counted in both modes');
  assert.equal(r.walk.jobs[2] + r.bike.jobs[2], reachable ? 11 : 0, 'A job must not be counted in both modes');
  if (reachable) assert.equal((entry.bikeShare ? r.bike : r.walk).pop[2], 7, 'Coverage mode agrees with actual access choice');
}
block.pop.fill(0); block.jobs.fill(0); block.pop[2] = 7;
const oldExtra = CFG.walk.cellExtraM;
try {
  CFG.walk.cellExtraM = 62.5; // 562.5 m: walking and cycling both cost 7.5 min.
  assert.equal(model.stationCoverage(0).walk.pop[2], 7);
  assert.equal(model.stationCoverage(0).bike.pop[2], 0, 'Equal costs prefer walking');
} finally { CFG.walk.cellExtraM = oldExtra; }
assert.equal(model.stationCoverage(99), null, 'Missing road access must not fabricate coverage');
console.log('PASS exclusive walking/cycling residents and jobs, cumulative bands, live population, cached trees and tie handling');

const terminals = DATA.airportLayout.terminals;
assert.equal(terminals.find(t => t.id === 'hq_t2').from, 2010 + 2 / 12);
assert.equal(terminals.find(t => t.id === 'pvg_t3').from, 2028 + 11 / 12);
assert.equal(Fac.active(facility('sh_pvg_t3'), 2028 + 10 / 12, city), false);
assert.equal(Fac.active(facility('sh_pvg_t3'), 2028 + 11 / 12, city), true);
for (const [year, total] of [[2030, 230000], [2040, 290000]]) {
  assert.ok(Math.abs(Fac.pax(facility('sh_pvg_terminal'), year) + Fac.pax(facility('sh_pvg_t3'), year) - total) < 0.01);
}
assert.equal(DATA.runways.filter(r => r.airport === 'pvg').length, 5);
const cloud = city.roadGroups.findIndex(r => r.name === '云亮路');
const ramp = city.roadGroups.findIndex(r => r.name === '南纬八路上匝道');
assert.ok(cloud >= 0 && ramp >= 0);
city.applyRoads(2026 + 5 / 12); assert.equal(city.roadsBuilt[cloud], 0);
city.applyRoads(2026 + 6 / 12); assert.equal(city.roadsBuilt[cloud], 1);
city.applyRoads(2028 + 10 / 12); assert.equal(city.roadsBuilt[ramp], 0);
city.applyRoads(2028 + 11 / 12); assert.equal(city.roadsBuilt[ramp], 1);
console.log('PASS actual terminal models, T3 opening, airport total conservation and monthly road phases');
