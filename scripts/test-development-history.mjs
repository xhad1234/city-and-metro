import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = { console, atob, btoa };
context.window = context;
vm.createContext(context);
for (const file of ['util.js', 'development-history.js']) {
  vm.runInContext(await readFile(new URL('../js/' + file, import.meta.url), 'utf8'), context, { filename: file });
}
const H = context.CM.DevelopmentHistory;
const clone = value => JSON.parse(JSON.stringify(value));
const date = (y, m, d = 1) => ({ y, m, d });
const city = { W: 2, H: 2, pop: new Float32Array([100.2, 0, 240, 8]) };
const history = new H(city, date(2026, 5, 18));
let { start, end } = history.window(3);
assert.equal(H.label(start), '2026-05-18');
assert.strictEqual(start, end);
const first = history.frames[0];

city.pop.set([125, 40, 200, 0]);
history.capture(city, date(2026, 6));
for (const months of [1, 3, 6, 12, 36]) {
  ({ start, end } = history.window(months));
  assert.strictEqual(start, first);
  assert.equal(H.label(end), '2026-06-01');
}
assert.equal(H.at(history.values(start), 0, 0), 100);
assert.equal(H.at(history.values(end), 0, 0), 125);
assert.equal(H.at(history.values(start), 1, 0), 0);
assert.equal(H.at(history.values(end), 1, 0), 40);
assert.equal(H.at(history.values(end), 0, 1), 200);
assert.equal(H.at(history.values(end), 1, 1), 0);
const saved = clone(history.serialize());
const loaded = new H(city, date(2026, 6, 20), saved);
assert.equal(H.label(loaded.window(1).end), '2026-06-01');
assert.equal(H.at(loaded.values(loaded.window(1).end), 1, 0), 40);
assert.equal(loaded.frames.length, 2, 'Reloading midmonth must not replace the last monthly snapshot');

for (let y = 2026; y <= 2031; y++) for (let m = 1; m <= 12; m++) {
  if (y === 2026 && m <= 6) continue;
  city.pop[0] = y * 12 + m;
  history.capture(city, date(y, m));
}
assert.equal(H.label(history.frames[0]), '2026-05-18');
assert.ok(history.frames.some(f => f.y === 2027 && f.m === 1));
assert.ok(!history.frames.some(f => f.y === 2027 && f.m === 6));
assert.equal(H.label(history.window(36).start), '2028-12-01');
assert.equal(H.label(history.window(3).start), '2031-09-01');
assert.equal(H.label(history.window(1).start), '2031-11-01');
const pinned = history.window(0, 20270101, 20280101);
assert.equal(H.label(pinned.start), '2027-01-01');
assert.equal(H.label(pinned.end), '2028-01-01');
assert.equal(H.at(history.values(pinned.start), 0, 0), 2027 * 12 + 1);
assert.equal(H.at(history.values(pinned.end), 0, 0), 2028 * 12 + 1);

const expanded = { W: 3, H: 2, pop: new Float32Array([10, 130, 45, 0, 180, 0]) };
H.shift(saved, 1, 0);
const migrated = new H(expanded, date(2026, 6, 20), saved);
({ start, end } = migrated.window(3));
assert.equal(H.label(end), '2026-06-20');
assert.equal(H.at(migrated.values(start), 0, 0), -1);
assert.equal(H.at(migrated.values(start), 1, 0), 100);
assert.equal(H.at(migrated.values(end), 0, 0), 10);
assert.equal(H.at(migrated.values(end), 1, 0), 130);

const jobsCity = { ...city, jobs: new Float32Array([70, 0, 120, 4]) };
const jobHistory = new H(jobsCity, date(2026, 6, 20), undefined, 'jobs');
assert.equal(H.label(jobHistory.window(3).start), '2026-06-20');
assert.equal(H.at(jobHistory.values(jobHistory.window(3).end), 0, 0), 70);
jobsCity.jobs[0] = 80;
jobHistory.capture(jobsCity, date(2026, 7));
const restoredJobs = new H(jobsCity, date(2026, 7), clone(jobHistory.serialize()), 'jobs');
assert.equal(H.at(restoredJobs.values(restoredJobs.window(1).start), 0, 0), 70);
assert.equal(H.at(restoredJobs.values(restoredJobs.window(1).end), 0, 0), 80);

console.log('PASS parcel population and jobs, earliest-date fallback, preset and custom ranges, retention, save and map expansion');
