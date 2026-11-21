// Suburban connection radii, urban boundaries, operating connectivity and old tasks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url), c = { console, performance, atob, btoa, TextEncoder, TextDecoder,
  setTimeout, clearTimeout, navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
c.window = c; vm.createContext(c);
for (const [, file] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), c, { filename: file });
  if (file === 'js/save.js') break;
}
const C = c.CM; C.useMap('sh');
const Tasks = C.Tasks, tasks = new Tasks(), suburb = C.DATA.regions.find(r => r.id === 'songjiang');
const urban = C.DATA.regions.find(r => r.id === 'huangpu');
assert.equal(suburb.connectRadiusM, 1000); assert.equal(urban.connectRadiusM, undefined);
for (const region of C.DATA.regions.filter(r => r.independent)) assert.equal(region.connectRadiusM, 1000, region.name);
const game = { city: { regionAt: x => x < 10 ? suburb : urban }, model: {},
  compiled: { stations: [{ x: 4, y: 10 }, { x: 20, y: 10 }], serviced: [1, 1], routes: [{ stIdx: [0, 1] }] } };
const goal = { id: 'fixture', type: 'connect', maxTransfers: 1, deadline: [2030, 12],
  anchors: [{ name: 'Suburban site', x: 0, y: 10, r: 2 }, { name: 'Urban site', x: 20, y: 10, r: 2 }] };
assert.equal(tasks.evaluate(goal, game).ok, true, 'Exactly 1000 m qualifies without a walking route');
game.compiled.stations[0].x = 4.001;
assert.equal(tasks.evaluate(goal, game).ok, false, '1000.25 m does not qualify');
game.compiled.stations[0].x = 3.99; game.compiled.stations[1].x = 22.001;
assert.equal(tasks.evaluate(goal, game).ok, false, 'Urban targets retain their original 500 m radius');
game.compiled.stations[1].x = 22;
assert.equal(tasks.evaluate(goal, game).ok, true);
assert.equal(tasks.evaluate(goal, game, () => false).ok, false, 'Unserved stations cannot complete a connection');
game.compiled.routes = [{ stIdx: [0] }, { stIdx: [1] }];
assert.equal(tasks.evaluate(goal, game).ok, false, 'Nearby stations must still be connected');
game.compiled.routes = [{ stIdx: [0, 1] }];
assert.equal(Tasks.withConnectionRadii({ ...goal, anchors: [{ ...goal.anchors[0], r: 5 }, goal.anchors[1]] }, game).anchors[0].r, 4,
  'Former 1250 m suburban radii also become exactly 1000 m');

const saved = { active: [{ ...goal, progress: { ok: false }, evaluatedYM: 24299 }], done: [{ id: 'done' }], failed: [{ id: 'failed' }] };
const original = JSON.stringify(saved), restored = Tasks.restore(saved, { y: 2024, m: 12 }, game);
assert.equal(restored.active[0].anchors[0].r, 4);
assert.equal(restored.active[0].anchors[1].r, 2);
assert.equal(restored.active[0].progress, undefined); assert.equal(restored.active[0].evaluatedYM, undefined);
assert.equal(restored.connectionRadiusUpdated, true);
assert.equal(restored.done, saved.done); assert.equal(restored.failed, saved.failed);
assert.equal(JSON.stringify(saved), original, 'Save input and completed history remain untouched');
const again = Tasks.restore(restored.serialize(), { y: 2024, m: 12 }, game);
assert.equal(again.connectionRadiusUpdated, undefined, 'Migration is idempotent');
const fresh = JSON.parse(JSON.stringify(goal)); Tasks.prepare(fresh, game);
assert.equal(fresh.anchors[0].r, 4);
const composite = { type: 'combo', anchors: goal.anchors, parts: [{ type: 'direct', core: true }, { type: 'facShare', fac: 'sh_ruijin' }] };
const updated = Tasks.withConnectionRadii(composite, game);
assert.equal(updated.anchors[0].r, 4); assert.equal(updated.parts[1], composite.parts[1]);
assert.equal(Tasks.withConnectionRadii({ ...goal, type: 'facShare' }, game).anchors[0].r, 2, 'Ridership goals are unchanged');
const otherMap = { ...game, city: { regionAt: () => ({ id: 'suburb' }) } };
assert.equal(tasks.evaluate(goal, otherMap).ok, false, 'Maps without this policy retain their existing radii');
console.log('PASS inclusive 1 km suburban radius, unchanged urban/ridership rules, service/connectivity, new and restored tasks');

// Real Shanghai administrative masks verify mixed suburban / urban targets.
const city = new C.City(); city.generate(19900101, 2025, { deferGraphs: true });
const actual = { city };
const northSouth = C.DATA.histTasks.find(t => t.id === 'sh1');
const northSouthAnchors = Tasks.connectionAnchors(actual, northSouth.anchors);
assert.equal(northSouthAnchors.find(a => a.name === '人民广场').r, 3);
const hongqiaoLink = C.DATA.histTasks.find(t => t.id === 'sh7');
const mixed = Tasks.connectionAnchors(actual, hongqiaoLink.anchors);
assert.equal(mixed.find(a => a.name === '虹桥站').r, 4);
assert.equal(mixed.find(a => a.name === '人民广场').r, 3);
for (const id of ['sh-newcity-academic', 'sh-reopen-campus', 'sh-huaqiao-development', 'sh-legoland-link', 'sh-newcity-lingang', 'sh-chongming-development']) {
  const task = C.DATA.histTasks.find(t => t.id === id), anchors = Tasks.connectionAnchors(actual, task.anchors);
  assert.ok(anchors.every(a => a.r === 4), task.title);
}
if (process.env.CM_TASK_SAVE) {
  const payload = C.Save.parseEnvelope(await readFile(process.env.CM_TASK_SAVE, 'utf8')).payload;
  const before = JSON.stringify(payload.tasks), migrated = Tasks.restore(payload.tasks, payload.clock, actual);
  const changed = migrated.active.filter((t, i) => JSON.stringify(t.anchors) !== JSON.stringify(payload.tasks.active[i].anchors));
  assert.equal(JSON.stringify(payload.tasks), before);
  for (const task of changed) assert.equal(task.evaluatedYM, undefined);
  const secondLoad = Tasks.restore(migrated.serialize(), payload.clock, actual);
  assert.equal(secondLoad.connectionRadiusUpdated, undefined, 'Real facility templates retain the normalized radius on later loads');
  console.log('PASS read-only Shanghai save migration:', changed.map(t => t.id).join(', '));
}
console.log('PASS real Shanghai core, suburban campuses, new cities, islands and Huaqiao classification');
