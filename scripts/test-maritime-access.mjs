// A campus marker must lie on dry, connected ground; queries keep the normal access limits.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url), context = { console, performance, atob, btoa, TextEncoder, TextDecoder,
  setTimeout, clearTimeout, navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
context.window = context; vm.createContext(context);
for (const [, file] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
  if (file === 'js/save.js') break;
}
const C = context.CM; C.useMap('sh');
const text = process.env.CM_MARITIME_SAVE ? await readFile(process.env.CM_MARITIME_SAVE, 'utf8') : null;
const payload = text ? C.Save.parseEnvelope(text).payload : null, year = payload ? payload.clock.y + (payload.clock.m - 1) / 12 : 2025;
const city = new C.City();
if (payload) { city.generate(payload.meta.seed, C.CFG.START.y, { deferGraphs: true }); city.restore(payload.city, year); }
else city.generate(19900101, year);
const project = (lat, lon) => [(lon - C.GEOS.sh.proj.lon0) * C.GEOS.sh.proj.kx, (C.GEOS.sh.proj.lat0 - lat) * C.GEOS.sh.proj.ky];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, a + ' vs ' + b);
const model = new C.Model(city, { deferDemand: true }); model.setYear(year); model.buildZones();
const f = C.Fac.byId('sh_maritime_lingang'), oldPoint = project(30.87698, 121.90022), gate = project(30.8781863, 121.9065117);
assert.ok(city.waterDistAt(...oldPoint) < 0, 'The former marker is inside the campus lake');
assert.ok(city.waterDistAt(f.x, f.y) > 0.05, 'The corrected marker is on dry ground');
assert.equal(JSON.stringify([f.x, f.y]), JSON.stringify(f.entrance));
close(f.x, gate[0]); close(f.y, gate[1]);
assert.ok(C.Fac.allowsBikeAccess(f));
const near = project(30.8786493, 121.9070598), bike = [422, 449], remote = [425.6064, 432.96];
for (const p of [near, bike]) assert.equal(C.Metro.checkSite(city, ...p, 'underground').ok, true);
assert.equal(city.walkCanReach(f.entrance, [near], C.CFG.walk.maxAccessM), true, 'The existing road serves gate 3');
const stations = [near, bike, remote].map(([x, y], i) => ({ id: 'test' + i, name: 'Test station ' + i, x, y, type: 'underground', size: 'M' }));
const routes = [[0, 2], [1, 2]].map((stIdx, id) => ({ id, lineId: 'line' + id, line: { id: 'line' + id }, label: 'Test line ' + id,
  baseKey: 'test', loop: false, stIdx, stIds: stIdx.map(i => stations[i].id), lvPen: [0, 0],
  legSec: [600], legLenM: [C.U.dist(stations[stIdx[0]].x, stations[stIdx[0]].y, remote[0], remote[1]) * 250],
  pts: stIdx.map(i => [stations[i].x, stations[i].y]), hs: [0, 0], stopPt: [0, 1] }));
const compiled = { stations, routes, lines: routes.map(r => r.line), sIndex: new Map(stations.map((s, i) => [s.id, i])), serviced: [true, true, true],
  stationRoutes: [[0], [1], [0, 1]], stationLines: [new Set(['line0']), new Set(['line1']), new Set(['line0', 'line1'])] };
const access = model.computeAccess(compiled), k = model.facIndex(f.id), entries = access.zl[model.Z + k];
assert.equal(access.zCov[model.Z + k], 1);
assert.equal(entries.find(e => e.s === 0).bikeShare, 0);
assert.equal(entries.find(e => e.s === 1).bikeShare, 1);
model.net = model.buildMetro(compiled, access);
const period = { freq: new Float32Array([12, 0]), freqDir: new Float32Array([12, 12, 0, 0]),
  crowd: new Float32Array(model.net.nE).fill(1), stDelay: new Float32Array(3) };
model.ctxs = { wd: { per: C.CFG.periods.map(() => period) } };
const target = { x: f.x, y: f.y }, selected = i => ({ ...stations[i], station: stations[i].id });
const walkTrip = model.tripTime(target, selected(2));
assert.equal(walkTrip.status, 'ready'); assert.ok(walkTrip.periods[0]);
assert.equal(walkTrip.periods[0].sections[0].mode, 'walk');
assert.equal(model.tripAccess({ x: oldPoint[0], y: oldPoint[1] }).length, 0);
period.freq.set([0, 12]); period.freqDir.set([0, 0, 12, 12]);
const bikeTrip = model.tripTime(target, selected(2));
assert.equal(bikeTrip.periods[0].sections[0].mode, 'bike');
close(entries.find(e => e.s === 1).w - bikeTrip.periods[0].sections[0].minutes, model.fn.inner[k] / C.CFG.walk.mPerMin);
const connection = C.DATA.histTasks.find(t => t.id === 'sh-newcity-lingang');
const anchor = connection.anchors.find(a => a.facilityEntrance === f.id);
assert.equal(JSON.stringify([anchor.x, anchor.y]), JSON.stringify(f.entrance));
const oldTask = { ...connection, progress: { ok: false }, evaluatedYM: 24299,
  anchors: connection.anchors.map(a => a === anchor ? { ...a, x: oldPoint[0], y: oldPoint[1], facilityEntrance: undefined } : a) };
const restored = C.Tasks.restore({ active: [oldTask] }, payload?.clock, { city }).active[0];
const restoredGate = restored.anchors.find(a => a.facilityEntrance === f.id);
assert.equal(JSON.stringify([restoredGate.x, restoredGate.y]), JSON.stringify(f.entrance));
assert.equal(restoredGate.r, 4); assert.equal(restored.progress, undefined);
assert.equal(C.CFG.walk.mPerMin * C.CFG.bike.speedRatio * C.CFG.bike.maxRideMin, 3375);
const report = { formerPoint: oldPoint, gate: f.entrance, oldPointWater: city.waterDistAt(...oldPoint), gateWater: city.waterDistAt(f.x, f.y),
  fixtureOnly: true, walkMinutes: walkTrip.periods[0].sections[0].minutes, bikeMinutes: bikeTrip.periods[0].sections[0].minutes };
if (payload) {
  const full = C.Metro.compile(payload.net, city), fullAccess = model.computeAccess(full);
  model.net = { C: full, N: full.stations.length, acc: fullAccess };
  const nearest = full.stations.filter((s, i) => full.serviced[i]).map(s => ({ name: s.name, metres: C.U.dist(f.x, f.y, s.x, s.y) * 250 }))
    .sort((a, b) => a.metres - b.metres)[0];
  report.saveNearest = nearest; report.savePointCandidates = model.tripAccess(target).length;
  if (nearest.metres > 3375) assert.equal(report.savePointCandidates, 0, 'A distant existing station cannot bypass the unchanged access cap');
  assert.equal(await readFile(process.env.CM_MARITIME_SAVE, 'utf8'), text, 'The player save is read-only');
}
if (process.env.CM_MARITIME_REPORT) await writeFile(process.env.CM_MARITIME_REPORT, JSON.stringify(report, null, 2));
console.log('PASS maritime lake-marker regression, real gate/road, walking and cycling trips, task anchors and unchanged distance limits');
console.log(JSON.stringify(report));
