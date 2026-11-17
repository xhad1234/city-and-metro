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
const out = city.cellAt(...point(31.51, 121.25));
assert.equal(afterFar[out], 1, 'Jiangsu remains outside the buildable area');
assert.equal(city.pop[out], 0, 'Land outside Shanghai contributes no city population');
assert.ok(city.waterDistAt(...point(31.44, 121.74)) < 0, 'Yangtze channels remain water');

const listed = Fac.list(city);
const facility = id => listed.find(f => f.id === id);
assert.equal(listed.some(f => f.gen), false, 'Shanghai uses named sites throughout the municipality');
const named = DATA.facilities.filter(f => f.fixedSite);
for (const s of named) {
  const f = facility(s.id), c = city.cellAt(f.x, f.y);
  assert.ok(c >= 0 && city.landFrac[c] >= 0.5 && !afterFar[c], s.id + ' must be inside real, buildable Shanghai land');
  assert.ok(s.note, s.id + ' must explain the location');
}
for (const [id, t, region] of [
  ['jiading_baolong', 'shop', 'jiading_new'], ['songjiang_inc', 'shop', 'songjiang'],
  ['qingpu_wanda', 'shop', 'qingpu'], ['nanqiao_bailian', 'shop', 'fengxian'],
  ['lingang_gangcheng', 'shop', 'lingang'], ['songjiang_uni', 'uni', 'songjiang'],
  ['zhangjiang_uni', 'uni', 'jinqiao'], ['minhang_uni', 'uni', 'minhang_new'],
  ['zizhu', 'cbd', 'minhang_new'], ['sheshan', 'scenic', 'songjiang'],
  ['chongming_air', 'air', 'chongming'],
]) {
  const f = facility('sh_' + id);
  assert.equal(f.t, t);
  const actual = city.regionAt(f.x, f.y).id;
  assert.ok(actual === region || (region === 'minhang_new' && actual === 'wujing'), id + ': ' + actual);
}
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
const stadia = DATA.landmarks.filter(l => l.id.startsWith('sh_oly_'));
city.activateLandmarks(2038);
for (const l of stadia) assert.equal(city.landmarkOn[DATA.landmarks.indexOf(l)], 1);
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

// An imported dense strip beside rural land: the discontinuity falls while
// both citywide totals, protected land and the actual river stay intact.
const { x: edgeX, y: edgeY, size, band } = DATA.extentSeam;
const row = edgeY + Math.floor(size / 2);
city.pop = new Float32Array(city.N);
city.jobs = new Float32Array(city.N);
city.street = new Uint8Array(city.N);
city.urbanYear = new Uint16Array(city.N);
city.bh = new Float32Array(city.N);
const seam = Object.create(city);
seam.crossesRiver = (x0, y0, x1, y1) => y0 < row - 2 && y1 >= row - 2;
seam.lu = new Uint8Array(city.N);
seam.plan = new Uint8Array(city.N).fill(CM.LU.RES);
seam.landFrac = new Float32Array(city.N).fill(1);
seam.isPark = new Uint8Array(city.N);
seam.region = new Uint8Array(city.N).fill(city.regions.findIndex(r => r.id === 'outer'));
seam.protectedId = new Uint8Array(city.N);
seam.taken = new Float32Array(city.N);
for (let y = row - 2; y <= row + 2; y++) for (let x = edgeX - band - 1; x < edgeX + band; x++) {
  const c = y * seam.W + x;
  seam.pop[c] = x < edgeX ? 50 : 500;
  seam.jobs[c] = x < edgeX ? 10 : 100;
}
const center = row * seam.W + edgeX, park = center + seam.W + 3, water = center + 2 * seam.W;
seam.isPark[park] = 1;
seam.pop[park] = seam.jobs[park] = 0;
seam.landFrac[water] = 0;
seam.pop[water] = seam.jobs[water] = 0;
const before = seam.totals();
seam.extentReconciled = false;
seam.reconcileExtent(2021);
assert.ok(Math.abs(seam.totals().pop - before.pop) < 0.01);
assert.ok(Math.abs(seam.totals().jobs - before.jobs) < 0.01);
assert.ok(Math.abs(seam.pop[center] - seam.pop[center - 1]) < 150);
assert.equal(seam.pop[park], 0);
assert.equal(seam.pop[water], 0);
assert.equal(seam.pop[center - band - 1], 50);
const after = seam.pop[center];
seam.reconcileExtent(2021);
assert.equal(seam.pop[center], after);
console.log('PASS saved map density transition conserves totals and respects water and parks');

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
assert.equal(access.zl[4][0].w, m(4) / 225 + 4);
assert.equal(access.zl[8][0].w, m(8) / 225 + 4);
assert.equal(access.zl[8][0].bikeShare, 1);
assert.equal(access.zl[8].length, 1, 'An unserved station cannot get bicycle riders');
assert.equal(access.zCov[8], 1);
assert.equal(access.zWalkCov[8], 0);
assert.equal(access.cellWalk[8], Infinity);
assert.equal(access.zl[14], null, 'Limit bicycle trips to 15 minutes of riding');
assert.equal(access.transfers.length, 0);
assert.equal(model.computeAccess(compiled).zl[8][0].w, access.zl[8][0].w, 'Cached access tree must give the same result');
console.log('PASS bicycle access time, service eligibility, ride limit and walk-only reporting');
